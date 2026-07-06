import { ArrowRight, Bot, Boxes, ClipboardCheck, DatabaseZap, FileText, GitBranch, ListChecks, Settings2, ShieldCheck, type LucideIcon } from "lucide-react";
import { A, Card, Chip } from "../../components/ui";
import { typography } from "../../components/ui/typography";
import type {
  WorkspaceAiAssistanceBoundary,
  WorkspaceCollaborationDraftPolicy,
  WorkspaceDataQualitySetting,
  WorkspaceModuleSetting,
  WorkspaceNumberingRule,
  WorkspaceReviewPolicy,
  WorkspaceSetupConfigV2 as WorkspaceSetupConfigPayload,
  WorkspaceSetupNavigationLink,
  WorkspaceSetupReviewDraft,
} from "../../modules/settings/workspaceSetupConfig";

type NavigateFn = (moduleId: string, focusTarget?: { entityType: string; entityId: string } | null, options?: { returnTo?: string; entityLabel?: string; source?: string; returnContext?: unknown }) => void;

const sectionButtonClass = "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold";

function focusFrom(link?: Pick<WorkspaceSetupNavigationLink, "entityType" | "entityId"> | null) {
  if (!link?.entityType || !link.entityId) return null;
  return { entityType: link.entityType, entityId: link.entityId };
}

function settingsReturnContext() {
  return {
    sourceModule: "settings",
    sourceRoute: "settings",
    sourceLabel: "工作区配置",
    returnLabel: "返回工作区配置",
    originIntent: "workspaceSetupConfig",
  };
}

function navigateWithSettingsContext(onNavigate: NavigateFn, link: WorkspaceSetupNavigationLink) {
  onNavigate(link.moduleId, focusFrom(link), {
    returnTo: "settings",
    entityLabel: link.entityLabel || link.label,
    source: "workspaceSetupConfig",
    returnContext: settingsReturnContext(),
  });
}

function LinkButton({ link, onNavigate, tone = "neutral" }: { link: WorkspaceSetupNavigationLink; onNavigate: NavigateFn; tone?: "neutral" | "primary" }) {
  return (
    <button
      type="button"
      onClick={() => navigateWithSettingsContext(onNavigate, link)}
      className={sectionButtonClass}
      style={tone === "primary"
        ? { background: A.blue, color: A.white }
        : { background: "#eef4ff", color: A.blue }}
    >
      {link.label}<ArrowRight size={13} />
    </button>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon size={16} />
          <h2 className={typography.sectionTitle} style={{ color: A.label }}>{title}</h2>
        </div>
        {subtitle && <div className="mt-1 text-[12px] leading-5" style={{ color: A.sub }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function SummaryCards({ payload }: { payload: WorkspaceSetupConfigPayload }) {
  const rows = [
    ["启用模块", payload.summary.enabledModuleCount],
    ["复核优先模块", payload.summary.reviewFirstModuleCount],
    ["草稿边界策略", payload.summary.draftOnlyPolicyCount],
    ["数据质量事项", payload.summary.dataQualityIssueCount],
    ["AI 边界", payload.summary.aiBoundaryCount],
    ["协同草稿策略", payload.summary.collaborationPolicyCount],
    ["配置复核草稿", payload.summary.configDraftCount],
    ["当前状态", payload.summary.setupReadinessLabel],
  ] as const;

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
      {rows.map(([label, value]) => (
        <Card key={label} className="rounded-xl p-3">
          <div className="text-[11px]" style={{ color: A.sub }}>{label}</div>
          <div className="mt-1 truncate text-[20px] font-bold tabular-nums" style={{ color: A.label }}>{value}</div>
        </Card>
      ))}
    </section>
  );
}

function WorkspaceProfile({ payload }: { payload: WorkspaceSetupConfigPayload }) {
  const profile = payload.workspaceProfile;
  const rows = [
    ["工作区名称", profile.workspaceName],
    ["业务范围", profile.businessScopeLabel],
    ["运行模式", profile.operatingModeLabel],
    ["数据范围", profile.dataScopeLabel],
    ["设置状态", profile.setupStatusLabel],
  ] as const;

  return (
    <Card className="rounded-xl p-4">
      <SectionHeader icon={Settings2} title="工作区配置" subtitle="当前工作区数据与业务范围，仅展示配置状态。" />
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg px-3 py-2" style={{ background: A.gray6 }}>
            <div className="text-[11px]" style={{ color: A.gray2 }}>{label}</div>
            <div className="mt-1 text-[13px] font-semibold" style={{ color: A.label }}>{value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ModuleSettings({ items, onNavigate }: { items: WorkspaceModuleSetting[]; onNavigate: NavigateFn }) {
  return (
    <Card className="rounded-xl p-4" data-testid="workspace-module-settings">
      <SectionHeader icon={Boxes} title="模块启用状态" subtitle="每个入口保持当前工作区可见，配置变化只进入复核草稿。" />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[980px] text-left">
          <thead style={{ background: "#fbfdff" }}>
            <tr>
              {["模块名称", "模块分组", "状态", "运行模式", "复核模式", "关键业务对象", "连接洞察", "跳转"].map((header) => (
                <th key={header} className="px-3 py-3 text-[12px] font-semibold" style={{ color: A.gray1 }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} style={{ borderTop: index ? `1px solid ${A.border}` : "none" }}>
                <td className="px-3 py-3 text-[13px] font-semibold" style={{ color: A.label }}>{item.moduleLabel}</td>
                <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}>{item.moduleGroup}</td>
                <td className="px-3 py-3"><Chip label={item.statusLabel} color={A.green} bg="#ecfdf5" /></td>
                <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}>{item.operatingMode}</td>
                <td className="px-3 py-3 text-[12px]" style={{ color: A.blue }}>{item.reviewModeLabel}</td>
                <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}>{item.keyObjects.slice(0, 5).join("、")}</td>
                <td className="px-3 py-3 text-[12px]" style={{ color: A.sub }}>{item.connectedInsights[0]}</td>
                <td className="px-3 py-3">
                  {item.navigationLinks[0] && <LinkButton link={item.navigationLinks[0]} onNavigate={onNavigate} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ReviewPolicies({ items, onNavigate }: { items: WorkspaceReviewPolicy[]; onNavigate: NavigateFn }) {
  return (
    <Card className="rounded-xl p-4" data-testid="workspace-review-policies">
      <SectionHeader icon={ShieldCheck} title="复核策略" subtitle="对行动草稿、协同草稿和配置草稿保持人工复核边界。" />
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {items.slice(0, 6).map((item) => (
          <div key={item.id} className="rounded-xl border p-3" style={{ borderColor: A.border }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13px] font-semibold" style={{ color: A.label }}>{item.policyLabel}</div>
              <Chip label={item.reviewRequirement} color={A.blue} bg="#eef4ff" />
            </div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.sub }}>{item.allowedUse}</div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.gray1 }}>{item.appliesTo.join("、")}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.navigationLinks.slice(0, 1).map((link) => <LinkButton key={`${item.id}-${link.moduleId}`} link={link} onNavigate={onNavigate} />)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function NumberingRules({ items }: { items: WorkspaceNumberingRule[] }) {
  return (
    <Card className="rounded-xl p-4" data-testid="workspace-numbering-rules">
      <SectionHeader icon={GitBranch} title="编号规则" subtitle="只展示当前业务对象编号状态，后续调整进入配置复核。" />
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5 xl:grid-cols-10">
        {items.map((item) => (
          <div key={item.objectType} className="rounded-lg border px-3 py-2" style={{ borderColor: A.border, background: "#fbfdff" }}>
            <div className="text-[12px] font-semibold" style={{ color: A.label }}>{item.objectLabel}</div>
            <div className="mt-1 text-[11px] tabular-nums" style={{ color: A.blue }}>{item.prefix}</div>
            <div className="mt-1 truncate text-[11px]" style={{ color: A.sub }}>{item.example}</div>
            <div className="mt-2 text-[11px]" style={{ color: A.gray2 }}>{item.reviewRequired ? "需人工复核" : item.statusLabel}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DataQualitySettings({ items, onNavigate }: { items: WorkspaceDataQualitySetting[]; onNavigate: NavigateFn }) {
  return (
    <Card className="rounded-xl p-4" data-testid="workspace-data-quality-settings">
      <SectionHeader icon={DatabaseZap} title="数据质量设置" subtitle="对齐数据接入与质量模块，展示字段映射和质量事项影响。" />
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border p-3" style={{ borderColor: A.border }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13px] font-semibold" style={{ color: A.label }}>{item.settingLabel}</div>
              <Chip label={`${item.issueCount} 项`} color={item.issueCount ? A.orange : A.green} bg={item.issueCount ? "#fff7ed" : "#ecfdf5"} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-lg px-2 py-1.5" style={{ background: A.gray6 }}>
                <div className="text-[10px]" style={{ color: A.gray2 }}>映射字段数</div>
                <div className="text-[13px] font-semibold" style={{ color: A.label }}>{item.mappedFieldsCount}</div>
              </div>
              <div className="rounded-lg px-2 py-1.5" style={{ background: A.gray6 }}>
                <div className="text-[10px]" style={{ color: A.gray2 }}>影响模块</div>
                <div className="truncate text-[13px] font-semibold" style={{ color: A.label }}>{item.affectedModules.join("、")}</div>
              </div>
            </div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.sub }}>{item.suggestedReview}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.navigationLinks.slice(0, 1).map((link) => <LinkButton key={`${item.id}-${link.moduleId}`} link={link} onNavigate={onNavigate} tone="primary" />)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AiBoundaries({ items, onNavigate }: { items: WorkspaceAiAssistanceBoundary[]; onNavigate: NavigateFn }) {
  return (
    <Card className="rounded-xl p-4" data-testid="workspace-ai-boundaries">
      <SectionHeader icon={Bot} title="AI 辅助边界" subtitle="AI 仅用于解释、证据整理、草稿预览和人工复核辅助。" />
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border p-3" style={{ borderColor: A.border }}>
            <div className="text-[13px] font-semibold" style={{ color: A.label }}>{item.boundaryLabel}</div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.sub }}>{item.allowedUse}</div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.blue }}>{item.restrictedUseBusinessWording}</div>
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

function CollaborationPolicies({ items, onNavigate }: { items: WorkspaceCollaborationDraftPolicy[]; onNavigate: NavigateFn }) {
  return (
    <Card className="rounded-xl p-4" data-testid="workspace-collaboration-policies">
      <SectionHeader icon={ClipboardCheck} title="协同草稿策略" subtitle="覆盖内部备注、供应商沟通草稿、财务复核说明和数据质量说明。" />
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.channelType} className="rounded-xl border p-3" style={{ borderColor: A.border }}>
            <div className="text-[13px] font-semibold" style={{ color: A.label }}>{item.policyLabel}</div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.sub }}>{item.allowedUse.join("；")}</div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.blue }}>{item.boundarySummary}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip label="草稿预览" color={A.green} bg="#ecfdf5" />
              <Chip label="需人工复核" color={A.blue} bg="#eef4ff" />
              {item.navigationLinks[0] && <LinkButton link={item.navigationLinks[0]} onNavigate={onNavigate} />}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SetupReviewDrafts({ items, onNavigate }: { items: WorkspaceSetupReviewDraft[]; onNavigate: NavigateFn }) {
  function actionLink(draft: WorkspaceSetupReviewDraft, action: string): WorkspaceSetupNavigationLink {
    if (action === "进入人工复核") return draft.navigationLinks.find((link) => link.moduleId === "review-actions") || { label: action, moduleId: "review-actions" };
    if (action === "打开来源模块") return draft.navigationLinks[0] || { label: action, moduleId: "settings" };
    return { label: action, moduleId: "settings", entityType: "workspace_config", entityId: draft.id, entityLabel: draft.title };
  }

  return (
    <Card className="rounded-xl p-4" data-testid="workspace-setup-review-drafts">
      <SectionHeader icon={FileText} title="配置复核草稿" subtitle="配置变更只生成草稿预览，不直接改变业务设置，不覆盖当前工作区数据。" />
      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
        {items.map((draft) => (
          <div key={draft.id} className="rounded-xl border p-3" style={{ borderColor: A.border, background: "#fbfdff" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13px] font-semibold" style={{ color: A.label }}>{draft.title}</div>
              <Chip label={draft.status} color={A.green} bg="#ecfdf5" />
            </div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.sub }}>{draft.conclusion}</div>
            <div className="mt-2 rounded-lg px-3 py-2 text-[12px] leading-5" style={{ color: A.label, background: A.white }}>{draft.proposedConfigPreview}</div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.gray1 }}>证据：{draft.keyEvidence.join("；")}</div>
            <div className="mt-2 text-[12px] leading-5" style={{ color: A.gray1 }}>复核清单：{draft.reviewChecklist.join("；")}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["预览配置草稿", "进入人工复核", "标记仅内部留存", "打开来源模块"].map((action, index) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => navigateWithSettingsContext(onNavigate, actionLink(draft, action))}
                  className={sectionButtonClass}
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

function DataLimitations({ payload }: { payload: WorkspaceSetupConfigPayload }) {
  return (
    <Card className="rounded-xl p-4" data-testid="workspace-data-limitations">
      <SectionHeader icon={ListChecks} title="数据限制" subtitle="这些限制会影响配置状态判断，需要在来源模块继续复核。" />
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

export function WorkspaceSetupConfigV2({ payload, onNavigate }: { payload: WorkspaceSetupConfigPayload; onNavigate: NavigateFn }) {
  return (
    <div className="space-y-4" data-testid="workspace-setup-config">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[24px] leading-8 font-bold tracking-normal" style={{ color: A.label }}>系统设置</h1>
            <Chip label="工作区配置" color={A.blue} bg="#eef4ff" />
            <Chip label="当前工作区数据" color={A.green} bg="#ecfdf5" />
          </div>
          <div className="mt-2 max-w-5xl rounded-md px-3 py-2 text-[13px] leading-5" style={{ background: "#eef4ff", color: A.blue }}>
            本页仅展示配置状态与配置复核草稿，不会直接改变业务设置，不影响正式业务处理，不覆盖当前工作区数据。
          </div>
        </div>
      </section>

      <SummaryCards payload={payload} />
      <WorkspaceProfile payload={payload} />
      <ModuleSettings items={payload.moduleSettings} onNavigate={onNavigate} />
      <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
        <ReviewPolicies items={payload.reviewPolicies} onNavigate={onNavigate} />
        <NumberingRules items={payload.numberingRules} />
      </section>
      <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[0.85fr_1.15fr]">
        <DataQualitySettings items={payload.dataQualitySettings} onNavigate={onNavigate} />
        <AiBoundaries items={payload.aiAssistanceBoundaries} onNavigate={onNavigate} />
      </section>
      <CollaborationPolicies items={payload.collaborationDraftPolicies} onNavigate={onNavigate} />
      <SetupReviewDrafts items={payload.setupReviewDrafts} onNavigate={onNavigate} />
      <DataLimitations payload={payload} />
    </div>
  );
}
