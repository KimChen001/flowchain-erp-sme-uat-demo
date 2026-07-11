import { useEffect, useState } from "react";
import { A, Card, RecoveryActions } from "../../components/ui";
import { WorkspaceSetupConfigV2 } from "../../components/settings/WorkspaceSetupConfigV2";
import { fetchWorkspaceSetupConfig, type WorkspaceSetupConfigV2 as WorkspaceSetupConfigPayload } from "./workspaceSetupConfig";
import { UserRolePermissionVisibilityV2 } from "../../components/settings/UserRolePermissionVisibilityV2";
import { fetchUserRolePermissionVisibility, type UserRolePermissionVisibilityV2 as RolePermissionPayload } from "./rolePermissionVisibility";
import { WorkspaceBoundaryVisibilityV2 } from "../../components/settings/WorkspaceBoundaryVisibilityV2";
import { fetchWorkspaceBoundaryVisibility, type WorkspaceBoundaryVisibilityV2 as BoundaryPayload } from "./workspaceBoundaryVisibility";

type NavigateFn = (moduleId: string, focusTarget?: { entityType: string; entityId: string } | null, options?: { returnTo?: string; entityLabel?: string; source?: string; returnContext?: unknown }) => void;

const controlledSettingsViews: Record<string, { title: string; description: string; status: string }> = {
  modules: { title: "菜单 / 模块", description: "当前版本按产品路由注册表统一管理菜单与模块，暂不开放在线修改。", status: "只读配置" },
  ai: { title: "AI 设置", description: "AI 仅提供辅助建议；自动执行、外发和高风险写操作仍受人工复核边界控制。", status: "受治理控制" },
  review: { title: "复核策略", description: "复核策略由角色权限、工作区边界和行动草稿规则共同决定。", status: "策略可见" },
};

function ControlledSettingsView({ view }: { view: string }) {
  const content = controlledSettingsViews[view] || {
    title: "设置项暂不可用",
    description: "此设置项尚未在当前工作区启用，请从系统管理导航选择可用设置。",
    status: "未启用",
  };
  return (
    <Card className="p-6" data-testid={`settings-${view}-controlled-state`}>
      <div className="fc-caption font-semibold" style={{ color: A.blue }}>{content.status}</div>
      <h2 className="fc-section-title mt-2" style={{ color: A.label }}>{content.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: A.sub }}>{content.description}</p>
    </Card>
  );
}

export default function SettingsPage({ initialView, onNavigate }: { initialView?: string; onNavigate: NavigateFn }) {
  const view = initialView || "numbering";
  const isWorkspaceView = view === "numbering";
  const isRoleView = initialView === "roles";
  const isBoundaryView = initialView === "boundaries";
  const [workspacePayload, setWorkspacePayload] = useState<WorkspaceSetupConfigPayload | null>(null);
  const [rolePayload, setRolePayload] = useState<RolePermissionPayload | null>(null);
  const [boundaryPayload, setBoundaryPayload] = useState<BoundaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!isWorkspaceView && !isRoleView && !isBoundaryView) {
      setLoading(false);
      return () => { alive = false; };
    }
    setLoading(true);
    const request = isBoundaryView ? fetchWorkspaceBoundaryVisibility() : isRoleView ? fetchUserRolePermissionVisibility() : fetchWorkspaceSetupConfig();
    request
      .then((next) => {
        if (!alive) return;
        if (isBoundaryView) {
          setBoundaryPayload(next as BoundaryPayload);
          setRolePayload(null);
          setWorkspacePayload(null);
        } else if (isRoleView) {
          setRolePayload(next as RolePermissionPayload);
          setWorkspacePayload(null);
          setBoundaryPayload(null);
        } else {
          setWorkspacePayload(next as WorkspaceSetupConfigPayload);
          setRolePayload(null);
          setBoundaryPayload(null);
        }
        setError(false);
      })
      .catch(() => {
        if (!alive) return;
        setWorkspacePayload(null);
        setRolePayload(null);
        setBoundaryPayload(null);
        setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [isWorkspaceView, isRoleView, isBoundaryView]);

  if (!isWorkspaceView && !isRoleView && !isBoundaryView) return <ControlledSettingsView view={view} />;

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

  const payloadReady = isBoundaryView ? boundaryPayload : isRoleView ? rolePayload : workspacePayload;
  if (error || !payloadReady) {
    return (
      <Card className="p-6" data-testid={isBoundaryView ? "workspace-boundary-visibility" : isRoleView ? "user-role-permission-visibility" : "workspace-setup-config"}>
        <h2 className="fc-section-title" style={{ color: A.label }}>系统设置加载失败</h2>
        <div className="mt-3 text-sm" style={{ color: A.red }}>{isBoundaryView ? "工作区边界" : isRoleView ? "角色权限可见性" : "工作区配置"}暂不可用，请稍后重试。</div>
        <div className="mt-4">
          <RecoveryActions actions={[{ key: "reload", label: "重新加载", onClick: () => window.location.reload(), kind: "list" }]} />
        </div>
      </Card>
    );
  }

  if (isBoundaryView && boundaryPayload) return <WorkspaceBoundaryVisibilityV2 payload={boundaryPayload} onNavigate={onNavigate} />;
  if (isRoleView && rolePayload) return <UserRolePermissionVisibilityV2 payload={rolePayload} onNavigate={onNavigate} />;
  return <WorkspaceSetupConfigV2 payload={workspacePayload as WorkspaceSetupConfigPayload} onNavigate={onNavigate} />;
}
