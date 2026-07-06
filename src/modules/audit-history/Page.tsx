import { useEffect, useState } from "react";
import { A, Card, RecoveryActions } from "../../components/ui";
import { AuditIntegrationHistoryV2 } from "../../components/audit/AuditIntegrationHistoryV2";
import { fetchAuditIntegrationHistory, type AuditIntegrationHistoryV2 as AuditPayload } from "./auditIntegrationHistory";

type NavigateFn = (moduleId: string, focusTarget?: { entityType: string; entityId: string } | null, options?: { returnTo?: string; entityLabel?: string; source?: string; returnContext?: unknown }) => void;

export default function AuditHistoryPage({ onNavigate }: { onNavigate: NavigateFn }) {
  const [payload, setPayload] = useState<AuditPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchAuditIntegrationHistory()
      .then((next) => {
        if (!alive) return;
        setPayload(next);
        setError(false);
      })
      .catch(() => {
        if (!alive) return;
        setPayload(null);
        setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <Card className="p-6" data-testid="audit-integration-history">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-72 rounded" style={{ background: A.gray5 }} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, index) => <div key={index} className="h-20 rounded-xl" style={{ background: A.gray6 }} />)}
          </div>
          <div className="h-96 rounded-xl" style={{ background: A.gray6 }} />
        </div>
      </Card>
    );
  }

  if (error || !payload) {
    return (
      <Card className="p-6" data-testid="audit-integration-history">
        <h1 className="text-[24px] leading-8 font-bold tracking-normal" style={{ color: A.label }}>业务审计与历史</h1>
        <div className="mt-3 text-sm" style={{ color: A.red }}>业务审计与历史暂不可用，请稍后重试。</div>
        <div className="mt-4">
          <RecoveryActions actions={[{ key: "reload", label: "重新加载", onClick: () => window.location.reload(), kind: "list" }]} />
        </div>
      </Card>
    );
  }

  return <AuditIntegrationHistoryV2 payload={payload} onNavigate={onNavigate} />;
}
