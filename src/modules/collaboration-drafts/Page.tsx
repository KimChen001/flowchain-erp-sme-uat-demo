import { useEffect, useState } from "react";
import { A, Card, RecoveryActions } from "../../components/ui";
import { CollaborationNotificationDraftsV2 } from "../../components/collaboration/CollaborationNotificationDraftsV2";
import { fetchCollaborationNotificationDrafts, type CollaborationNotificationDraftsV2 as CollaborationNotificationDraftsPayload } from "./collaborationNotificationDrafts";

type NavigateFn = (moduleId: string, focusTarget?: { entityType: string; entityId: string } | null, options?: { returnTo?: string; entityLabel?: string; source?: string; returnContext?: unknown }) => void;

export default function CollaborationDraftsPage({ onNavigate }: { onNavigate: NavigateFn }) {
  const [payload, setPayload] = useState<CollaborationNotificationDraftsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchCollaborationNotificationDrafts()
      .then((next) => {
        if (!alive) return;
        setPayload(next);
        setError(false);
      })
      .catch(() => {
        if (!alive) return;
        setError(true);
        setPayload(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <Card className="p-6" data-testid="collaboration-notification-drafts">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-72 rounded" style={{ background: A.gray5 }} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-20 rounded-[16px]" style={{ background: A.gray6 }} />)}
          </div>
          <div className="h-96 rounded-[20px]" style={{ background: A.gray6 }} />
        </div>
      </Card>
    );
  }

  if (error || !payload) {
    return (
      <Card className="p-6" data-testid="collaboration-notification-drafts">
        <h1 className="text-[24px] leading-8 font-bold tracking-normal" style={{ color: A.label }}>协同通知草稿</h1>
        <div className="mt-3 text-sm" style={{ color: A.red }}>协同通知草稿暂不可用，请稍后重试。</div>
        <div className="mt-4">
          <RecoveryActions actions={[{ key: "reload", label: "重新加载", onClick: () => window.location.reload(), kind: "list" }]} />
        </div>
      </Card>
    );
  }

  return <CollaborationNotificationDraftsV2 payload={payload} onNavigate={onNavigate} />;
}
