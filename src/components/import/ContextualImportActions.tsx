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
      description: `${entityLabel} · 请在数据接入与质量中查看校验结果`,
    });
  }

  function downloadTemplate() {
    toast.success("模板已准备", {
      description: `${label} · 失败行可在数据接入与质量中处理`,
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={queueImport}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:opacity-90"
        style={{ background: "#f0f6ff", color: A.blue }}>
        <Upload size={13} /> {compact ? "批量导入" : `批量导入${entityLabel}`}
      </button>
      <button onClick={downloadTemplate}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:opacity-90"
        style={{ background: A.gray6, color: A.gray1 }}>
        <Download size={13} /> {compact ? "下载模板" : `下载${label}模板`}
      </button>
    </div>
  );
}
