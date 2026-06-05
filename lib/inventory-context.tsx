"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { inventoryApi, transferApi, purchaseOrderApi, getToken } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

export interface InventoryItem {
  id: number; sku: string; name: string; category: string; warehouse: string
  warehouseId?: number; productId?: number; onHand: number; reserved: number; available: number
  reorderPoint: number; unitCost: number; image: string
}
export interface InventoryTransaction {
  id: string; type: "import" | "export" | "transfer-out" | "transfer-in"
  date: string; sku: string; productName: string; qty: number; cost: number
  note: string; warehouse?: string; operator?: string
}
export interface TransferRequest {
  id: string; date: string; fromWarehouse: string; toWarehouse: string
  fromWarehouseId?: number; toWarehouseId?: number
  items: { sku: string; name: string; qty: number; available: number }[]
  reason: string; note: string
  status: "pending" | "approved" | "in-transit" | "completed" | "rejected"
  pickupMethod: "employee" | "delivery" | "customer"; createdBy: string
  customerName?: string; customerPhone?: string
  approvedBy?: string; approvedAt?: string; completedAt?: string
}
export interface AdminWarehouseSlip {
  id: string; type: "import" | "export"; source: "admin"; poId?: string; poRawId?: string
  supplier?: string; date: string; warehouse: string
  items: { sku: string; name: string; qty: number; unitCost: number }[]
  note: string; status: "pending" | "processed"; createdBy: string
  assignedTo: string; processedAt?: string; processedBy?: string
}
export interface PurchaseOrder {
  id: string; supplier: string; status: string; createdDate: string
  totalValue: number; items: number; warehouse?: string
  poItems?: { sku: string; name: string; qty: number; unitCost: number }[]
}

interface InventoryContextType {
  inventory: InventoryItem[]; transactions: InventoryTransaction[]
  transferRequests: TransferRequest[]; adminSlips: AdminWarehouseSlip[]
  purchaseOrders: PurchaseOrder[]; loading: boolean
  refreshInventory: () => Promise<void>
  importItems: (p: { items: { sku: string; name: string; qty: number; cost: number }[]; warehouse: string; note: string; date: string; operator: string }) => Promise<void>
  exportItems: (p: { items: { sku: string; name: string; qty: number; reason: string }[]; warehouse: string; note: string; date: string; operator: string }) => Promise<boolean>
  createTransfer: (r: Omit<TransferRequest, "id">) => Promise<string>
  updateTransferStatus: (id: string, status: TransferRequest["status"]) => Promise<void>
  exportTransferItems: (p: { transferId: string; qtys: Record<string, number>; date: string; note: string; operator: string }) => Promise<void>
  receiveTransferItems: (transferId: string, operator: string) => Promise<void>
  createAdminSlip: (s: Omit<AdminWarehouseSlip, "id">) => string
  processAdminSlip: (id: string, processedBy: string) => void
  updatePOStatus: (id: string, status: string) => Promise<void>
  resetAll: () => void
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined)

function textValue(value: any, fallback = ""): string {
  if (value === null || value === undefined) return fallback
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (typeof value === "object") {
    const named = value.name ?? value.full_name ?? value.fullName
    if (named !== undefined && named !== null) return textValue(named, fallback)
  }
  return fallback
}

function txItem(r: any): InventoryItem {
  // BE trả về camelCase warehouseName + warehouse object (Prisma include)
  const warehouseStr = r.warehouseName || r.warehouse_name
    || (typeof r.warehouse === 'string' ? r.warehouse : r.warehouse?.name)
    || ""
  return {
    id: r.id, sku: textValue(r.sku), name: textValue(r.name), category: textValue(r.category),
    warehouse: textValue(warehouseStr),
    warehouseId: r.warehouseId ?? r.warehouse_id ?? r.warehouse?.id,
    productId: r.productId ?? r.product_id ?? undefined,
    onHand: r.onHand ?? r.on_hand ?? 0,
    reserved: r.reserved ?? 0,
    available: r.available ?? 0,
    reorderPoint: r.reorderPoint ?? r.reorder_point ?? 10,
    unitCost: Number(r.unitCost ?? r.unit_cost ?? 0),
    image: r.productImage || r.product_image || r.image || "",
  }
}
function txTxn(r: any): InventoryTransaction {
  return { id: String(r.id), type: r.type, date: r.date?new Date(r.date).toISOString().split("T")[0]:"", sku: textValue(r.sku), productName: textValue(r.product_name||r.productName||r.name), qty: r.qty||r.quantity||0, cost: r.cost||0, note: textValue(r.note), warehouse: textValue(r.warehouse_name||r.warehouse), operator: textValue(r.operator) }
}
function normalizeTransferStatus(s: string): TransferRequest["status"] {
  // BE trả về "in_transit" (underscore), FE dùng "in-transit" (hyphen)
  if (s === "in_transit") return "in-transit"
  return (s || "pending") as TransferRequest["status"]
}
function txTfr(r: any): TransferRequest {
  return { id: String(r.id), date: r.created_at?new Date(r.created_at).toISOString().split("T")[0]:r.date||"", fromWarehouse: textValue(r.from_warehouse_name||r.fromWarehouse||r.fromWarehouseName||r.from_warehouse), toWarehouse: textValue(r.to_warehouse_name||r.toWarehouse||r.toWarehouseName||r.to_warehouse), fromWarehouseId: r.from_warehouse_id, toWarehouseId: r.to_warehouse_id, items: (r.items||[]).map((i: any)=>({sku:textValue(i.sku),name:textValue(i.name||i.product_name||i.productName||i.product),qty:i.qty||i.quantity||0,available:i.available||0})), reason: textValue(r.reason||r.note), note: textValue(r.note), status: normalizeTransferStatus(r.status), pickupMethod: r.pickup_method||r.pickupMethod||"employee", createdBy: textValue(r.created_by_name||r.createdBy||r.created_by), customerName: textValue(r.customer_name||r.customerName), customerPhone: textValue(r.customer_phone||r.customerPhone), approvedBy: textValue(r.approved_by_name||r.approvedBy||r.approved_by), approvedAt: r.approved_at, completedAt: r.completed_at }
}
function txPO(r: any): PurchaseOrder {
  return { id: String(r.id), supplier: textValue(r.supplier_name||r.supplier), status: r.status||"", createdDate: r.created_at?new Date(r.created_at).toISOString().split("T")[0]:r.createdDate||"", totalValue: r.total_value??r.totalValue??0, items: r.item_count??r.items??0, warehouse: textValue(r.warehouse_name||r.warehouse), poItems: (r.po_items||r.poItems||[]).map((i:any)=>({sku:textValue(i.sku),name:textValue(i.name||i.product_name||i.productName||i.product),qty:i.qty||i.quantity||0,unitCost:i.unit_cost||i.unitCost||i.price||0})) }
}

const SLIP_KEY = "bh_admin_slips"
function loadSlips(): AdminWarehouseSlip[] { if(typeof window==="undefined")return[]; try{const r=localStorage.getItem(SLIP_KEY);return r?JSON.parse(r):[]}catch{return[]} }
function saveSlips(s: AdminWarehouseSlip[]) { if(typeof window==="undefined")return; try{localStorage.setItem(SLIP_KEY,JSON.stringify(s))}catch{} }

let whMap: Record<string, number> = {}
async function ensureWhMap() { if(Object.keys(whMap).length>0)return; try{const r=await inventoryApi.getWarehouses();if(r.success&&r.data)for(const w of r.data)whMap[w.name]=w.id}catch{} }

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const canAccess = user?.role === "admin" || user?.role === "employee"
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([])
  const [adminSlips, setAdminSlips] = useState<AdminWarehouseSlip[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)

  const fetchInv = useCallback(async()=>{if(!canAccess)return;try{const r=await inventoryApi.getAll();if(r.success&&r.data)setInventory(r.data.map(txItem))}catch{}}, [canAccess])
  const fetchTxn = useCallback(async()=>{if(!canAccess)return;try{const r=await inventoryApi.getTransactions();if(r.success&&r.data)setTransactions(r.data.map(txTxn))}catch{}}, [canAccess])
  const fetchTfr = useCallback(async()=>{if(!canAccess)return;try{const r=await transferApi.getAll();if(r.success&&r.data)setTransferRequests(r.data.map(txTfr))}catch{}}, [canAccess])
  const fetchPOs = useCallback(async()=>{if(!canAccess)return;try{const r=await purchaseOrderApi.getAll();if(r.success&&r.data)setPurchaseOrders(r.data.map(txPO))}catch{}}, [canAccess])

  const refreshInventory = useCallback(async()=>{if(!canAccess){setLoading(false);return};await Promise.all([fetchInv(),fetchTxn(),fetchTfr(),fetchPOs()])}, [canAccess,fetchInv,fetchTxn,fetchTfr,fetchPOs])

  useEffect(()=>{const init=async()=>{setLoading(true);if(canAccess){await ensureWhMap();await refreshInventory()}setAdminSlips(loadSlips());setLoading(false)};init()}, [canAccess,refreshInventory])

  const importItems = useCallback(async({items,warehouse,note,date,operator}:{items:{sku:string;name:string;qty:number;cost:number}[];warehouse:string;note:string;date:string;operator:string})=>{
    await ensureWhMap(); const wid=whMap[warehouse]; if(!wid)throw new Error("Kho not found: "+warehouse)
    for(const item of items){await inventoryApi.importStock({warehouse_id:wid,sku:item.sku,quantity:item.qty,cost:item.cost,note:`${note} | ${operator}`})}
    await Promise.all([fetchInv(),fetchTxn()])
  }, [fetchInv,fetchTxn])

  const exportItems = useCallback(async({items,warehouse,note,date,operator}:{items:{sku:string;name:string;qty:number;reason:string}[];warehouse:string;note:string;date:string;operator:string}):Promise<boolean>=>{
    await ensureWhMap(); const wid=whMap[warehouse]; if(!wid)return false
    try{for(const item of items){const r=await inventoryApi.exportStock({warehouse_id:wid,sku:item.sku,quantity:item.qty,note:`${item.reason||note} | ${operator}`});if(!r.success)return false}
    await Promise.all([fetchInv(),fetchTxn()]);return true}catch{return false}
  }, [fetchInv,fetchTxn])

  const createTransfer = useCallback(async(request: Omit<TransferRequest,"id">):Promise<string>=>{
    await ensureWhMap(); const fid=whMap[request.fromWarehouse]||request.fromWarehouseId; const tid=whMap[request.toWarehouse]||request.toWarehouseId
    if(!fid||!tid)throw new Error("Kho not found")
    const r=await transferApi.create({from_warehouse_id:fid,to_warehouse_id:tid,note:`${request.reason||""} | ${request.note||""}`.trim(),items:request.items.map(i=>({sku:i.sku,quantity:i.qty}))})
    await fetchTfr(); return r.data?.id ? String(r.data.id) : (r.data as any)?.data?.id ? String((r.data as any).data.id) : ""
  }, [fetchTfr])

  const updateTransferStatus = useCallback(async(id:string,status:TransferRequest["status"])=>{await transferApi.updateStatus(id,status);await fetchTfr()}, [fetchTfr])

  const exportTransferItems = useCallback(async({transferId,qtys,date,note,operator}:{transferId:string;qtys:Record<string,number>;date:string;note:string;operator:string})=>{
    const tf=transferRequests.find(t=>t.id===transferId);if(!tf)return
    await ensureWhMap();const fid=whMap[tf.fromWarehouse]||tf.fromWarehouseId;if(!fid)return
    for(const item of tf.items){const eq=qtys[item.sku]||0;if(eq<=0)continue;await inventoryApi.exportStock({warehouse_id:fid,sku:item.sku,quantity:eq,note:`XK DC ${transferId} | ${note} | ${operator}`})}
    if(tf.status==="pending"){await transferApi.updateStatus(transferId,"approved")}
    await transferApi.updateStatus(transferId,"in-transit");await Promise.all([fetchInv(),fetchTxn(),fetchTfr()])
  }, [transferRequests,fetchInv,fetchTxn,fetchTfr])

  const receiveTransferItems = useCallback(async(transferId:string,operator:string)=>{
    const tf=transferRequests.find(t=>t.id===transferId);if(!tf)return
    await ensureWhMap();const tid=whMap[tf.toWarehouse]||tf.toWarehouseId;if(!tid)return
    for(const item of tf.items){await inventoryApi.importStock({warehouse_id:tid,sku:item.sku,quantity:item.qty,note:`NK DC ${transferId} | ${operator}`})}
    await transferApi.updateStatus(transferId,"completed");await Promise.all([fetchInv(),fetchTxn(),fetchTfr()])
  }, [transferRequests,fetchInv,fetchTxn,fetchTfr])

  const createAdminSlip = useCallback((slip: Omit<AdminWarehouseSlip,"id">)=>{
    const pfx=slip.type==="import"?"PNK":"PXK";const num=String(Math.floor(Math.random()*999)+1).padStart(3,"0")
    const id=`${pfx}-${new Date().getFullYear()}-${num}`
    setAdminSlips(prev=>{const u=[{...slip,id},...prev];saveSlips(u);return u});return id
  }, [])

  const processAdminSlip = useCallback((id:string,processedBy:string)=>{
    setAdminSlips(prev=>{const u=prev.map(s=>s.id===id?{...s,status:"processed" as const,processedAt:new Date().toISOString(),processedBy}:s);saveSlips(u);return u})
  }, [])

  const updatePOStatus = useCallback(async(id:string,status:string)=>{await purchaseOrderApi.updateStatus(id,status);await fetchPOs()}, [fetchPOs])

  const resetAll = useCallback(()=>{setInventory([]);setTransactions([]);setTransferRequests([]);setAdminSlips([]);setPurchaseOrders([]);try{localStorage.removeItem(SLIP_KEY)}catch{};refreshInventory()}, [refreshInventory])

  return (
    <InventoryContext.Provider value={{inventory,transactions,transferRequests,adminSlips,purchaseOrders,loading,refreshInventory,importItems,exportItems,createTransfer,updateTransferStatus,exportTransferItems,receiveTransferItems,createAdminSlip,processAdminSlip,updatePOStatus,resetAll}}>
      {children}
    </InventoryContext.Provider>
  )
}

export function useInventory() {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error("useInventory must be used within InventoryProvider")
  return ctx
}
