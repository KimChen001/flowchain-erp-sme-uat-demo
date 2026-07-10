import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eraser, Printer, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { useUnsavedChanges } from "../../components/navigation/UnsavedChangesProvider";
import PrintCanvas from "./PrintCanvas";
import PrintElementInspector from "./PrintElementInspector";
import PrintInstancePanel, { printInstanceFields } from "./PrintInstancePanel";
import { printFieldOptions } from "./printDataAdapters";
import { clearPrintInstance, loadPrintInstance, savePrintInstance } from "./printInstanceStorage";
import { defaultPrintTemplate } from "./printLayoutPresets";
import { loadLastTemplate, restoreDefaultTemplate, savePrintTemplate, savePrintTemplateAs, templatesFor } from "./printLayoutStorage";
import { PAGE_SIZES, type PrintDocumentData, type PrintDocumentType, type PrintElementType, type PrintLayoutElement, type PrintLayoutTemplate } from "./printLayoutTypes";
import "./print-layout.css";

function instanceElementId(key: string) { return `instance-${key}`; }

function withInstanceFields(template: PrintLayoutTemplate, documentType: PrintDocumentType) {
  const existing = new Set(template.elements.map((element) => element.id));
  const startY = Math.max(template.page.margin + 220, template.page.height - 265);
  const additions = printInstanceFields[documentType]
    .filter((field) => !existing.has(instanceElementId(field.key)))
    .map((field, index): PrintLayoutElement => ({
      id: instanceElementId(field.key), type: "comment", title: field.label, placeholder: `${field.label}（本次打印）`,
      contentMode: "instance", x: template.page.margin, y: startY + index * 54,
      width: template.page.width - template.page.margin * 2, height: 46, visible: true, draggable: true, resizable: true,
      style: { fontSize: 11, lineHeight: 1.45, align: "left", bordered: false },
    }));
  return { ...template, elements: [...template.elements, ...additions] };
}

function createElement(type: PrintElementType, index: number): PrintLayoutElement {
  const definitions: Record<string, { title: string; value?: string; mode?: "static" | "instance"; width: number; height: number }> = {
    text: { title: "自由文本", value: "请输入固定文字", mode: "static", width: 320, height: 54 },
    comment: { title: "Comments", mode: "instance", width: 420, height: 90 },
    remark: { title: "备注", mode: "instance", width: 420, height: 80 },
    terms: { title: "条款", value: "请在此输入固定条款", mode: "static", width: 520, height: 110 },
    signature: { title: "签字栏", value: "签字：________________    日期：____________", mode: "static", width: 460, height: 58 },
    line: { title: "横线", width: 500, height: 20 },
  };
  const definition = definitions[type] || definitions.text;
  return {
    id: `${type}-${Date.now()}-${index}`, type, title: definition.title, value: definition.value,
    placeholder: type === "comment" ? "输入本次打印 Comments" : undefined,
    contentMode: definition.mode, x: 72 + (index % 3) * 18, y: 300 + (index % 6) * 65,
    width: definition.width, height: definition.height, visible: true, draggable: true, resizable: true,
    style: { fontSize: type === "terms" || type === "comment" ? 11 : 12, lineHeight: 1.45, align: "left", bordered: type === "comment" },
  };
}

export default function PrintLayoutEditor({ open, documentType, documentNo, data, onClose }: {
  open: boolean;
  documentType: PrintDocumentType;
  documentNo: string;
  data: PrintDocumentData;
  onClose: () => void;
}) {
  const [template, setTemplate] = useState<PrintLayoutTemplate>(() => withInstanceFields(defaultPrintTemplate(documentType), documentType));
  const [selectedId, setSelectedId] = useState("title");
  const [availableTemplates, setAvailableTemplates] = useState<PrintLayoutTemplate[]>([]);
  const [instanceValues, setInstanceValues] = useState<Record<string, string>>({});
  const [savedTemplateSnapshot, setSavedTemplateSnapshot] = useState("");
  const [savedInstanceSnapshot, setSavedInstanceSnapshot] = useState("{}");
  const [closePrompt, setClosePrompt] = useState(false);

  useEffect(() => {
    if (!open) return;
    const loaded = withInstanceFields(loadLastTemplate(documentType), documentType);
    const instance = loadPrintInstance(documentType, documentNo);
    setTemplate(loaded);
    setInstanceValues(instance.values);
    setSavedTemplateSnapshot(JSON.stringify(loaded));
    setSavedInstanceSnapshot(JSON.stringify(instance.values));
    setAvailableTemplates(templatesFor(documentType));
    setSelectedId("title");
    setClosePrompt(false);
  }, [documentNo, documentType, open]);

  const selected = useMemo(() => template.elements.find((element) => element.id === selectedId), [selectedId, template.elements]);
  const templateDirty = Boolean(open && savedTemplateSnapshot && JSON.stringify(template) !== savedTemplateSnapshot);
  const instanceDirty = Boolean(open && JSON.stringify(instanceValues) !== savedInstanceSnapshot);
  const anyDirty = templateDirty || instanceDirty;

  function updateElement(id: string, patch: Partial<PrintLayoutElement>) {
    setTemplate((current) => ({ ...current, elements: current.elements.map((element) => element.id === id ? { ...element, ...patch } : element) }));
  }

  function changeSelected(patch: Partial<PrintLayoutElement>) {
    if (!selected) return;
    if (patch.contentMode === "instance" && !instanceValues[selected.id] && selected.value) {
      setInstanceValues((current) => ({ ...current, [selected.id]: selected.value || "" }));
      patch = { ...patch, value: "" };
    }
    updateElement(selected.id, patch);
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

  function saveTemplate() {
    const saved = savePrintTemplate(template.isDefault ? { ...template, id: `${documentType}-custom`, isDefault: false } : template);
    setTemplate(saved);
    setSavedTemplateSnapshot(JSON.stringify(saved));
    setAvailableTemplates(templatesFor(documentType));
    toast.success("打印模板已保存", { description: "本次打印内容未随模板保存。" });
  }

  function saveInstance() {
    const saved = savePrintInstance(documentType, documentNo, instanceValues);
    setSavedInstanceSnapshot(JSON.stringify(saved.values));
    toast.success("本次打印内容已保存", { description: `仅适用于 ${documentNo}` });
  }

  function saveAll() {
    if (templateDirty) saveTemplate();
    if (instanceDirty) saveInstance();
  }

  useUnsavedChanges({
    key: `print-layout:${documentType}:${documentNo}`,
    label: `${documentNo} ${[templateDirty ? "模板" : "", instanceDirty ? "本次打印内容" : ""].filter(Boolean).join("和")}`,
    dirty: anyDirty,
    onSave: saveAll,
  });

  function saveAs() {
    const saved = savePrintTemplateAs(template);
    setTemplate(saved); setSavedTemplateSnapshot(JSON.stringify(saved)); setAvailableTemplates(templatesFor(documentType));
    toast.success("已另存为新模板");
  }

  function restore() {
    const restored = withInstanceFields(restoreDefaultTemplate(documentType), documentType);
    setTemplate(restored); setSavedTemplateSnapshot(JSON.stringify(restored)); setAvailableTemplates(templatesFor(documentType)); setSelectedId("title");
    toast.success("已恢复默认模板", { description: "当前单据的本次打印内容已保留。" });
  }

  function addElement(type: PrintElementType | "remark") {
    const element = createElement(type === "remark" ? "comment" : type, template.elements.length);
    if (type === "remark") element.title = "备注";
    setTemplate((current) => ({ ...current, elements: [...current.elements, element] }));
    setSelectedId(element.id);
  }

  function requestClose() {
    if (anyDirty) setClosePrompt(true);
    else onClose();
  }

  function clearInstance() {
    clearPrintInstance(documentType, documentNo);
    setInstanceValues({});
    setSavedInstanceSnapshot("{}");
    toast.success("已清除本次打印内容", { description: "打印模板未受影响。" });
  }

  if (!open) return null;
  const scale = template.page.orientation === "portrait" ? 0.62 : 0.58;

  return (
    <div className="print-layout-editor" data-testid="print-layout-editor" role="dialog" aria-modal="true" aria-label={`${documentNo} 打印版式编辑`}>
      <style>{`@media print { @page { size: A4 ${template.page.orientation}; margin: 0; } }`}</style>
      <header className="print-layout-toolbar">
        <div className="print-toolbar-group">
          <button type="button" onClick={requestClose}><ArrowLeft size={15} /> 返回单据</button>
          <strong>{documentNo}</strong>
          {templateDirty && <span className="print-dirty-chip">模板未保存</span>}
          {instanceDirty && <span className="print-dirty-chip">本次内容未保存</span>}
        </div>
        <div className="print-toolbar-group print-template-controls">
          <input aria-label="模板名称" value={template.name} onChange={(event) => setTemplate((current) => ({ ...current, name: event.target.value }))} />
          <select aria-label="模板选择" value={template.id} onChange={(event) => {
            const selectedTemplate = availableTemplates.find((item) => item.id === event.target.value);
            if (selectedTemplate) {
              const next = withInstanceFields(structuredClone(selectedTemplate), documentType);
              setTemplate(next); setSavedTemplateSnapshot(JSON.stringify(next)); setSelectedId("title");
            }
          }}>{availableTemplates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <div className="print-orientation-toggle">
            <button type="button" className={template.page.orientation === "portrait" ? "active" : ""} onClick={() => changeOrientation("portrait")}>A4 竖版</button>
            <button type="button" className={template.page.orientation === "landscape" ? "active" : ""} onClick={() => changeOrientation("landscape")}>A4 横版</button>
          </div>
        </div>
        <div className="print-toolbar-group">
          <button type="button" onClick={saveTemplate}><Save size={14} /> 保存模板</button>
          <button type="button" onClick={saveAs}>另存为模板</button>
          <button type="button" onClick={restore}><RotateCcw size={14} /> 恢复默认模板</button>
          <button type="button" onClick={saveInstance}><Save size={14} /> 保存本次打印内容</button>
          <button type="button" onClick={clearInstance}><Eraser size={14} /> 清除本次打印内容</button>
          <button type="button" className="primary" data-testid="print-document-button" onClick={() => window.print()}><Printer size={14} /> 打印</button>
        </div>
      </header>
      <div className="print-component-toolbar" aria-label="添加打印元素">
        <button type="button" onClick={() => addElement("text")}>添加文本</button>
        <button type="button" onClick={() => addElement("comment")}>添加 Comments</button>
        <button type="button" onClick={() => addElement("remark")}>添加备注</button>
        <button type="button" onClick={() => addElement("terms")}>添加条款</button>
        <button type="button" onClick={() => addElement("signature")}>添加签字栏</button>
        <button type="button" onClick={() => addElement("line")}>添加横线</button>
      </div>
      <div className="print-layout-workspace">
        <main className="print-canvas-stage">
          <div className="print-paper-label">A4 {template.page.orientation === "portrait" ? "竖版" : "横版"} · 拖拽元素或使用右侧数值精确调整</div>
          <PrintCanvas template={template} data={data} instanceValues={instanceValues} selectedId={selectedId} scale={scale} onSelect={setSelectedId} onElementChange={updateElement} />
        </main>
        <aside className="print-layout-sidepanels">
          <PrintInstancePanel documentType={documentType} values={instanceValues} onChange={(key, value) => setInstanceValues((current) => ({ ...current, [instanceElementId(key)]: value }))} />
          <PrintElementInspector
            elements={template.elements}
            selected={selected}
            fieldOptions={printFieldOptions[documentType]}
            instanceValue={selected ? instanceValues[selected.id] : ""}
            onSelect={setSelectedId}
            onChange={changeSelected}
            onInstanceValueChange={(value) => selected && setInstanceValues((current) => ({ ...current, [selected.id]: value }))}
            onDelete={() => selected && !selected.required && (() => {
              setTemplate((current) => ({ ...current, elements: current.elements.filter((element) => element.id !== selected.id) }));
              setInstanceValues((current) => { const next = { ...current }; delete next[selected.id]; return next; });
              setSelectedId("");
            })()}
          />
        </aside>
      </div>
      {closePrompt && <div className="print-unsaved-backdrop" data-testid="print-unsaved-dialog">
        <div className="print-unsaved-dialog">
          <h2>当前修改尚未保存</h2>
          <p>{templateDirty ? "打印模板有未保存修改。" : ""}{instanceDirty ? "本次打印内容有未保存修改。" : ""}</p>
          <div>
            <button type="button" onClick={() => setClosePrompt(false)}>继续编辑</button>
            <button type="button" className="danger" onClick={onClose}>放弃修改</button>
            <button type="button" className="primary" onClick={() => { saveAll(); onClose(); }}>保存并离开</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
