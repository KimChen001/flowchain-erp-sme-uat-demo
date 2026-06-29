const JSON_LIKE_START = /^[\s\r\n]*[\[{]/;
const DEBUG_LINE = /^(intent|cards|evidence|provider|model|tool|schema)\s*[:=]/i;
const AMOUNT_LABEL = /(金额|余额|应付|贷项|差异|订单金额|发票金额|合同金额|采购额)/;
const WAN_AMOUNT = /^¥?\s*(-?\d+(?:\.\d+)?)\s*万$/;

export function looksLikeRawJson(value: unknown) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!JSON_LIKE_START.test(trimmed)) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function parsesAsJsonLine(value: string) {
  const trimmed = value.trim();
  if (!JSON_LIKE_START.test(trimmed)) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeAiMessage(value: unknown) {
  if (typeof value !== "string") return "";
  const lines = value.split(/\r?\n/);
  let inDebugFence = false;
  return lines
    .filter((line) => {
      const trimmed = line.trim();
      if (/^```/.test(trimmed)) {
        inDebugFence = !inDebugFence;
        return false;
      }
      if (inDebugFence) return false;
      if (DEBUG_LINE.test(trimmed)) return false;
      if (parsesAsJsonLine(trimmed)) return false;
      return true;
    })
    .map((line) => line.replace(/^\s{0,3}#{1,6}\s+/, "").trimEnd())
    .join("\n")
    .trim();
}

export function aiDisplayMessage(value: unknown, hasCards = false) {
  if (looksLikeRawJson(value)) {
    return hasCards
      ? "已找到相关业务记录，请查看下方结果。"
      : "AI 助手暂时无法整理该结果，请换一种问法。";
  }
  return sanitizeAiMessage(value) || "已收到请求，但当前没有可展示的回复。";
}

export function safeUnknownCardMessage() {
  return "暂不支持展示该结果类型。";
}

export function normalizeAiCardValue(label: string, value: unknown) {
  if (typeof value !== "string" || !AMOUNT_LABEL.test(label)) return value;
  const match = value.trim().match(WAN_AMOUNT);
  if (!match) return value;
  const amount = Number(match[1]) * 10000;
  if (!Number.isFinite(amount)) return value;
  return `¥${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount)}`;
}
