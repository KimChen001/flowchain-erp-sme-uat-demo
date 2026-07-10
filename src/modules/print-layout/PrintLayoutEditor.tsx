import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import PrintCanvas from "./PrintCanvas";
import PrintElementInspector from "./PrintElementInspector";
import { printFieldOptions } from "./printDataAdapters";
import { defaultPrintTemplate } from "./printLayoutPresets";
import { loadLastTemplate, restoreDefaultTemplate, savePrintTemplate, savePrintTemplateAs, templatesFor } from "./printLayoutStorage";
import { PAGE_SIZES, type PrintDocumentData, type PrintDocumentType, type PrintLayoutElement, type PrintLayoutTemplate } from "./printLayoutTypes";
import "./print-layout.css";

export default function PrintLayoutEditor({ open, documentType, documentNo, data, onClose }: {
  open: boolean;
  documentType: PrintDocumentType;
  documentNo: string;
  data: PrintDocumentData;
  onClose: () => void;
}) {
  const [template, setTemplate] = useState<PrintLayoutTemplate>(() => defaultPrintTemplate(documentType));
  const [selectedId, setSelectedId] = useState("title");
  const [availableTemplates, setAvailableTemplates] = useState<PrintLayoutTemplate[]>([]);

  useEffect(() => {
    if (!open) return;
    const loaded = loadLastTemplate(documentType);
    setTemplate(loaded);
    setAvailableTemplates(templatesFor(documentType));
    setSelectedId("title");
  }, [documentType, open]);

  const selected = useMemo(() => template.elements.find((element) => element.id === selectedId), [selectedId, template.elements]);
  if (!open) return null;
  const scale = template.page.orientation === "portrait" ? 0.62 : 0.58;

  function updateElement(id: string, patch: Partial<PrintLayoutElement>) {
    setTemplate((current) => ({ ...current, elements: current.elements.map((element) => element.id === id ? { ...element, ...patch } : element) }));
  }

  function changeOrientation(orientation: "portrait" | "landscape") {
    if (template.page.orientation === orientation) return;
    const nextSize = PAGE_SIZES[orientation];
    const xRatio = nextSize.width / template.page.width;
    const yRatio = nextSize.height / template.page.height;
    setTemplate((current) => ({
      ...current,
      page: { ...current.page, orientation, ...nextSize },
      elements: current.elements.map((element) => ({
        ...element,
        x: Math.round(element.x * xRatio), y: Math.round(element.y * yRatio),
        width: Math.max(40, Math.min(nextSize.width, Math.round(element.width * xRatio))),
        height: Math.max(20, Math.min(nextSize.height, Math.round(element.height * yRatio))),
      })),
    }));
  }

  function save() {
    const saved = savePrintTemplate(template.isDefault ? { ...template, id: `${documentType}-custom`, isDefault: false } : template);
    setTemplate(saved); setAvailableTemplates(templatesFor(documentType)); toast.success("打印模板已保存");
  }

  function saveAs() {
    const saved = savePrintTemplateAs(template); setTemplate(saved); setAvailableTemplates(templatesFor(documentType)); toast.success("已另存为新模板");
  }

  function restore() {
    const restored = restoreDefaultTemplate(documentType); setTemplate(restored); setAvailableTemplates(templatesFor(documentType)); setSelectedId("title"); toast.success("已恢复默认模板");
  }

  return (
    <div className="print-layout-editor" data-testid="print-layout-editor" role="dialog" aria-modal="true" aria-label={`${documentNo} 打印版式编辑`}>
      <style>{`@media print { @page { size: A4 ${template.page.orientation}; margin: 0; } }`}</style>
      <header className="print-layout-toolbar">
        <div className="print-toolbar-group">
          <button type="button" onClick={onClose}><ArrowLeft size={15} /> 返回单据</button>
          <strong>{documentNo}</strong>
        </div>
        <div className="print-toolbar-group print-template-controls">
          <input aria-label="模板名称" value={template.name} onChange={(event) => setTemplate((current) => ({ ...current, name: event.target.value }))} />
          <select aria-label="模板选择" value={template.id} onChange={(event) => {
            const next = availableTemplates.find((item) => item.id === event.target.value); if (next) { setTemplate(structuredClone(next)); setSelectedId("title"); }
          }}>{availableTemplates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <div className="print-orientation-toggle">
            <button type="button" className={template.page.orientation === "portrait" ? "active" : ""} onClick={() => changeOrientation("portrait")}>A4 竖版</button>
            <button type="button" className={template.page.orientation === "landscape" ? "active" : ""} onClick={() => changeOrientation("landscape")}>A4 横版</button>
          </div>
        </div>
        <div className="print-toolbar-group">
          <button type="button" onClick={save}><Save size={14} /> 保存模板</button>
          <button type="button" onClick={saveAs}>另存为</button>
          <button type="button" onClick={restore}><RotateCcw size={14} /> 恢复默认</button>
          <button type="button" className="primary" data-testid="print-document-button" onClick={() => window.print()}><Printer size={14} /> 打印</button>
        </div>
      </header>
      <div className="print-layout-workspace">
        <main className="print-canvas-stage">
          <div className="print-paper-label">A4 {template.page.orientation === "portrait" ? "竖版" : "横版"} · 拖拽元素或使用右侧数值精确调整</div>
          <PrintCanvas template={template} data={data} selectedId={selectedId} scale={scale} onSelect={setSelectedId} onElementChange={updateElement} />
        </main>
        <PrintElementInspector
          elements={template.elements}
          selected={selected}
          fieldOptions={printFieldOptions[documentType]}
          onSelect={setSelectedId}
          onChange={(patch) => selected && updateElement(selected.id, patch)}
          onDelete={() => selected && !selected.required && setTemplate((current) => ({ ...current, elements: current.elements.filter((element) => element.id !== selected.id) }))}
        />
      </div>
    </div>
  );
}
