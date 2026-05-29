export interface CourtServiceStoredLine {
  key: string
  name: string
  price: number
  qty: number
  category?: string
  sku?: string
  sourceWarehouseId?: number
  sourceWarehouseLabel?: string
  sourceIsHub?: boolean
  staffNote?: string
}

export type CourtServicesByBooking = Record<string, CourtServiceStoredLine[]>
export interface CourtServiceCheckoutMeta {
  savedHash?: string
  savedAt?: string
  paidHash?: string
  paidAt?: string
}
export type CourtServiceCheckoutMetaByBooking = Record<string, CourtServiceCheckoutMeta>

export const COURT_SERVICES_STORAGE_KEY = "bh_employee_court_services_v2"
export const COURT_SERVICES_CHECKOUT_META_KEY = "bh_employee_court_services_checkout_v1"
const LEGACY_STORAGE_KEYS = [
  "bh_employee_court_services_v1",
  "bh_employee_court_services_board_v1",
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function normalizeStoredServices(value: unknown): CourtServicesByBooking {
  if (!isRecord(value)) return {}

  const normalized: CourtServicesByBooking = {}

  for (const [bookingId, rawLines] of Object.entries(value)) {
    if (!Array.isArray(rawLines)) continue

    const lines = rawLines
      .filter((line) => isRecord(line))
      .map((line) => ({
        key: String(line.key || ""),
        name: String(line.name || ""),
        price: Number(line.price || 0),
        qty: Math.max(1, Number(line.qty || 1)),
        category: typeof line.category === "string" ? line.category : undefined,
        sku: typeof line.sku === "string" ? line.sku : undefined,
        sourceWarehouseId:
          typeof line.sourceWarehouseId === "number" ? line.sourceWarehouseId : undefined,
        sourceWarehouseLabel:
          typeof line.sourceWarehouseLabel === "string" ? line.sourceWarehouseLabel : undefined,
        sourceIsHub: typeof line.sourceIsHub === "boolean" ? line.sourceIsHub : undefined,
        staffNote: typeof line.staffNote === "string" ? line.staffNote : undefined,
      }))
      .filter((line) => line.key && line.name)

    if (lines.length > 0) {
      normalized[bookingId] = lines
    }
  }

  return normalized
}

export function loadCourtServicesStorage(): CourtServicesByBooking {
  if (typeof window === "undefined") return {}

  try {
    const primaryRaw = window.localStorage.getItem(COURT_SERVICES_STORAGE_KEY)
    if (primaryRaw) {
      return normalizeStoredServices(JSON.parse(primaryRaw))
    }

    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      const legacyRaw = window.localStorage.getItem(legacyKey)
      if (!legacyRaw) continue

      const normalized = normalizeStoredServices(JSON.parse(legacyRaw))
      window.localStorage.setItem(COURT_SERVICES_STORAGE_KEY, JSON.stringify(normalized))
      return normalized
    }
  } catch {}

  return {}
}

export function saveCourtServicesStorage(value: CourtServicesByBooking) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(COURT_SERVICES_STORAGE_KEY, JSON.stringify(value))
  } catch {}
}

export function loadCourtServicesCheckoutMeta(): CourtServiceCheckoutMetaByBooking {
  if (typeof window === "undefined") return {}

  try {
    const raw = window.localStorage.getItem(COURT_SERVICES_CHECKOUT_META_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return isRecord(parsed) ? (parsed as CourtServiceCheckoutMetaByBooking) : {}
  } catch {
    return {}
  }
}

export function saveCourtServicesCheckoutMeta(value: CourtServiceCheckoutMetaByBooking) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(COURT_SERVICES_CHECKOUT_META_KEY, JSON.stringify(value))
  } catch {}
}
