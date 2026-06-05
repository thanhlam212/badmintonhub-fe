-- ═══════════════════════════════════════════════════════════════════════════════
-- BADMINTONHUB - VIEWS, FUNCTIONS & TRIGGERS
-- Chạy sau khi đã tạo bảng và seed data (01 → 02 → 03)
-- Tên cột khớp chính xác với 01_create_tables.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. VIEWS — Đọc dữ liệu tổng hợp dễ dàng hơn
-- ─────────────────────────────────────────────────────────────────────────────

-- Xem tồn kho kèm thông tin kho + chi nhánh
CREATE OR REPLACE VIEW v_inventory_overview AS
SELECT
    i.id,
    i.sku,
    i.name               AS product_name,
    i.category,
    p.brand,
    w.name               AS warehouse_name,
    w.is_hub,
    b.name               AS branch_name,
    i.on_hand,
    i.reserved,
    i.available,
    i.reorder_point,
    i.unit_cost,
    (i.on_hand * i.unit_cost)  AS stock_value,           -- Giá trị tồn
    CASE
        WHEN i.available <= 0            THEN 'Hết hàng'
        WHEN i.available < i.reorder_point THEN 'Sắp hết'
        ELSE 'Còn hàng'
    END                  AS stock_status
FROM inventory i
JOIN products   p ON p.id = i.product_id
JOIN warehouses w ON w.id = i.warehouse_id
LEFT JOIN branches b ON b.id = w.branch_id;

-- Xem đặt sân hôm nay
-- bookings: booking_date, time_start, time_end, amount, customer_name, customer_phone
CREATE OR REPLACE VIEW v_today_bookings AS
SELECT
    bk.id               AS booking_id,
    bk.customer_name,
    bk.customer_phone,
    c.name              AS court_name,
    br.name             AS branch_name,
    bk.booking_date,
    bk.time_start,
    bk.time_end,
    bk.amount,
    bk.status,
    bk.payment_method
FROM bookings bk
JOIN courts   c  ON c.id  = bk.court_id
JOIN branches br ON br.id = bk.branch_id
WHERE bk.booking_date = CURRENT_DATE
ORDER BY bk.time_start;

-- Xem doanh thu theo chi nhánh
CREATE OR REPLACE VIEW v_branch_revenue AS
SELECT
    br.id           AS branch_id,
    br.name         AS branch_name,
    -- Doanh thu đặt sân (cột amount trong bookings)
    COALESCE(SUM(bk.amount) FILTER (WHERE bk.status = 'confirmed'), 0) AS booking_revenue,
    COUNT(bk.id) FILTER (WHERE bk.status = 'confirmed')                 AS total_bookings
FROM branches br
LEFT JOIN courts   c  ON c.branch_id = br.id
LEFT JOIN bookings bk ON bk.court_id = c.id
GROUP BY br.id, br.name;

-- Xem sản phẩm sắp hết hàng (cần nhập thêm)
CREATE OR REPLACE VIEW v_low_stock_alert AS
SELECT
    i.sku,
    i.name      AS product_name,
    w.name      AS warehouse_name,
    b.name      AS branch_name,
    i.available,
    i.reorder_point,
    (i.reorder_point - i.available) AS need_to_order
FROM inventory i
JOIN warehouses w ON w.id = i.warehouse_id
LEFT JOIN branches b ON b.id = w.branch_id
WHERE i.available < i.reorder_point
ORDER BY (i.reorder_point - i.available) DESC;

-- Xem tổng hợp đơn bán hàng
-- sales_orders: created_by (không phải employee_id), branch_id, final_total
CREATE OR REPLACE VIEW v_sales_summary AS
SELECT
    so.id,
    COALESCE(
        inv.code,
        'OD-' || TO_CHAR(so.created_at, 'YYYYMMDD') || '-' ||
        LPAD((ABS(hashtext(so.id::TEXT)) % 10000)::TEXT, 4, '0')
    ) AS order_code,
    u.full_name          AS employee_name,
    br.name              AS branch_name,
    so.customer_name,
    so.customer_phone,
    so.final_total,
    so.status,
    so.created_at
FROM sales_orders so
JOIN users    u  ON u.id  = so.created_by
LEFT JOIN branches br ON br.id = so.branch_id
LEFT JOIN LATERAL (
    SELECT i.code
      FROM invoices i
     WHERE i.sales_order_id = so.id
     ORDER BY i.created_at DESC
     LIMIT 1
) inv ON TRUE
ORDER BY so.created_at DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FUNCTIONS — Hàm hỗ trợ nghiệp vụ
-- ─────────────────────────────────────────────────────────────────────────────

-- Tính available = on_hand - reserved
CREATE OR REPLACE FUNCTION fn_calc_available(p_on_hand INT, p_reserved INT)
RETURNS INT AS $$
BEGIN
    RETURN GREATEST(p_on_hand - p_reserved, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Tạo mã đơn tự động: OD-YYYYMMDD-XXXX
CREATE OR REPLACE FUNCTION fn_generate_order_code(p_prefix VARCHAR DEFAULT 'OD')
RETURNS VARCHAR AS $$
DECLARE
    v_date   VARCHAR;
    v_seq    INT;
    v_code   VARCHAR;
BEGIN
    v_date := TO_CHAR(NOW(), 'YYYYMMDD');

    -- Đếm số đơn hôm nay
    SELECT COUNT(*) + 1
      INTO v_seq
      FROM orders
     WHERE DATE(created_at) = CURRENT_DATE;

    v_code := p_prefix || '-' || v_date || '-' || LPAD(v_seq::TEXT, 4, '0');
    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Kiểm tra sân trống cho 1 slot
-- court_slots: slot_date (không phải date)
CREATE OR REPLACE FUNCTION fn_is_court_available(
    p_court_id INT,
    p_date     DATE,
    p_time     VARCHAR
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1
          FROM court_slots
         WHERE court_id  = p_court_id
           AND slot_date = p_date
           AND time      = p_time
           AND status    = 'booked'
    );
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TRIGGERS — Tự động cập nhật dữ liệu
-- ─────────────────────────────────────────────────────────────────────────────

-- [Trigger 1] Tự cập nhật available khi on_hand hoặc reserved thay đổi
CREATE OR REPLACE FUNCTION trg_update_available()
RETURNS TRIGGER AS $$
BEGIN
    NEW.available := GREATEST(NEW.on_hand - NEW.reserved, 0);
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inventory_available
    BEFORE INSERT OR UPDATE OF on_hand, reserved ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION trg_update_available();

-- [Trigger 2] Tự cập nhật updated_at khi sửa bảng bookings / orders
CREATE OR REPLACE FUNCTION trg_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION trg_update_timestamp();

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION trg_update_timestamp();

-- Lưu ý: transfer_requests không có cột updated_at nên không tạo trigger cho bảng này

-- [Trigger 3] Tự đánh dấu court_slot = 'booked' khi tạo booking
-- bookings: time_start, time_end, booking_date, day_label
-- court_slots: slot_date, date_label, time
CREATE OR REPLACE FUNCTION trg_book_court_slot()
RETURNS TRIGGER AS $$
DECLARE
    v_time VARCHAR;
    v_start_hour INT;
    v_end_hour   INT;
BEGIN
    -- Trích giờ bắt đầu và kết thúc từ time_start / time_end
    v_start_hour := SPLIT_PART(NEW.time_start, ':', 1)::INT;
    v_end_hour   := SPLIT_PART(NEW.time_end,   ':', 1)::INT;

    -- Tạo court_slots cho mỗi giờ trong booking
    FOR i IN v_start_hour..(v_end_hour - 1) LOOP
        v_time := LPAD(i::TEXT, 2, '0') || ':00';

        INSERT INTO court_slots (court_id, slot_date, date_label, time, status, booked_by, phone, booking_id)
        VALUES (NEW.court_id, NEW.booking_date, NEW.day_label, v_time, 'booked', NEW.customer_name, NEW.customer_phone, NEW.id)
        ON CONFLICT (court_id, slot_date, time)
        DO UPDATE SET status = 'booked', booked_by = NEW.customer_name, phone = NEW.customer_phone, booking_id = NEW.id;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_after_booking_insert
    AFTER INSERT ON bookings
    FOR EACH ROW
    WHEN (NEW.status = 'confirmed')
    EXECUTE FUNCTION trg_book_court_slot();

-- [Trigger 4] Giải phóng court_slots khi hủy booking
CREATE OR REPLACE FUNCTION trg_cancel_court_slots()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
        DELETE FROM court_slots WHERE booking_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_after_booking_cancel
    AFTER UPDATE OF status ON bookings
    FOR EACH ROW
    WHEN (NEW.status = 'cancelled')
    EXECUTE FUNCTION trg_cancel_court_slots();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. INDEXES BỔ SUNG (tối ưu truy vấn thường xuyên)
-- ─────────────────────────────────────────────────────────────────────────────

-- Full-text search sản phẩm (tên + mô tả)
CREATE INDEX IF NOT EXISTS idx_products_search
    ON products USING GIN (to_tsvector('simple', name || ' ' || COALESCE(description, '')));

-- Lọc sản phẩm theo brand + category
CREATE INDEX IF NOT EXISTS idx_products_brand_category
    ON products (brand, category);

-- Lọc đơn hàng theo ngày
CREATE INDEX IF NOT EXISTS idx_orders_created_date
    ON orders (DATE(created_at));

-- Lọc giao dịch kho theo ngày
CREATE INDEX IF NOT EXISTS idx_transactions_date
    ON inventory_transactions (DATE(created_at));

-- ═══════════════════════════════════════════════════════════════════════════════
-- XONG! Chạy theo thứ tự: 01_create_tables → 02_seed_data → 03_views_functions
-- ═══════════════════════════════════════════════════════════════════════════════
