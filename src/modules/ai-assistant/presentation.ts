const JSON_LIKE_START = /^[\s\r\n]*[\[{]/;
const DEBUG_LINE = /^(intent|cards|evidence|provider|model|tool|schema)\s*[:=]/i;

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

export function sanitizeAiMessage(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(/```(?:json)?/gi, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s{0,3}#{1,6}\s+/, "").trimEnd())
    .filter((line) => !DEBUG_LINE.test(line.trim()))
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
