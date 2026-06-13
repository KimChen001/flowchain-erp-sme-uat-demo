import { toast } from "sonner";
import { PRODUCT_NAME } from "./constants";

export function exportModulePdf(moduleLabel: string, company?: string) {
  const source = document.getElementById("module-export-scope");
  if (!source) {
    toast.error("没有可导出的模块内容");
    return;
  }
  const printWindow = window.open("", "_blank", "width=1200,height=900");
  if (!printWindow) {
    toast.error("浏览器阻止了导出窗口", { description: "请允许弹窗后重试。" });
    return;
  }
  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("button,input,textarea,select").forEach((node) => {
    const element = node as HTMLElement;
    if (element.tagName === "BUTTON") element.remove();
    else element.replaceWith(document.createTextNode((element as HTMLInputElement).value || ""));
  });
  const styles = Array.from(document.querySelectorAll("style,link[rel='stylesheet']"))
    .map((node) => node.outerHTML)
    .join("\n");
  const now = new Date().toLocaleString("zh-CN", { hour12: false });
  printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${moduleLabel} 报告</title>
  ${styles}
  <style>
    @page { size: A4; margin: 14mm; }
    body { background: #fff; color: #1d1d1f; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .report-header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px solid #d1d1d6; padding-bottom: 16px; margin-bottom: 18px; }
    .report-title { font-size: 22px; font-weight: 700; letter-spacing: 0; }
    .report-meta { font-size: 11px; color: #86868b; text-align: right; line-height: 1.7; }
    .export-body { max-width: 100%; }
    .export-body * { box-shadow: none !important; }
    .export-body [class*="overflow"] { overflow: visible !important; }
    .export-body table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
    .export-body tr { page-break-inside: avoid; }
    .export-body th, .export-body td { border-bottom: 1px solid rgba(0,0,0,0.08); }
    .export-body .rounded-xl, .export-body .rounded-2xl, .export-body .rounded-lg { border-radius: 8px !important; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <header class="report-header">
    <div>
      <div class="report-title">${moduleLabel} 报告</div>
      <div style="font-size:12px;color:#86868b;margin-top:6px;">${PRODUCT_NAME} · 智能供应链 ERP</div>
    </div>
    <div class="report-meta">
      <div>${company || "新辰智能制造"}</div>
      <div>导出时间：${now}</div>
      <div>来源：当前工作台视图</div>
    </div>
  </header>
  <main class="export-body">${clone.innerHTML}</main>
  <script>
    window.onload = () => {
      setTimeout(() => {
        window.focus();
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`);
  printWindow.document.close();
  toast.success("PDF 导出窗口已打开", { description: "在打印窗口选择“另存为 PDF”。" });
}
