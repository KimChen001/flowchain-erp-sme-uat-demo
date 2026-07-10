import type { ImportValidationIssue } from "./importValidationService";

export type ImportTaskStatus = "parsing" | "validating" | "ready" | "importing" | "completed" | "completed_with_warnings" | "failed";
export type ImportTask = {
  importTaskId: string; originalFileName: string; sheetName: string; businessObject: string; sourcePage: string; uploadedBy: string; uploadedAt: string;
  totalRows: number; validRows: number; warningRows: number; errorRows: number; status: ImportTaskStatus; fieldMapping: Record<string, string>;
  validationErrors: ImportValidationIssue[]; validationWarnings: ImportValidationIssue[]; completedAt?: string;
  previewId?: string; snapshotHash?: string; importBatchId?: string; auditEventId?: string; inserted?: number; updated?: number; skipped?: number; rollbackAvailable?: boolean;
};
const STORAGE_KEY = "flowchain:import-tasks:v2";

export function readImportTasks(): ImportTask[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as ImportTask[]; } catch { return []; }
}

export function createImportTask(input: Omit<ImportTask, "importTaskId" | "uploadedAt" | "completedAt" | "status">): ImportTask {
  const existing = readImportTasks();
  const now = new Date();
  const importTaskId = `IMP-${now.getFullYear()}-${String(existing.length + 1).padStart(3, "0")}`;
  const task: ImportTask = { ...input, importTaskId, uploadedAt: now.toISOString(), completedAt: now.toISOString(), status: input.errorRows ? "failed" : input.warningRows ? "completed_with_warnings" : "completed" };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([task, ...existing].slice(0, 100)));
  window.dispatchEvent(new CustomEvent("flowchain:import-task-created", { detail: task }));
  return task;
}

export { STORAGE_KEY as IMPORT_TASK_STORAGE_KEY };
