export type InventoryPlanningProfile = {
  monthlyDemand: number;
  unit: string;
  leadTimeDays: number;
  serviceLevel: number;
  moq: number;
  batchMultiple: number;
  allocated: number;
  inbound: number;
  qaHold: number;
  abc: "A" | "B" | "C";
  xyz: "X" | "Y" | "Z";
};

export const INVENTORY_PLANNING_PROFILE: Record<string, InventoryPlanningProfile> = {
  "SKU-00142": { monthlyDemand: 430, unit: "件", leadTimeDays: 9,  serviceLevel: 95, moq: 200,   batchMultiple: 50,   allocated: 120,  inbound: 300, qaHold: 0,  abc: "B", xyz: "X" },
  "SKU-00287": { monthlyDemand: 710, unit: "米", leadTimeDays: 12, serviceLevel: 97, moq: 500,   batchMultiple: 100,  allocated: 180,  inbound: 0,   qaHold: 0,  abc: "A", xyz: "Y" },
  "SKU-00391": { monthlyDemand: 2600, unit: "件", leadTimeDays: 6, serviceLevel: 90, moq: 2000,  batchMultiple: 500,  allocated: 900,  inbound: 0,   qaHold: 0,  abc: "C", xyz: "X" },
  "SKU-00412": { monthlyDemand: 138, unit: "件", leadTimeDays: 7,  serviceLevel: 99, moq: 20,    batchMultiple: 5,    allocated: 11,   inbound: 0,   qaHold: 0,  abc: "A", xyz: "X" },
  "SKU-00558": { monthlyDemand: 6800, unit: "件", leadTimeDays: 5, serviceLevel: 88, moq: 10000, batchMultiple: 1000, allocated: 2400, inbound: 0,   qaHold: 0,  abc: "C", xyz: "X" },
  "SKU-00623": { monthlyDemand: 58, unit: "件", leadTimeDays: 10,  serviceLevel: 99, moq: 10,    batchMultiple: 5,    allocated: 6,    inbound: 0,   qaHold: 1,  abc: "A", xyz: "Y" },
  "SKU-00744": { monthlyDemand: 260, unit: "桶", leadTimeDays: 8,  serviceLevel: 92, moq: 200,   batchMultiple: 50,   allocated: 80,   inbound: 600, qaHold: 0,  abc: "C", xyz: "Y" },
  "SKU-00815": { monthlyDemand: 152, unit: "件", leadTimeDays: 14, serviceLevel: 95, moq: 20,    batchMultiple: 5,    allocated: 18,   inbound: 0,   qaHold: 0,  abc: "B", xyz: "Y" },
  "SKU-00934": { monthlyDemand: 96, unit: "件", leadTimeDays: 9,   serviceLevel: 95, moq: 30,    batchMultiple: 10,   allocated: 16,   inbound: 0,   qaHold: 89, abc: "B", xyz: "Z" },
  "SKU-01021": { monthlyDemand: 74, unit: "件", leadTimeDays: 11,  serviceLevel: 92, moq: 50,    batchMultiple: 10,   allocated: 22,   inbound: 0,   qaHold: 0,  abc: "B", xyz: "X" },
};

export const INVENTORY_PROCUREMENT_PROFILE: Record<string, { supplier: string; unitPrice: number; buyer: string }> = {
  "SKU-00412": { supplier: "深圳新元电气", unitPrice: 2980, buyer: "陈思远" },
  "SKU-00623": { supplier: "深圳新元电气", unitPrice: 12400, buyer: "陈思远" },
  "SKU-00287": { supplier: "江苏铝合金集团", unitPrice: 142, buyer: "王志强" },
  "SKU-00142": { supplier: "华东精工机械", unitPrice: 86, buyer: "李婷" },
  "SKU-00815": { supplier: "华东精工机械", unitPrice: 4600, buyer: "李婷" },
};
