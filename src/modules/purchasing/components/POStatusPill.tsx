import type { POStatus } from "../../../types/scm";
import { A } from "../../../components/ui";

const poStatusMeta: Record<POStatus, { color: string; bg: string }> = {
  "草稿":     { color: A.gray1,  bg: A.gray6  },
  "待审批":   { color: A.orange, bg: "#fff8f0" },
  "已审批":   { color: A.indigo, bg: "#eef0ff" },
  "已发出":   { color: A.blue,   bg: "#f0f6ff" },
  "部分到货": { color: A.teal,   bg: "#e8f6fc" },
  "已完成":   { color: A.green,  bg: "#f0faf4" },
  "已驳回":   { color: A.red,    bg: "#fff1f0" },
  "已取消":   { color: A.red,    bg: "#fff1f0" },
};

export function POStatusPill({ status }: { status: string }) {
  const displayStatus = status || "未知";
  const m = poStatusMeta[displayStatus as POStatus] ?? { color: A.gray1, bg: A.gray6 };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ color: m.color, background: m.bg }}>{displayStatus}</span>
  );
}
