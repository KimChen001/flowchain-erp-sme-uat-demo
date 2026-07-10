import { defaultPrintTemplate } from "./printLayoutPresets";
import type { PrintDocumentType, PrintLayoutTemplate } from "./printLayoutTypes";

const TEMPLATES_KEY = "flowchain.print-layout.templates.v1";
const LAST_KEY = "flowchain.print-layout.last.v1";

function readStored(): PrintLayoutTemplate[] {
  try {
    const value = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function templatesFor(type: PrintDocumentType): PrintLayoutTemplate[] {
  const preset = defaultPrintTemplate(type);
  const stored = readStored().filter((item) => item.documentType === type);
  return [preset, ...stored.filter((item) => item.id !== preset.id)];
}

export function loadLastTemplate(type: PrintDocumentType): PrintLayoutTemplate {
  const templates = templatesFor(type);
  try {
    const last = JSON.parse(localStorage.getItem(LAST_KEY) || "{}") as Partial<Record<PrintDocumentType, string>>;
    return structuredClone(templates.find((item) => item.id === last[type]) || templates.find((item) => !item.isDefault) || templates[0]);
  } catch {
    return structuredClone(templates[0]);
  }
}

export function savePrintTemplate(template: PrintLayoutTemplate): PrintLayoutTemplate {
  const saved = { ...structuredClone(template), isDefault: false, updatedAt: new Date().toISOString(), version: template.version + 1 };
  const all = readStored().filter((item) => item.id !== saved.id);
  all.push(saved);
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(all));
  const last = (() => { try { return JSON.parse(localStorage.getItem(LAST_KEY) || "{}"); } catch { return {}; } })();
  localStorage.setItem(LAST_KEY, JSON.stringify({ ...last, [saved.documentType]: saved.id }));
  return saved;
}

export function savePrintTemplateAs(template: PrintLayoutTemplate): PrintLayoutTemplate {
  return savePrintTemplate({ ...template, id: `${template.documentType}-${Date.now()}`, name: `${template.name} 副本`, isDefault: false, version: 0 });
}

export function restoreDefaultTemplate(type: PrintDocumentType): PrintLayoutTemplate {
  const last = (() => { try { return JSON.parse(localStorage.getItem(LAST_KEY) || "{}"); } catch { return {}; } })();
  delete last[type];
  localStorage.setItem(LAST_KEY, JSON.stringify(last));
  return defaultPrintTemplate(type);
}
