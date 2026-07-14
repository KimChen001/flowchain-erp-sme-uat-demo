import { apiJson } from "../../lib/api-client";
import type { PurchaseOrder, PurchaseRequestSummary } from "./procurementTypes";

export const procurementApi = {
  listRequests: () => apiJson<PurchaseRequestSummary[]>("/api/procurement/requests"),
  listOrders: () => apiJson<PurchaseOrder[]>("/api/procurement/orders"),
};
