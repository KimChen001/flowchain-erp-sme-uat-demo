import { useEffect, useState } from "react";
import { A, Card, RecoveryActions } from "../../components/ui";
import { PilotReadinessGovernanceV2 } from "../../components/pilot/PilotReadinessGovernanceV2";
import { fetchPilotReadinessGovernance, type PilotReadinessGovernanceV2 as PilotPayload } from "./pilotReadinessGovernance";

type NavigateFn = (moduleId: string, focusTarget?: { entityType: string; entityId: string } | null, options?: { returnTo?: string; entityLabel?: string; source?: string; returnContext?: unknown }) => void;

export default function PilotReadinessPage({ onNavigate }: { onNavigate: NavigateFn }) {
  const [payload, setPayload] = useState<PilotPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPilotReadinessGovernance()
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
      <Card className="p-6" data-testid="pilot-readiness-governance">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-64 rounded" style={{ background: A.gray5 }} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
            {Array.from({ length: 14 }).map((_, index) => <div key={index} className="h-[72px] rounded-xl" style={{ background: A.gray6 }} />)}
          </div>
          <div className="h-96 rounded-xl" style={{ background: A.gray6 }} />
        </div>
      </Card>
    );
  }

  if (error || !payload) {
    return (
      <Card className="p-6" data-testid="pilot-readiness-governance">
        <h1 className="text-[24px] leading-8 font-bold tracking-normal" style={{ color: A.label }}>试点准备度</h1>
        <div className="mt-3 text-sm" style={{ color: A.red }}>试点准备度暂不可用，请稍后重试。</div>
        <div className="mt-4">
          <RecoveryActions actions={[{ key: "reload", label: "重新加载", onClick: () => window.location.reload(), kind: "list" }]} />
        </div>
      </Card>
    );
  }

  return <PilotReadinessGovernanceV2 payload={payload} onNavigate={onNavigate} />;
}
