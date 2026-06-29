export function formatNumberAmount(value: number | null | undefined, options: Intl.NumberFormatOptions = {}) {
  const amount = Number(value || 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    ...options,
  }).format(safeAmount);
}

export function formatCurrencyAmount(value: number | null | undefined) {
  return `¥${formatNumberAmount(value)}`;
}

export function fmt(n: number | null | undefined) {
  return formatCurrencyAmount(n);
}
