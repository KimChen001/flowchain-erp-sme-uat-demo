import { Sparkles } from "lucide-react";
import { A, Card } from "../../components/ui";
import type { ActionDraftPreviewRequest } from "../action-drafts/ActionDraftReviewShell";

type NavigateFn = (moduleId: string, focusTarget?: { entityType: string; entityId: string } | null, options?: unknown) => void;

export default function AiSuggestionsPage({ onOpenAi }: { onNavigate: NavigateFn; onReviewActionDraft?: (request: ActionDraftPreviewRequest) => void; onOpenAi?: () => void }) {
  return <Card className="p-12 text-center"><Sparkles className="mx-auto" size={28} color={A.gray2}/><h2 className="mt-3 text-sm font-semibold">当前工作区暂无 AI 建议</h2><p className="mt-2 text-xs" style={{ color: A.sub }}>运行时业务数据形成可核验建议后，将显示在这里；不会用固定 PO、发票或库存记录补足。</p>{onOpenAi && <button onClick={onOpenAi} className="mt-4 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white">打开 AI 助手</button>}</Card>;
}
