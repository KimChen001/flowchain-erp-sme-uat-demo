export type MrpExceptionType = "正常" | "加急" | "释放" | "推迟/取消";

export type MrpDemandSource = {
  parent: string;
  parentName?: string;
  top?: string;
  topName?: string;
  level?: number;
  demand: number;
  qtyPer?: number;
  scrapPct?: number;
  leadTimeOffset?: number;
};

export type MrpBomSource = {
  parent: string;
  parentName?: string;
  top?: string;
  topName?: string;
  level?: number;
  demand: number;
};

export type MrpScheduleLine = {
  period: string;
  grossRequirement: number;
  independentDemand: number;
  dependentDemand: number;
  dependentDemandSources?: MrpDemandSource[];
  scheduledReceipt: number;
  projectedAvailable: number;
  netRequirement: number;
  plannedReceipt: number;
  plannedRelease: number;
  plannedReleasePeriod: string;
  exception: MrpExceptionType;
};

export type MrpPlanRow = {
  sku: string;
  name: string;
  category: string;
  unit: string;
  supplier: string;
  unitPrice: number;
  serviceLevel: number;
  abc: string;
  xyz: string;
  onHand: number;
  allocated: number;
  safetyStock: number;
  moq: number;
  batchMultiple: number;
  leadTimePeriods: number;
  totalPlannedReceipt: number;
  firstShortagePeriod: string | null;
  maxNetRequirement: number;
  amount: number;
  exception: MrpExceptionType;
  bomSources?: MrpBomSource[];
  schedule: MrpScheduleLine[];
};

export type MrpPlan = {
  generatedAt: string;
  horizon: number;
  periods: string[];
  summary: {
    skuCount: number;
    exceptionCount: number;
    urgentCount: number;
    plannedAmount: number;
    plannedQty: number;
    bomRootCount?: number;
    bomComponentCount?: number;
  };
  rows: MrpPlanRow[];
  exceptions: {
    sku: string;
    name: string;
    type: Exclude<MrpExceptionType, "正常">;
    period: string;
    quantity: number;
    amount: number;
    action: string;
  }[];
};

export type MrpScheduleEvidenceLine = {
  period: string;
  grossRequirement: number;
  independentDemand: number;
  dependentDemand: number;
  plannedReceipt: number;
  plannedReleasePeriod: string;
  exception: MrpExceptionType;
  sources: MrpDemandSource[];
};

export type MrpBomEvidence = {
  bomSources: MrpBomSource[];
  dependentDemandTotal: number;
  grossRequirementTotal: number;
  schedule: MrpScheduleEvidenceLine[];
};
