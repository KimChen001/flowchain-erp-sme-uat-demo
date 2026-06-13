export function fmt(n: number) {
  if (n >= 1e8) return `¥${(n / 1e8).toFixed(2)}亿`;
  if (n >= 1e4) return `¥${(n / 1e4).toFixed(0)}万`;
  return `¥${n.toLocaleString()}`;
}
