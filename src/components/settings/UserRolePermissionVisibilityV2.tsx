import { ArrowRight, Boxes, ClipboardCheck, Eye, FileCheck2, FileText, GitBranch, KeyRound, Layers3, LockKeyhole, ShieldCheck, type LucideIcon } from "lucide-react";
import { A, Card, Chip } from "../../components/ui";
import { typography } from "../../components/ui/typography";
import type {
  DataScopeGroup,
  DocumentPermissionRow,
  ModuleVisibilityRow,
  PermissionBundle,
  PermissionReviewDraft,
  RestrictedActionPolicy,
  ReviewChainVisibility,
  ReviewPermissionPolicy,
  RolePermissionNavigationLink,
  RoleProfile,
  UserRolePermissionVisibilityV2 as RolePermissionPayload,
} from "../../modules/settings/rolePermissionVisibility";

type NavigateFn = (moduleId: string, focusTarget?: { entityType: string; entityId: string } | null, options?: { returnTo?: string; entityLabel?: string; source?: string; returnContext?: unknown }) => void;

const buttonClass = "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold";

function focusFrom(link?: Pick<RolePermissionNavigationLink, "entityType" | "entityId"> | null) {
  if (!link?.entityType || !link.entityId) return null;
  return { entityType: link.entityType, entityId: link.entityId };
}

function returnContext() {
  return {
    sourceModule: "settings",
    sourceRoute: "settings:roles",
    sourceLabel: "角色权限可见性",
    returnLabel: "返回角色权限可见性",
    originIntent: "userRolePermissionVisibility",
  };
}

function navigateWithContext(onNavigate: NavigateFn, link: RolePermissionNavigationLink) {
  onNavigate(link.moduleId, focusFrom(link), {
    returnTo: "settings:roles",
    entityLabel: link.entityLabel || link.label,
    source: "userRolePermissionVisibility",
    returnContext: returnContext(),
  });
}

function LinkButton({ link, onNavigate, primary = false }: { link: RolePermissionNavigationLink; onNavigate: NavigateFn; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => navigateWithContext(onNavigate, link)}
      className={buttonClass}
      style={primary ? { background: A.blue, color: A.white } : { background: "#eef4ff", color: A.blue }}
    >
      {link.label}<ArrowRight size={13} />
    </button>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <Icon size={16} />
          <h2 className={typography.sectionTitle} style={{ color: A.label }}>{title}</h2>
        </div>
        {subtitle && <div className="mt-1 text-[12px] leading-5" style={{ color: A.sub }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function MiniList({ items, limit = 4 }: { items: string[]; limit?: number }) {
  return <span>{items.slice(0, limit).join("、")}{items.length > limit ? ` 等 ${items.length} 项` : ""}</span>;
}

function SummaryCards({ payload }: { payload: RolePermissionPayload }) {
  const rows = [
    ["业务角色", payload.summary.roleCount],
    ["职责包", payload.summary.permissionBundleCount],
    ["单据权限", payload.summary.documentPermissionCount],
    ["复核链路", payload.summary.reviewChainCount],
    ["数据范围", payload.summary.dataScopeGroupCount],
    ["模块可见性", payload.summary.moduleVisibilityCount],
    ["受限动作", payload.summary.restrictedActionCount],
    ["权限复核草稿", payload.summary.permissionDraftCount],
    ["当前状态", payload.summary.readinessLabel],
  ] as const;
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-9">
      {rows.map(([label, value]) => (
        <Card key={label} className="rounded-xl p-3">
          <div className="text-[11px]" style={{ color: A.sub }}>{label}</div>
          <div className="mt-1 truncate text-[20px] font-bold tabular-nums" style={{ color: A.label }}>{value}</div>
        </Card>
      ))}
    </section>
  );
}

function RoleProfiles({ items, onNavigate }: { items: RoleProfile[]; onNavigate: NavigateFn }) {
  return (
    <Card className="rounded-xl p-4" data-testid="role-profiles">
      <SectionHeader icon={KeyRound} title="业务角色" subtitle="按采购、供应链、财务、数据和配置复核职责展示当前权限状态。" />
      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
        {items.map((role) => (
          <div key={role.id} className="rounded-xl border p-3" style={{ borderColor: A.border, background: "#fbfdff" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[14px] font-semibold" style={{ color: A.label }}>{role.roleLabel}</div>
              <Chip label={role.roleGroup} color={A.blue} bg="#eef4ff" />
            </div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.sub }}>{role.businessPurpose}</div>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {[
                ["用户预览", `${role.userPreviewCount} 人 · ${role.userPreviewLabels.join("、")}`],
                ["可见模块", <MiniList items={role.visibleModules} />],
                ["可见单据", <MiniList items={role.visibleObjects} />],
                ["可复核范围", <MiniList items={role.reviewScopes} />],
                ["草稿预览范围", <MiniList items={role.draftScopes} />],
                ["数据范围", <MiniList items={role.dataScopes} />],
                ["受限范围", <MiniList items={role.restrictedScopes} />],
                ["边界说明", <MiniList items={role.boundaryLabels} />],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-lg px-2 py-1.5" style={{ background: A.white }}>
                  <div className="fc-caption" style={{ color: A.gray2 }}>{label}</div>
                  <div className="mt-1 text-[12px] leading-5" style={{ color: A.label }}>{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {role.navigationLinks.slice(0, 2).map((link) => <LinkButton key={`${role.id}-${link.moduleId}`} link={link} onNavigate={onNavigate} />)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PermissionBundles({ items, onNavigate }: { items: PermissionBundle[]; onNavigate: NavigateFn }) {
  return (
    <Card className="rounded-xl p-4" data-testid="permission-bundles">
      <SectionHeader icon={Boxes} title="职责包" subtitle="职责包只展示角色权限组合，不直接改变用户权限。" />
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {items.map((bundle) => (
          <div key={bundle.id} className="rounded-xl border p-3" style={{ borderColor: A.border }}>
            <div className="text-[13px] font-semibold" style={{ color: A.label }}>{bundle.bundleLabel}</div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.sub }}>{bundle.businessPurpose}</div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.gray1 }}>包含角色：{bundle.includedRoles.join("、")}</div>
            <div className="mt-1 text-[12px] leading-5" style={{ color: A.gray1 }}>草稿预览能力：{bundle.draftCapabilities.slice(0, 3).join("、")}</div>
            <div className="mt-1 text-[12px] leading-5" style={{ color: A.gray1 }}>复核能力：{bundle.reviewCapabilities.slice(0, 3).join("、")}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {bundle.navigationLinks.slice(0, 1).map((link) => <LinkButton key={`${bundle.id}-${link.moduleId}`} link={link} onNavigate={onNavigate} />)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DocumentMatrix({ items, onNavigate }: { items: DocumentPermissionRow[]; onNavigate: NavigateFn }) {
  return (
    <Card className="rounded-xl p-4" data-testid="document-permission-matrix">
      <SectionHeader icon={FileText} title="单据权限矩阵" subtitle="按业务对象展示可见、草稿预览、复核和数据负责人角色。" />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left">
          <thead style={{ background: "#fbfdff" }}>
            <tr>
              {["单据类型", "可见角色", "草稿预览角色", "复核角色", "数据负责人", "受限角色", "边界说明", "跳转"].map((header) => (
                <th key={header} className="px-3 py-3 text-[12px] font-semibold" style={{ color: A.gray1 }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row, index) => (
              <tr key={row.documentType} style={{ borderTop: index ? `1px solid ${A.border}` : "none" }}>
                <td className="px-3 py-3 text-[13px] font-semibold" style={{ color: A.label }}>{row.documentLabel}</td>
                <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}><MiniList items={row.visibleToRoles} /></td>
                <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}><MiniList items={row.draftPreviewRoles} /></td>
                <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}><MiniList items={row.reviewRoles} /></td>
                <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}><MiniList items={row.dataOwnerRoles} /></td>
                <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}><MiniList items={row.restrictedRoles} /></td>
                <td className="px-3 py-3 text-[12px]" style={{ color: A.blue }}>{row.boundarySummary}</td>
                <td className="px-3 py-3">{row.navigationLinks[0] && <LinkButton link={row.navigationLinks[0]} onNavigate={onNavigate} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ReviewChains({ items, onNavigate }: { items: ReviewChainVisibility[]; onNavigate: NavigateFn }) {
  return (
    <Card className="rounded-xl p-4" data-testid="review-chain-visibility">
      <SectionHeader icon={GitBranch} title="复核链路可见性" subtitle="仅展示复核链路状态，不让任何链路真实生效。" />
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {items.map((chain) => (
          <div key={chain.id} className="rounded-xl border p-3" style={{ borderColor: A.border }}>
            <div className="text-[13px] font-semibold" style={{ color: A.label }}>{chain.chainLabel}</div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.sub }}>{chain.appliesTo} · {chain.triggerConditionLabel}</div>
            <div className="mt-2 text-[12px]" style={{ color: A.gray1 }}>复核角色：{chain.reviewRoles.join("、")}</div>
            <div className="mt-1 text-[12px]" style={{ color: A.gray1 }}>观察角色：{chain.observerRoles.join("、")}</div>
            <div className="mt-1 text-[12px] leading-5" style={{ color: A.blue }}>{chain.escalationPreview}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {chain.navigationLinks.slice(0, 1).map((link) => <LinkButton key={`${chain.id}-${link.moduleId}`} link={link} onNavigate={onNavigate} />)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DataScopes({ items, onNavigate }: { items: DataScopeGroup[]; onNavigate: NavigateFn }) {
  return (
    <Card className="rounded-xl p-4" data-testid="data-scope-groups">
      <SectionHeader icon={Layers3} title="数据范围分组" subtitle="当前工作区内的业务数据范围说明。" />
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((scope) => (
          <div key={scope.id} className="rounded-xl border p-3" style={{ borderColor: A.border }}>
            <div className="text-[13px] font-semibold" style={{ color: A.label }}>{scope.scopeLabel}</div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.sub }}>适用角色：{scope.appliesToRoles.join("、")}</div>
            <div className="mt-1 text-[12px] leading-5" style={{ color: A.gray1 }}>包含模块：{scope.includedModules.join("、")}</div>
            <div className="mt-1 text-[12px] leading-5" style={{ color: A.blue }}>{scope.limitationSummary}</div>
            <div className="mt-3">{scope.navigationLinks[0] && <LinkButton link={scope.navigationLinks[0]} onNavigate={onNavigate} />}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ModuleMatrix({ items, onNavigate }: { items: ModuleVisibilityRow[]; onNavigate: NavigateFn }) {
  return (
    <Card className="rounded-xl p-4" data-testid="module-visibility-matrix">
      <SectionHeader icon={Eye} title="模块可见性矩阵" subtitle="展示模块、可见角色、复核角色和草稿预览角色。" />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[940px] text-left">
          <thead style={{ background: "#fbfdff" }}>
            <tr>
              {["模块", "可见角色", "可复核角色", "草稿预览角色", "受限动作摘要", "来源模块", "跳转"].map((header) => (
                <th key={header} className="px-3 py-3 text-[12px] font-semibold" style={{ color: A.gray1 }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row, index) => (
              <tr key={row.id} style={{ borderTop: index ? `1px solid ${A.border}` : "none" }}>
                <td className="px-3 py-3 text-[13px] font-semibold" style={{ color: A.label }}>{row.moduleLabel}</td>
                <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}><MiniList items={row.visibleToRoles} /></td>
                <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}><MiniList items={row.reviewRoles} /></td>
                <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}><MiniList items={row.draftOnlyRoles} /></td>
                <td className="px-3 py-3 text-[12px]" style={{ color: A.blue }}>{row.restrictedActionSummary}</td>
                <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}>{row.sourceModule}</td>
                <td className="px-3 py-3">{row.navigationLinks[0] && <LinkButton link={row.navigationLinks[0]} onNavigate={onNavigate} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ReviewPolicies({ items, onNavigate }: { items: ReviewPermissionPolicy[]; onNavigate: NavigateFn }) {
  return (
    <Card className="rounded-xl p-4" data-testid="review-permission-policies">
      <SectionHeader icon={ShieldCheck} title="复核权限策略" subtitle="复核权限保持草稿预览与人工复核边界。" />
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {items.slice(0, 8).map((policy) => (
          <div key={policy.id} className="rounded-xl border p-3" style={{ borderColor: A.border }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13px] font-semibold" style={{ color: A.label }}>{policy.policyLabel}</div>
              <Chip label="需人工复核" color={A.blue} bg="#eef4ff" />
            </div>
            <div className="mt-2 text-[12px]" style={{ color: A.sub }}>{policy.appliesToModule} · {policy.sourceModule}</div>
            <div className="mt-1 text-[12px] leading-5" style={{ color: A.gray1 }}>可复核角色：{policy.allowedRoles.join("、")}</div>
            <div className="mt-3">{policy.navigationLinks[0] && <LinkButton link={policy.navigationLinks[0]} onNavigate={onNavigate} />}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RestrictedPolicies({ items, onNavigate }: { items: RestrictedActionPolicy[]; onNavigate: NavigateFn }) {
  return (
    <Card className="rounded-xl p-4" data-testid="restricted-action-policies">
      <SectionHeader icon={LockKeyhole} title="受限动作策略" subtitle="将受限动作转为安全替代方式和复核草稿。" />
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((policy) => (
          <div key={policy.id} className="rounded-xl border p-3" style={{ borderColor: A.border }}>
            <div className="text-[13px] font-semibold" style={{ color: A.label }}>{policy.actionLabel}</div>
            <div className="mt-2 text-[12px]" style={{ color: A.sub }}>{policy.appliesTo}</div>
            <div className="mt-1 text-[12px] leading-5" style={{ color: A.blue }}>{policy.restrictedReason}</div>
            <div className="mt-1 text-[12px] leading-5" style={{ color: A.gray1 }}>安全替代方式：{policy.safeAlternative}</div>
            <div className="mt-3">{policy.navigationLinks[0] && <LinkButton link={policy.navigationLinks[0]} onNavigate={onNavigate} />}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PermissionDrafts({ items, onNavigate }: { items: PermissionReviewDraft[]; onNavigate: NavigateFn }) {
  function actionLink(draft: PermissionReviewDraft, action: string): RolePermissionNavigationLink {
    if (action === "进入人工复核") return draft.navigationLinks.find((link) => link.moduleId === "review-actions") || { label: action, moduleId: "review-actions" };
    if (action === "打开来源模块") return draft.navigationLinks[0] || { label: action, moduleId: "settings:roles" };
    return { label: action, moduleId: "settings:roles", entityType: "permission_review", entityId: draft.id, entityLabel: draft.title };
  }
  return (
    <Card className="rounded-xl p-4" data-testid="permission-review-drafts">
      <SectionHeader icon={FileCheck2} title="权限复核草稿" subtitle="权限变更只生成复核草稿，不直接改变用户权限。" />
      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
        {items.map((draft) => (
          <div key={draft.id} className="rounded-xl border p-3" style={{ borderColor: A.border, background: "#fbfdff" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13px] font-semibold" style={{ color: A.label }}>{draft.title}</div>
              <Chip label={draft.status} color={A.green} bg="#ecfdf5" />
            </div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.sub }}>{draft.targetRole} · {draft.targetModule}</div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.label }}>{draft.conclusion}</div>
            <div className="mt-2 rounded-lg px-3 py-2 text-[12px] leading-5" style={{ background: A.white, color: A.sub }}>{draft.proposedPermissionPreview}</div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.gray1 }}>关键证据：{draft.keyEvidence.join("；")}</div>
            <div className="mt-1 text-[12px] leading-5" style={{ color: A.gray1 }}>复核清单：{draft.reviewChecklist.join("；")}</div>
            <div className="mt-1 text-[12px] leading-5" style={{ color: A.gray1 }}>缺失信息：{draft.missingInformation.join("；")}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["预览权限草稿", "进入人工复核", "标记仅内部留存", "打开来源模块"].map((action, index) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => navigateWithContext(onNavigate, actionLink(draft, action))}
                  className={buttonClass}
                  style={index === 1 ? { background: A.blue, color: A.white } : { background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(15,23,42,0.10)" }}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DataLimitations({ payload }: { payload: RolePermissionPayload }) {
  return (
    <Card className="rounded-xl p-4" data-testid="role-permission-data-limitations">
      <SectionHeader icon={ClipboardCheck} title="数据限制" subtitle="权限可见性受当前工作区数据范围影响。" />
      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {payload.dataLimitations.map((item, index) => (
          <div key={`${item.label}-${index}`} className="rounded-lg px-3 py-2" style={{ background: A.gray6 }}>
            <div className="text-[12px] font-semibold" style={{ color: A.label }}>{item.label}</div>
            <div className="mt-1 text-[12px] leading-5" style={{ color: A.sub }}>{item.description || "需要人工复核。"}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function UserRolePermissionVisibilityV2({ payload, onNavigate }: { payload: RolePermissionPayload; onNavigate: NavigateFn }) {
  return (
    <div className="space-y-4" data-testid="user-role-permission-visibility">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[24px] leading-8 font-bold tracking-normal" style={{ color: A.label }}>系统设置</h1>
            <Chip label="角色权限可见性" color={A.blue} bg="#eef4ff" />
            <Chip label="当前工作区数据" color={A.green} bg="#ecfdf5" />
          </div>
          <div className="mt-2 max-w-5xl rounded-md px-3 py-2 text-[13px] leading-5" style={{ background: "#eef4ff", color: A.blue }}>
            当前仅展示角色权限状态，权限变更只生成复核草稿，不直接改变用户权限，不影响正式业务处理，不覆盖当前工作区数据。
          </div>
        </div>
      </section>
      <SummaryCards payload={payload} />
      <RoleProfiles items={payload.roleProfiles} onNavigate={onNavigate} />
      <PermissionBundles items={payload.permissionBundles} onNavigate={onNavigate} />
      <DocumentMatrix items={payload.documentPermissionMatrix} onNavigate={onNavigate} />
      <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[1fr_0.9fr]">
        <ReviewChains items={payload.reviewChainVisibility} onNavigate={onNavigate} />
        <DataScopes items={payload.dataScopeGroups} onNavigate={onNavigate} />
      </section>
      <ModuleMatrix items={payload.moduleVisibilityMatrix} onNavigate={onNavigate} />
      <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[0.95fr_1.05fr]">
        <ReviewPolicies items={payload.reviewPermissionPolicies} onNavigate={onNavigate} />
        <RestrictedPolicies items={payload.restrictedActionPolicies} onNavigate={onNavigate} />
      </section>
      <PermissionDrafts items={payload.permissionReviewDrafts} onNavigate={onNavigate} />
      <DataLimitations payload={payload} />
    </div>
  );
}
