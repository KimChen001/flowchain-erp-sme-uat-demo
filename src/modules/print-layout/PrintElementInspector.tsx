import { Eye, EyeOff, Trash2 } from "lucide-react";
import type { PrintFieldOption, PrintLayoutElement } from "./printLayoutTypes";

const numberKeys = ["x", "y", "width", "height"] as const;

export default function PrintElementInspector({
  elements, selected, fieldOptions, onSelect, onChange, onDelete,
}: {
  elements: PrintLayoutElement[];
  selected?: PrintLayoutElement;
  fieldOptions: PrintFieldOption[];
  onSelect: (id: string) => void;
  onChange: (patch: Partial<PrintLayoutElement>) => void;
  onDelete: () => void;
}) {
  return (
    <aside className="print-layout-inspector" data-testid="print-layout-inspector">
      <div className="print-inspector-section">
        <div className="print-inspector-title">版式元素</div>
        <div className="print-layer-list">
          {elements.map((element) => (
            <button key={element.id} type="button" className={selected?.id === element.id ? "active" : ""} onClick={() => onSelect(element.id)}>
              <span>{element.title}</span>{element.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
          ))}
        </div>
      </div>
      {!selected ? <div className="print-inspector-empty">选择画布元素后编辑属性。</div> : (
        <div className="print-inspector-section print-property-form">
          <div className="print-inspector-title">元素属性</div>
          <label>元素类型<input value={selected.type} disabled /></label>
          <label>元素名称<input data-testid="print-element-name-input" value={selected.title} onChange={(event) => onChange({ title: event.target.value })} /></label>
          {(selected.type === "text" || selected.type === "footer") && (
            <label>{selected.id === "title" ? "自定义标题" : "显示文字"}<input data-testid={selected.id === "title" ? "print-title-input" : "print-value-input"} value={selected.value || ""} onChange={(event) => onChange({ value: event.target.value })} /></label>
          )}
          {(selected.type === "field" || (selected.type === "signature" && selected.field)) && (
            <label>字段绑定<select value={selected.field || ""} onChange={(event) => onChange({ field: event.target.value })}>
              {fieldOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select></label>
          )}
          <div className="print-property-grid">
            {numberKeys.map((key) => (
              <label key={key}>{key}<input data-testid={`print-${key}-input`} type="number" min={0} value={selected[key]} onChange={(event) => onChange({ [key]: Math.max(0, Number(event.target.value)) })} /></label>
            ))}
          </div>
          <label>字号<input data-testid="print-font-size-input" type="number" min={8} max={48} value={selected.style?.fontSize || 12} onChange={(event) => onChange({ style: { ...selected.style, fontSize: Number(event.target.value) } })} /></label>
          <label>对齐<select data-testid="print-align-select" value={selected.style?.align || "left"} onChange={(event) => onChange({ style: { ...selected.style, align: event.target.value as "left" | "center" | "right" } })}>
            <option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option>
          </select></label>
          <label className="print-check"><input type="checkbox" checked={Boolean(selected.style?.bold)} onChange={(event) => onChange({ style: { ...selected.style, bold: event.target.checked } })} />粗体</label>
          <label className="print-check"><input data-testid="print-border-toggle" type="checkbox" checked={Boolean(selected.style?.bordered)} onChange={(event) => onChange({ style: { ...selected.style, bordered: event.target.checked } })} />边框</label>
          <label className="print-check"><input data-testid="print-visible-toggle" type="checkbox" checked={selected.visible} onChange={(event) => onChange({ visible: event.target.checked })} />显示元素</label>
          {selected.type === "table" && (
            <div className="print-column-editor" data-testid="print-column-editor">
              <div className="print-inspector-title">表格列</div>
              {(selected.tableColumns || []).map((column, index) => (
                <div key={column.key} className="print-column-row">
                  <input aria-label={`${column.key}列标题`} value={column.title} onChange={(event) => {
                    const tableColumns = [...(selected.tableColumns || [])]; tableColumns[index] = { ...column, title: event.target.value }; onChange({ tableColumns });
                  }} />
                  <input aria-label={`${column.key}列宽`} type="number" min={40} value={column.width || 80} onChange={(event) => {
                    const tableColumns = [...(selected.tableColumns || [])]; tableColumns[index] = { ...column, width: Number(event.target.value) }; onChange({ tableColumns });
                  }} />
                  <label className="print-check"><input aria-label={`${column.key}列显示`} type="checkbox" checked={column.visible} onChange={(event) => {
                    const tableColumns = [...(selected.tableColumns || [])]; tableColumns[index] = { ...column, visible: event.target.checked }; onChange({ tableColumns });
                  }} />显示</label>
                </div>
              ))}
            </div>
          )}
          {!selected.required && <button type="button" className="print-danger-button" onClick={onDelete}><Trash2 size={13} /> 删除元素</button>}
        </div>
      )}
    </aside>
  );
}
