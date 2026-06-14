import { FORECAST_PROCUREMENT_PROFILE } from "../../data/forecast-planning-profile";

export function forecastProcurementProfileForSku(sku: string) {
  return FORECAST_PROCUREMENT_PROFILE[sku] ?? { supplier: "未选择供应商", unitPrice: 0, buyer: "张磊" };
}

export { FORECAST_PROCUREMENT_PROFILE };
