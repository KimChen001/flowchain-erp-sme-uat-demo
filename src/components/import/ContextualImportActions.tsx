import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { A } from "../ui";

type ContextualImportActionsProps = {
  entityLabel: string;
  templateName?: string;
  compact?: boolean;
};

export default function ContextualImportActions({ entityLabel, templateName, compact = false }: ContextualImportActionsProps) {
  const label = templateName || entityLabel;

  function queueImport() {
    toast.success("导入任务已进入校验队列", {
      description: `${entityLabel} CSV · 进入数据接入与质量进行导入前校验`,
    });
  }

  function downloadTemplate() {
    toast.success("模板已准备", {
      description: `${label} CSV · 字段映射和失败项可在数据接入与质量中复核`,
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={queueImport}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:opacity-90"
        style={{ background: "#f0f6ff", color: A.blue }}>
        <Upload size={13} /> {compact ? "进入导入前校验" : `导入${entityLabel} CSV`}
      </button>
      <button onClick={downloadTemplate}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:opacity-90"
        style={{ background: A.gray6, color: A.gray1 }}>
        <Download size={13} /> {compact ? "下载 CSV 模板" : `下载${label} CSV 模板`}
      </button>
    </div>
  );
}
