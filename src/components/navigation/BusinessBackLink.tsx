import { ArrowLeft } from "lucide-react";
import { A } from "../ui";
import type { WorkflowContext } from "../../lib/workflowContext";
import { formatReturnLabel } from "../../lib/workflowContext";

export function BusinessBackLink({
  context,
  onReturn,
}: {
  context?: WorkflowContext | null;
  onReturn: () => void;
}) {
  if (!context) return null;
  return (
    <button
      type="button"
      onClick={onReturn}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold"
      style={{ background: "#f0f6ff", color: A.blue, boxShadow: "0 0 0 0.5px rgba(37,99,235,0.18)" }}
      data-testid="business-back-link"
    >
      <ArrowLeft size={13} />
      {formatReturnLabel(context)}
    </button>
  );
}
