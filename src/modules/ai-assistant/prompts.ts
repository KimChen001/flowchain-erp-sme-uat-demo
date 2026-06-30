type ActiveContextLike = {
  entityType?: "supplier" | "item" | "rfq" | "purchase_request" | string;
} | null;

const GENERIC_PROMPTS = ["解释当前页面", "下一步建议", "查看异常"];

const ACTIVE_CONTEXT_PROMPTS: Record<string, string[]> = {
  supplier: ["解释这个供应商", "查看风险原因", "查看 RFQ 参与"],
  item: ["查看库存风险", "解释最近变动", "准备 PR 草稿"],
  rfq: ["查看 RFQ 状态", "谁还没回复", "下一步建议"],
  purchase_request: ["查看 PR 状态", "为什么没转 PO", "下一步建议"],
};

const MODULE_PROMPTS: Record<string, string[]> = {
  srm: ["查看高风险供应商", "解释评分规则", "下一步跟进"],
  inventory: ["查看库存风险", "解释库存异常", "准备 PR 草稿"],
  procurement: ["今天采购有什么要跟？", "哪些 PO 快逾期？", "哪些 RFQ 没回复？"],
  forecast: ["今天计划模块最需要处理什么？", "哪些 SKU 有 MRP 例外？", "MRP 计划释放有哪些需要审阅？", "这个 forecast 的 MAPE 怎么样？", "哪些补货建议需要转成草稿？", "这个 SKU 的计划参数是什么？"],
  master_data: ["检查主数据质量", "缺少哪些默认字段？", "下一步建议"],
  "master-data": ["检查主数据质量", "缺少哪些默认字段？", "下一步建议"],
  finance: ["查看待结算项", "解释差异原因", "下一步跟进"],
  reports: ["总结当前报表", "找出异常信号", "下一步建议"],
  imports: ["解释导入校验", "查看导入风险", "下一步建议"],
  overview: ["今天最需要处理什么？", "哪些采购单据有风险？", "哪些库存项目需要关注？"],
};

function exactlyThree(prompts: string[]) {
  return [...prompts, ...GENERIC_PROMPTS].slice(0, 3);
}

export function getContextualQuickPrompts({
  moduleId,
  activeContext,
}: {
  moduleId?: string;
  activeContext?: ActiveContextLike;
}): string[] {
  const entityPrompts = activeContext?.entityType ? ACTIVE_CONTEXT_PROMPTS[activeContext.entityType] : null;
  if (entityPrompts) return exactlyThree(entityPrompts);
  const modulePrompts = moduleId ? MODULE_PROMPTS[moduleId] : null;
  if (moduleId === "forecast" && modulePrompts) return modulePrompts;
  return exactlyThree(modulePrompts || GENERIC_PROMPTS);
}
