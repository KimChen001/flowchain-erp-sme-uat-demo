export type ApiErrorPayload = {
  error?: string;
  message?: string;
  code?: string;
  details?: Array<Record<string, unknown>>;
  entityId?: string;
  currentStatus?: string;
  currentVersion?: number;
  expectedVersion?: number;
};
