import { apiJson } from "../api-client";

export type ImportPreviewResponse = {
  ok: boolean; previewId: string; snapshotHash: string; expiresAt: string; normalizedRows: Record<string, unknown>[];
  validationSummary: { totalRows: number; validRows: number; warningRows: number; errorRows: number; duplicateRows: number };
  duplicateRows: number[]; relationshipWarnings: unknown[]; writesFiles: false; writesDb: false;
};
export type ImportCommitResponse = {
  ok: boolean; importBatchId: string; businessObject: string; inserted: number; updated: number; skipped: number; failed: number;
  warnings: unknown[]; auditEventId: string; rollbackAvailable: boolean; committedAt: string; replayed?: boolean;
};
export type ImportBatch = ImportCommitResponse & {
  previewId: string; schemaId: string; originalFileName: string; sheetName: string; status: "committed" | "rolled_back";
  rollbackDeadline?: string; rolledBackAt?: string; persistenceScope?: "process-memory-metadata";
  targetRepositories?: string[]; limitations?: string[];
};

export function previewBusinessImport(input: Record<string, unknown>) {
  return apiJson<ImportPreviewResponse>("/api/imports/preview", { method: "POST", body: JSON.stringify(input) });
}
export function commitBusinessImport(previewId: string, input: Record<string, unknown>) {
  return apiJson<ImportCommitResponse>(`/api/imports/${encodeURIComponent(previewId)}/commit`, { method: "POST", body: JSON.stringify(input) });
}
export function fetchImportBatches() { return apiJson<{ batches: ImportBatch[] }>("/api/import-batches"); }
