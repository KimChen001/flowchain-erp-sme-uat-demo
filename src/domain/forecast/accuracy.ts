const forecastColors = {
  green: "#34c759",
  blue: "#0071e3",
  orange: "#ff9500",
  red: "#ff3b30",
};

// Lewis (1982) industry standard MAPE bands.
export function mapeGrade(mape: number): { grade: string; color: string; band: string } {
  if (mape < 10) return { grade: "A", color: forecastColors.green,  band: "高度精确" };
  if (mape < 20) return { grade: "B", color: forecastColors.blue,   band: "良好" };
  if (mape < 50) return { grade: "C", color: forecastColors.orange, band: "合理" };
  return                  { grade: "D", color: forecastColors.red,    band: "不准确" };
}

// Coefficient-of-Variation based forecastability (XYZ classification).
export function xyzClass(history: number[]): { cls: "X" | "Y" | "Z"; cov: number; note: string; color: string } {
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const std  = Math.sqrt(history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length);
  const cov  = std / mean;
  if (cov < 0.25) return { cls: "X", cov, color: forecastColors.green,  note: "需求平稳 · 易预测" };
  if (cov < 0.50) return { cls: "Y", cov, color: forecastColors.orange, note: "中度波动 · 可预测" };
  return                   { cls: "Z", cov, color: forecastColors.red,    note: "高度不规则 · 难预测" };
}

// Z-score for normal distribution at a service level alpha.
export function zScore(serviceLevel: number): number {
  const table: Record<number, number> = { 50: 0, 80: 0.84, 85: 1.04, 90: 1.28, 95: 1.65, 97: 1.88, 98: 2.05, 99: 2.33, 99.5: 2.58 };
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  for (const k of keys) if (Math.abs(k - serviceLevel) < 0.01) return table[k];
  return 1.65;
}
