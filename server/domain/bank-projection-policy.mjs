const SECRET_KEYS = new Set([
  "password", "passwd", "secret", "clientsecret", "apisecret", "token", "accesstoken",
  "refreshtoken", "privatekey", "certificate", "credential", "pin", "signingkey",
  "bankpassword", "onlinebankingpassword", "密码", "口令", "密钥", "令牌", "凭证", "私钥",
]);

const AMOUNT_TERMS = ["amount", "debit", "credit", "balance", "fee", "金额", "借方", "贷方", "余额", "手续费"];
const PARTNER_TERMS = ["counterparty", "partner", "customer", "supplier", "accountholder", "payee", "payer", "对方", "客户", "供应商", "户名", "收款人", "付款人"];
const ACCOUNT_TERMS = ["account", "iban", "swift", "bankreference", "customerreference", "账号", "账户", "银行参考", "客户参考"];
const HASH_TERMS = ["hash", "fingerprint", "checksum", "摘要哈希", "指纹"];

export const BANK_DATA_CLASSIFICATIONS = Object.freeze([
  "public_metadata", "business_identifier", "finance_amount", "partner_identity",
  "bank_account_identifier", "raw_import_data", "internal_hash", "secret", "audit_metadata",
]);

export function normalizeBankFieldKey(value) {
  return String(value ?? "").normalize("NFKC").replace(/([a-z0-9])([A-Z])/g, "$1$2").toLowerCase().replace(/[_\-\s.\[\]]+/g, "");
}

function includesAny(value, terms) { return terms.some((term) => value.includes(normalizeBankFieldKey(term))); }

export function classifyBankField(key, semantic = "") {
  const normalizedKey = normalizeBankFieldKey(key), normalizedSemantic = normalizeBankFieldKey(semantic);
  const value = `${normalizedKey}${normalizedSemantic}`;
  if ([...SECRET_KEYS].some((term) => { const normalized = normalizeBankFieldKey(term); return normalized.length <= 3 ? normalizedKey === normalized || normalizedSemantic === normalized : value.includes(normalized); })) return "secret";
  if (includesAny(value, HASH_TERMS)) return "internal_hash";
  if (includesAny(value, AMOUNT_TERMS)) return "finance_amount";
  if (includesAny(value, PARTNER_TERMS)) return "partner_identity";
  if (includesAny(value, ACCOUNT_TERMS)) return "bank_account_identifier";
  if (includesAny(value, ["duplicatesource", "detectedby", "decision", "status", "sourceRowNumber"])) return "audit_metadata";
  if (includesAny(value, ["id", "number", "reference", "编号", "单号"])) return "business_identifier";
  return "raw_import_data";
}

export function bankActorVisibility(actor = {}) {
  const permissions = actor.permissionCodes instanceof Set ? actor.permissionCodes : new Set(actor.permissionCodes || []);
  const amounts = permissions.has("finance.amounts.read");
  const partner = permissions.has("finance.partner_snapshot.read");
  return {
    amounts,
    partner,
    fieldVisibility: {
      finance_amounts: { visible: amounts, permission: "finance.amounts.read", redacted: !amounts },
      finance_partner_snapshot: { visible: partner, permission: "finance.partner_snapshot.read", redacted: !partner },
      internal_hash: { visible: false, redacted: true },
      secret: { visible: false, redacted: true },
    },
  };
}

function semanticIndex(columnMapping = {}) {
  const result = new Map();
  for (const [semantic, column] of Object.entries(columnMapping || {})) {
    if (Array.isArray(column)) for (const item of column) result.set(normalizeBankFieldKey(item), semantic);
    else result.set(normalizeBankFieldKey(column), semantic);
  }
  return result;
}

function sanitize(value, { visibility, semantics, path = "", redacted, override = false }) {
  if (Array.isArray(value)) return value.map((item, index) => sanitize(item, { visibility, semantics, path: `${path}[${index}]`, redacted, override }));
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    const semantic = semantics.get(normalizeBankFieldKey(key)) || key;
    const classification = classifyBankField(key, semantic);
    if (classification === "secret" || classification === "internal_hash") { redacted.push(childPath); continue; }
    if (classification === "finance_amount" && !visibility.amounts) { result[key] = null; redacted.push(childPath); continue; }
    if (["partner_identity", "bank_account_identifier"].includes(classification) && !visibility.partner) { result[key] = null; redacted.push(childPath); continue; }
    if (classification === "raw_import_data") {
      if (override && ["reason", "conclusion", "decision", "message"].includes(normalizeBankFieldKey(key))) result[key] = typeof child === "string" ? child.slice(0, 2000) : child;
      else if (child && typeof child === "object") result[key] = sanitize(child, { visibility, semantics, path: childPath, redacted, override });
      else { result[key] = null; redacted.push(childPath); }
      continue;
    }
    result[key] = child && typeof child === "object" ? sanitize(child, { visibility, semantics, path: childPath, redacted, override }) : child;
  }
  return result;
}

export function sanitizeBankImportRawData({ rawData, columnMapping = {}, actorVisibility }) {
  const redactedFields = [];
  const value = sanitize(rawData || {}, { visibility: actorVisibility, semantics: semanticIndex(columnMapping), redacted: redactedFields });
  return { value, rawDataVisibility: redactedFields.length ? "redacted" : "visible", redactedFields, limitations: redactedFields.length ? ["Sensitive and unknown import fields are redacted by current permissions."] : [] };
}

export function sanitizeBankOverrideData({ overrideData, columnMapping = {}, actorVisibility }) {
  const redactedFields = [];
  const value = sanitize(overrideData || null, { visibility: actorVisibility, semantics: semanticIndex(columnMapping), redacted: redactedFields, override: true });
  return { value, redactedFields, limitations: redactedFields.length ? ["Historical override values use current actor permissions."] : [] };
}

export function findBankMappingSecretPaths(value, path = "") {
  const result = [];
  if (Array.isArray(value)) value.forEach((item, index) => result.push(...findBankMappingSecretPaths(item, `${path}[${index}]`)));
  else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (classifyBankField(key) === "secret") result.push(childPath);
    else result.push(...findBankMappingSecretPaths(child, childPath));
  } else if (typeof value === "string" && /(?:password|passwd|client[_\-\s]?secret|api[_\-\s]?secret|access[_\-\s]?token|refresh[_\-\s]?token|private[_\-\s]?key|密码|口令|私钥|令牌)\s*[:=]/iu.test(value)) result.push(path || "$");
  return result;
}

export function sanitizeBankMappingConfiguration(value) {
  if (Array.isArray(value)) return value.map(sanitizeBankMappingConfiguration);
  if (typeof value === "string" && findBankMappingSecretPaths(value).length) return null;
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (["secret", "internal_hash"].includes(classifyBankField(key))) continue;
    result[key] = sanitizeBankMappingConfiguration(child);
  }
  return result;
}

export function assertSafeBankMappingConfiguration(value) {
  const paths = findBankMappingSecretPaths(value);
  if (paths.length) {
    const error = new Error("Credentials and secret-like fields cannot be stored in bank mapping configuration.");
    error.code = "BANK_MAPPING_SECRET_FIELD_FORBIDDEN";
    error.status = 422;
    error.details = { paths, guidance: "Store credentials in an approved secret manager, not mapping metadata." };
    throw error;
  }
}
