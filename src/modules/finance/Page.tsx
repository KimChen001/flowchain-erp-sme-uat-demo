import { Card } from "../../components/ui";
import OperationalFinanceO2cWorkbench, {
  type O2cView,
} from "./OperationalFinanceO2cWorkbench";

export type FinanceTab =
  | "invoices"
  | "payables"
  | "credits"
  | "reconciliation"
  | "settlement"
  | "match"
  | O2cView;

const emptyCopy: Partial<Record<FinanceTab, [string, string]>> = {
  invoices: ["暂无供应商发票", "供应商发票接入正式数据源后，记录将显示在这里。"],
  payables: ["暂无应付记录", "费用与应付数据接入正式数据源后，记录将显示在这里。"],
  credits: ["暂无预付款或贷项", "预付款与贷项接入正式数据源后，记录将显示在这里。"],
  reconciliation: ["暂无对账单", "供应商对账数据接入正式数据源后，记录将显示在这里。"],
  settlement: ["暂无结算单", "结算数据接入正式数据源后，记录将显示在这里。"],
  match: ["暂无匹配记录", "收货与发票数据完整后可进行三单匹配。"],
};

export default function FinanceWorkbench({ initialView = "invoices" }: { initialView?: FinanceTab; onNavigate?: (routeId: string) => void }) {
  if (["customer-invoices", "customer-invoice-new", "customer-invoice-detail", "receivables", "aging", "customer-credit-notes"].includes(initialView))
    return <OperationalFinanceO2cWorkbench view={initialView as O2cView} />;
  const copy = emptyCopy[initialView] || ["当前视图暂无数据", "当前模块尚未接入正式运行时数据源。"];
  return <Card className="py-16 text-center"><h2 className="text-base font-semibold">{copy[0]}</h2><p className="mt-2 text-xs text-slate-500">{copy[1]}</p></Card>;
}
