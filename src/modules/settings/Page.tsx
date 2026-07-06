import { useEffect, useState } from "react";
import { A, Card, RecoveryActions } from "../../components/ui";
import { WorkspaceSetupConfigV2 } from "../../components/settings/WorkspaceSetupConfigV2";
import { fetchWorkspaceSetupConfig, type WorkspaceSetupConfigV2 as WorkspaceSetupConfigPayload } from "./workspaceSetupConfig";
import { UserRolePermissionVisibilityV2 } from "../../components/settings/UserRolePermissionVisibilityV2";
import { fetchUserRolePermissionVisibility, type UserRolePermissionVisibilityV2 as RolePermissionPayload } from "./rolePermissionVisibility";

type NavigateFn = (moduleId: string, focusTarget?: { entityType: string; entityId: string } | null, options?: { returnTo?: string; entityLabel?: string; source?: string; returnContext?: unknown }) => void;

export default function SettingsPage({ initialView, onNavigate }: { initialView?: string; onNavigate: NavigateFn }) {
  const isRoleView = initialView === "roles";
  const [workspacePayload, setWorkspacePayload] = useState<WorkspaceSetupConfigPayload | null>(null);
  const [rolePayload, setRolePayload] = useState<RolePermissionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const request = isRoleView ? fetchUserRolePermissionVisibility() : fetchWorkspaceSetupConfig();
    request
      .then((next) => {
        if (!alive) return;
        if (isRoleView) {
          setRolePayload(next as RolePermissionPayload);
          setWorkspacePayload(null);
        } else {
          setWorkspacePayload(next as WorkspaceSetupConfigPayload);
          setRolePayload(null);
        }
        setError(false);
      })
      .catch(() => {
        if (!alive) return;
        setWorkspacePayload(null);
        setRolePayload(null);
        setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [isRoleView]);

  if (loading) {
    return (
      <Card className="p-6" data-testid="workspace-setup-config">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-64 rounded" style={{ background: A.gray5 }} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
            {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-20 rounded-xl" style={{ background: A.gray6 }} />)}
          </div>
          <div className="h-96 rounded-xl" style={{ background: A.gray6 }} />
        </div>
      </Card>
    );
  }

  const payloadReady = isRoleView ? rolePayload : workspacePayload;
  if (error || !payloadReady) {
    return (
      <Card className="p-6" data-testid={isRoleView ? "user-role-permission-visibility" : "workspace-setup-config"}>
        <h1 className="text-[24px] leading-8 font-bold tracking-normal" style={{ color: A.label }}>系统设置</h1>
        <div className="mt-3 text-sm" style={{ color: A.red }}>{isRoleView ? "角色权限可见性" : "工作区配置"}暂不可用，请稍后重试。</div>
        <div className="mt-4">
          <RecoveryActions actions={[{ key: "reload", label: "重新加载", onClick: () => window.location.reload(), kind: "list" }]} />
        </div>
      </Card>
    );
  }

  if (isRoleView && rolePayload) return <UserRolePermissionVisibilityV2 payload={rolePayload} onNavigate={onNavigate} />;
  return <WorkspaceSetupConfigV2 payload={workspacePayload as WorkspaceSetupConfigPayload} onNavigate={onNavigate} />;
}
