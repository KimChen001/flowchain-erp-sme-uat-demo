import { ArrowRight, Bot, Boxes, ClipboardCheck, DatabaseZap, Eye, FileCheck2, FileText, GitBranch, Layers3, ShieldCheck, type LucideIcon } from "lucide-react";
import { A, Card, Chip } from "../../components/ui";
import { typography } from "../../components/ui/typography";
import type { BoundaryNavigationLink, WorkspaceBoundaryVisibilityV2 as BoundaryPayload } from "../../modules/settings/workspaceBoundaryVisibility";

type NavigateFn = (moduleId: string, focusTarget?: { entityType: string; entityId: string } | null, options?: { returnTo?: string; entityLabel?: string; source?: string; returnContext?: unknown }) => void;

const buttonClass = "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold";

function focusFrom(link?: Pick<BoundaryNavigationLink, "entityType" | "entityId"> | null) {
  if (!link?.entityType || !link.entityId) return null;
  return { entityType: link.entityType, entityId: link.entityId };
}

function returnContext() {
  return {
    sourceModule: "settings",
    sourceRoute: "settings:boundaries",
    sourceLabel: "工作区边界",
    returnLabel: "返回工作区边界",
    originIntent: "workspaceBoundaryVisibility",
  };
}

function navigateWithContext(onNavigate: NavigateFn, link: BoundaryNavigationLink) {
  onNavigate(link.moduleId, focusFrom(link), {
    returnTo: "settings:boundaries",
    entityLabel: link.entityLabel || link.label,
    source: "workspaceBoundaryVisibility",
    returnContext: returnContext(),
  });
}

function LinkButton({ link, onNavigate, primary = false }: { link: BoundaryNavigationLink; onNavigate: NavigateFn; primary?: boolean }) {
  return (
    <button type="button" onClick={() => navigateWithContext(onNavigate, link)} className={buttonClass}
      style={primary ? { background: A.blue, color: A.white } : { background: "#eef4ff", color: A.blue }}>
      {link.label}<ArrowRight size={13} />
    </button>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Icon size={16} />
        <h2 className={typography.sectionTitle} style={{ color: A.label }}>{title}</h2>
      </div>
      {subtitle && <div className="mt-1 text-[12px] leading-5" style={{ color: A.sub }}>{subtitle}</div>}
    </div>
  );
}

function MiniList({ items, limit = 4 }: { items: string[]; limit?: number }) {
  return <span>{items.slice(0, limit).join("、")}{items.length > limit ? ` 等 ${items.length} 项` : ""}</span>;
}

function SummaryCards({ payload }: { payload: BoundaryPayload }) {
  const rows = [
    ["边界范围", payload.summary.boundaryScopeCount],
    ["数据归属", payload.summary.dataOwnershipGroupCount],
    ["模块边界", payload.summary.moduleBoundaryCount],
    ["业务对象边界", payload.summary.documentBoundaryCount],
    ["AI 边界信号", payload.summary.aiBoundarySignalCount],
    ["协同边界", payload.summary.collaborationBoundaryCount],
    ["角色边界", payload.summary.roleBoundaryCount],
    ["数据质量边界", payload.summary.dataQualityBoundaryIssueCount],
    ["边界复核草稿", payload.summary.boundaryDraftCount],
    ["当前状态", payload.summary.readinessLabel],
  ] as const;
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-5 xl:grid-cols-10">
      {rows.map(([label, value]) => (
        <Card key={label} className="rounded-xl p-3">
          <div className="text-[11px]" style={{ color: A.sub }}>{label}</div>
          <div className="mt-1 truncate text-[20px] font-bold tabular-nums" style={{ color: A.label }}>{value}</div>
        </Card>
      ))}
    </section>
  );
}

function Profile({ payload }: { payload: BoundaryPayload }) {
  const profile = payload.workspaceBoundaryProfile;
  const rows = [
    ["工作区名称", profile.workspaceName],
    ["业务范围", profile.businessScopeLabel],
    ["运行模式", profile.operatingModeLabel],
    ["数据范围", profile.dataScopeLabel],
    ["边界状态", profile.boundaryStatusLabel],
    ["复核模式", profile.reviewModeLabel],
    ["边界原则", profile.boundaryPrinciples.join("、")],
  ] as const;
  return (
    <Card className="rounded-xl p-4" data-testid="workspace-boundary-profile">
      <SectionHeader icon={ShieldCheck} title="工作区边界概览" subtitle="当前工作区数据、业务范围和边界复核原则。" />
      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg px-3 py-2" style={{ background: A.gray6 }}>
            <div className="text-[11px]" style={{ color: A.gray2 }}>{label}</div>
            <div className="mt-1 text-[12px] font-semibold leading-5" style={{ color: A.label }}>{value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BoundaryScopes({ payload, onNavigate }: { payload: BoundaryPayload; onNavigate: NavigateFn }) {
  return (
    <Card className="rounded-xl p-4" data-testid="boundary-scopes">
      <SectionHeader icon={Layers3} title="工作区边界范围" subtitle="按业务域展示当前工作区边界状态。" />
      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
        {payload.boundaryScopes.map((scope) => (
          <div key={scope.id} className="rounded-xl border p-3" style={{ borderColor: A.border, background: "#fbfdff" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13px] font-semibold" style={{ color: A.label }}>{scope.scopeLabel}</div>
              <Chip label={scope.scopeGroup} color={A.blue} bg="#eef4ff" />
            </div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.sub }}>{scope.businessPurpose}</div>
            <div className="mt-2 text-[12px]" style={{ color: A.gray1 }}>包含模块：<MiniList items={scope.includedModules} /></div>
            <div className="mt-1 text-[12px]" style={{ color: A.gray1 }}>包含对象：<MiniList items={scope.includedObjects} /></div>
            <div className="mt-1 text-[12px] leading-5" style={{ color: A.blue }}>{scope.boundarySummary}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip label="草稿预览" color={A.green} bg="#ecfdf5" />
              <Chip label="人工复核" color={A.blue} bg="#eef4ff" />
              {scope.navigationLinks.slice(0, 1).map((link) => <LinkButton key={`${scope.id}-${link.moduleId}`} link={link} onNavigate={onNavigate} />)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function OwnershipGroups({ payload, onNavigate }: { payload: BoundaryPayload; onNavigate: NavigateFn }) {
  return (
    <Card className="rounded-xl p-4" data-testid="data-ownership-groups">
      <SectionHeader icon={DatabaseZap} title="数据归属范围" subtitle="展示对象归属、归属角色和复核责任。" />
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {payload.dataOwnershipGroups.map((item) => (
          <div key={item.id} className="rounded-xl border p-3" style={{ borderColor: A.border }}>
            <div className="text-[13px] font-semibold" style={{ color: A.label }}>{item.ownerLabel}</div>
            <div className="mt-2 text-[12px]" style={{ color: A.sub }}>{item.ownerRole}</div>
            <div className="mt-1 text-[12px]" style={{ color: A.gray1 }}>归属对象：<MiniList items={item.ownedObjects} /></div>
            <div className="mt-1 text-[12px]" style={{ color: A.gray1 }}>归属模块：<MiniList items={item.ownedModules} /></div>
            <div className="mt-1 text-[12px] leading-5" style={{ color: A.blue }}>{item.boundarySummary}</div>
            <div className="mt-3">{item.navigationLinks[0] && <LinkButton link={item.navigationLinks[0]} onNavigate={onNavigate} />}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MatrixTable({ title, icon, testId, headers, rows }: { title: string; icon: LucideIcon; testId: string; headers: string[]; rows: React.ReactNode }) {
  return (
    <Card className="rounded-xl p-4" data-testid={testId}>
      <SectionHeader icon={icon} title={title} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left">
          <thead style={{ background: "#fbfdff" }}>
            <tr>{headers.map((header) => <th key={header} className="px-3 py-3 text-[12px] font-semibold" style={{ color: A.gray1 }}>{header}</th>)}</tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </Card>
  );
}

function ModuleMatrix({ payload, onNavigate }: { payload: BoundaryPayload; onNavigate: NavigateFn }) {
  return (
    <MatrixTable title="模块边界矩阵" icon={Boxes} testId="module-boundary-matrix" headers={["模块", "边界分组", "使用数据", "生成洞察", "复核输出", "下游使用方", "边界说明", "跳转"]}
      rows={payload.moduleBoundaryMatrix.map((row, index) => (
        <tr key={row.id} style={{ borderTop: index ? `1px solid ${A.border}` : "none" }}>
          <td className="px-3 py-3 text-[13px] font-semibold" style={{ color: A.label }}>{row.moduleLabel}</td>
          <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}>{row.boundaryGroup}</td>
          <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}><MiniList items={row.dataUsed} /></td>
          <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}><MiniList items={row.producedInsights} /></td>
          <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}><MiniList items={row.reviewOutputs} /></td>
          <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}><MiniList items={row.downstreamConsumers} /></td>
          <td className="px-3 py-3 text-[12px]" style={{ color: A.blue }}>{row.boundarySummary}</td>
          <td className="px-3 py-3">{row.navigationLinks[0] && <LinkButton link={row.navigationLinks[0]} onNavigate={onNavigate} />}</td>
        </tr>
      ))} />
  );
}

function DocumentMatrix({ payload, onNavigate }: { payload: BoundaryPayload; onNavigate: NavigateFn }) {
  return (
    <MatrixTable title="业务对象边界矩阵" icon={FileText} testId="document-boundary-matrix" headers={["业务对象", "对象分组", "来源模块", "关联模块", "边界归属角色", "证据用途", "AI 用途", "复核用途", "协同用途", "受限用途说明", "跳转"]}
      rows={payload.documentBoundaryMatrix.map((row, index) => (
        <tr key={row.id} style={{ borderTop: index ? `1px solid ${A.border}` : "none" }}>
          <td className="px-3 py-3 text-[13px] font-semibold" style={{ color: A.label }}>{row.objectLabel}</td>
          <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}>{row.objectGroup}</td>
          <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}>{row.sourceModule}</td>
          <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}><MiniList items={row.relatedModules} /></td>
          <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}>{row.boundaryOwnerRole}</td>
          <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}>{row.evidenceUse}</td>
          <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}>{row.aiUse}</td>
          <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}>{row.reviewUse}</td>
          <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}>{row.collaborationUse}</td>
          <td className="px-3 py-3 text-[12px]" style={{ color: A.blue }}>{row.restrictedUseSummary}</td>
          <td className="px-3 py-3">{row.navigationLinks[0] && <LinkButton link={row.navigationLinks[0]} onNavigate={onNavigate} />}</td>
        </tr>
      ))} />
  );
}

function AiBoundary({ payload, onNavigate }: { payload: BoundaryPayload; onNavigate: NavigateFn }) {
  return (
    <Card className="rounded-xl p-4" data-testid="ai-boundary-awareness">
      <SectionHeader icon={Bot} title="AI 边界意识" subtitle="AI 仅基于当前工作区数据、关键证据和数据限制。" />
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {payload.aiBoundaryAwareness.map((item) => (
          <div key={item.id} className="rounded-xl border p-3" style={{ borderColor: A.border }}>
            <div className="text-[13px] font-semibold" style={{ color: A.label }}>{item.signalLabel}</div>
            <div className="mt-2 text-[12px]" style={{ color: A.sub }}>{item.sourceModule} · {item.allowedAiUse}</div>
            <div className="mt-1 text-[12px] leading-5" style={{ color: A.gray1 }}>必要证据：{item.requiredEvidence.join("、")}</div>
            <div className="mt-1 text-[12px] leading-5" style={{ color: A.blue }}>{item.reviewBoundary} · {item.restrictedUseSummary}</div>
            <div className="mt-3">{item.navigationLinks[0] && <LinkButton link={item.navigationLinks[0]} onNavigate={onNavigate} />}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CollaborationPolicies({ payload, onNavigate }: { payload: BoundaryPayload; onNavigate: NavigateFn }) {
  return (
    <Card className="rounded-xl p-4" data-testid="collaboration-boundary-policies">
      <SectionHeader icon={ClipboardCheck} title="协同边界策略" subtitle="从协同通知草稿策略生成，保持草稿预览和人工复核。" />
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {payload.collaborationBoundaryPolicies.map((item) => (
          <div key={item.id} className="rounded-xl border p-3" style={{ borderColor: A.border }}>
            <div className="text-[13px] font-semibold" style={{ color: A.label }}>{item.policyLabel}</div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.sub }}>{item.allowedUse.join("；")}</div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.blue }}>{item.boundarySummary}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip label="草稿预览" color={A.green} bg="#ecfdf5" />
              <Chip label="人工复核" color={A.blue} bg="#eef4ff" />
              {item.navigationLinks[0] && <LinkButton link={item.navigationLinks[0]} onNavigate={onNavigate} />}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RoleBoundary({ payload, onNavigate }: { payload: BoundaryPayload; onNavigate: NavigateFn }) {
  return (
    <Card className="rounded-xl p-4" data-testid="role-boundary-visibility">
      <SectionHeader icon={Eye} title="角色边界可见性" subtitle="从角色权限可见性生成。" />
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {payload.roleBoundaryVisibility.map((role) => (
          <div key={role.id} className="rounded-xl border p-3" style={{ borderColor: A.border }}>
            <div className="text-[13px] font-semibold" style={{ color: A.label }}>{role.roleLabel}</div>
            <div className="mt-1 text-[12px]" style={{ color: A.sub }}>{role.roleGroup}</div>
            <div className="mt-2 text-[12px]" style={{ color: A.gray1 }}>可见边界：<MiniList items={role.visibleBoundaryScopes} /></div>
            <div className="mt-1 text-[12px]" style={{ color: A.gray1 }}>对象边界：<MiniList items={role.documentBoundaryAccess} /></div>
            <div className="mt-1 text-[12px] leading-5" style={{ color: A.blue }}>{role.restrictedBoundarySummary}</div>
            <div className="mt-3">{role.navigationLinks[0] && <LinkButton link={role.navigationLinks[0]} onNavigate={onNavigate} />}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DataQualitySignals({ payload, onNavigate }: { payload: BoundaryPayload; onNavigate: NavigateFn }) {
  return (
    <Card className="rounded-xl p-4" data-testid="data-quality-boundary-signals">
      <SectionHeader icon={DatabaseZap} title="数据质量边界信号" subtitle="从数据接入与质量生成，展示影响边界和建议复核。" />
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {payload.dataQualityBoundarySignals.map((signal) => (
          <div key={signal.id} className="rounded-xl border p-3" style={{ borderColor: A.border }}>
            <div className="text-[13px] font-semibold" style={{ color: A.label }}>{signal.signalLabel}</div>
            <div className="mt-2 text-[12px]" style={{ color: A.sub }}>{signal.sourceModule} · <MiniList items={signal.affectedBoundaryScopes} /></div>
            <div className="mt-1 text-[12px]" style={{ color: A.gray1 }}>影响对象：<MiniList items={signal.affectedObjects} /></div>
            <div className="mt-1 text-[12px] leading-5" style={{ color: A.blue }}>{signal.impactSummary}</div>
            <div className="mt-1 text-[12px] leading-5" style={{ color: A.gray1 }}>{signal.suggestedReview}</div>
            <div className="mt-3">{signal.navigationLinks[0] && <LinkButton link={signal.navigationLinks[0]} onNavigate={onNavigate} />}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BoundaryDrafts({ payload, onNavigate }: { payload: BoundaryPayload; onNavigate: NavigateFn }) {
  function actionLink(draft: BoundaryPayload["boundaryReviewDrafts"][number], action: string): BoundaryNavigationLink {
    if (action === "进入人工复核") return draft.navigationLinks.find((link) => link.moduleId === "review-actions") || { label: action, moduleId: "review-actions" };
    if (action === "打开来源模块") return draft.navigationLinks[0] || { label: action, moduleId: "settings:boundaries" };
    return { label: action, moduleId: "settings:boundaries", entityType: "boundary_review", entityId: draft.id, entityLabel: draft.title };
  }
  return (
    <Card className="rounded-xl p-4" data-testid="boundary-review-drafts">
      <SectionHeader icon={FileCheck2} title="边界复核草稿" subtitle="边界变更只生成复核草稿，不创建或切换工作区，不覆盖当前工作区数据。" />
      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
        {payload.boundaryReviewDrafts.map((draft) => (
          <div key={draft.id} className="rounded-xl border p-3" style={{ borderColor: A.border, background: "#fbfdff" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13px] font-semibold" style={{ color: A.label }}>{draft.title}</div>
              <Chip label={draft.status} color={A.green} bg="#ecfdf5" />
            </div>
            <div className="mt-2 text-[12px]" style={{ color: A.sub }}>{draft.sourceModule} · {draft.targetBoundaryScope} · {draft.targetOwnerRole}</div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.label }}>{draft.conclusion}</div>
            <div className="mt-2 rounded-lg px-3 py-2 text-[12px] leading-5" style={{ background: A.white, color: A.sub }}>{draft.proposedBoundaryPreview}</div>
            <div className="mt-2 text-[12px]" style={{ color: A.gray1 }}>关键证据：{draft.keyEvidence.join("；")}</div>
            <div className="mt-1 text-[12px]" style={{ color: A.gray1 }}>复核清单：{draft.reviewChecklist.join("；")}</div>
            <div className="mt-1 text-[12px]" style={{ color: A.gray1 }}>缺失信息：{draft.missingInformation.join("；")}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["预览边界草稿", "进入人工复核", "标记仅内部留存", "打开来源模块"].map((action, index) => (
                <button key={action} type="button" onClick={() => navigateWithContext(onNavigate, actionLink(draft, action))}
                  className={buttonClass}
                  style={index === 1 ? { background: A.blue, color: A.white } : { background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(15,23,42,0.10)" }}>
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

function DataLimitations({ payload }: { payload: BoundaryPayload }) {
  return (
    <Card className="rounded-xl p-4" data-testid="workspace-boundary-data-limitations">
      <SectionHeader icon={GitBranch} title="数据限制" subtitle="边界判断受当前工作区数据范围影响。" />
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

export function WorkspaceBoundaryVisibilityV2({ payload, onNavigate }: { payload: BoundaryPayload; onNavigate: NavigateFn }) {
  return (
    <div className="space-y-4" data-testid="workspace-boundary-visibility">
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[24px] leading-8 font-bold tracking-normal" style={{ color: A.label }}>系统设置</h1>
          <Chip label="工作区边界" color={A.blue} bg="#eef4ff" />
          <Chip label="当前工作区数据" color={A.green} bg="#ecfdf5" />
        </div>
        <div className="mt-2 max-w-5xl rounded-md px-3 py-2 text-[13px] leading-5" style={{ background: "#eef4ff", color: A.blue }}>
          当前仅展示工作区边界状态，边界变更只生成复核草稿，不创建或切换工作区，数据不搬移，不覆盖当前工作区数据。
        </div>
      </section>
      <SummaryCards payload={payload} />
      <Profile payload={payload} />
      <BoundaryScopes payload={payload} onNavigate={onNavigate} />
      <OwnershipGroups payload={payload} onNavigate={onNavigate} />
      <ModuleMatrix payload={payload} onNavigate={onNavigate} />
      <DocumentMatrix payload={payload} onNavigate={onNavigate} />
      <AiBoundary payload={payload} onNavigate={onNavigate} />
      <CollaborationPolicies payload={payload} onNavigate={onNavigate} />
      <RoleBoundary payload={payload} onNavigate={onNavigate} />
      <DataQualitySignals payload={payload} onNavigate={onNavigate} />
      <BoundaryDrafts payload={payload} onNavigate={onNavigate} />
      <DataLimitations payload={payload} />
    </div>
  );
}
