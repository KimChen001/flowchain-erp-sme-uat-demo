import type { PurchaseIntent } from "../../types/scm";
import type { ActiveContext } from "../ai-assistant/Panel";
import CanonicalProcurementPanel from "./CanonicalProcurementPanel";

export default function PurchaseRequestsPage({
  focus,
  onNavigate,
}: {
  intent: PurchaseIntent | null;
  focus?: { entityType: string; entityId: string; at: number } | null;
  onOpenRfq?: () => void;
  onNavigate?: (moduleId: string, focus?: unknown) => void;
  onActiveContextChange?: (context: ActiveContext | null) => void;
}) {
  return <CanonicalProcurementPanel onNavigate={onNavigate} focus={focus} />;
}
