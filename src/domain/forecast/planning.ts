export type Method = "naive" | "sma" | "ses" | "holt" | "hw";

export const METHOD_LABEL: Record<Method, string> = {
  naive: "朴素法 (Naive)",
  sma:   "移动平均 (SMA-3)",
  ses:   "一次指数平滑 (SES)",
  holt:  "Holt 双参数 (含趋势)",
  hw:    "Holt-Winters (含趋势+季节)",
};

export type ForecastResult = {
  fitted: (number | null)[];
  forecast: number[];
  mape: number;
  rmse: number;
  mae: number;
  bias: number;
  wmape: number;
  smape: number;
  trackingSignal: number;
  theilU: number;
};

export function runForecast(
  history: number[], method: Method,
  params: { alpha: number; beta: number; gamma: number; season: number },
  horizon: number
): ForecastResult {
  const { alpha, beta, gamma, season } = params;
  const n = history.length;
  const fitted: (number | null)[] = Array(n).fill(null);
  const forecast: number[] = [];

  if (method === "naive") {
    for (let i = 1; i < n; i++) fitted[i] = history[i - 1];
    for (let h = 0; h < horizon; h++) forecast.push(history[n - 1]);
  } else if (method === "sma") {
    const w = 3;
    for (let i = w; i < n; i++) {
      fitted[i] = (history[i - 1] + history[i - 2] + history[i - 3]) / w;
    }
    const last3 = (history[n - 1] + history[n - 2] + history[n - 3]) / w;
    for (let h = 0; h < horizon; h++) forecast.push(last3);
  } else if (method === "ses") {
    let level = history[0];
    fitted[0] = level;
    for (let i = 1; i < n; i++) {
      level = alpha * history[i] + (1 - alpha) * level;
      fitted[i] = level;
    }
    for (let h = 0; h < horizon; h++) forecast.push(level);
  } else if (method === "holt") {
    let level = history[0];
    let trend = history[1] - history[0];
    fitted[0] = level;
    for (let i = 1; i < n; i++) {
      const prevLevel = level;
      level = alpha * history[i] + (1 - alpha) * (level + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
      fitted[i] = level + trend;
    }
    for (let h = 1; h <= horizon; h++) forecast.push(level + h * trend);
  } else if (method === "hw") {
    const seasonals: number[] = Array(season).fill(0);
    let level = history.slice(0, season).reduce((a, b) => a + b, 0) / season;
    let trend = (history.slice(season, season * 2).reduce((a, b) => a + b, 0) -
                 history.slice(0, season).reduce((a, b) => a + b, 0)) / (season * season);
    for (let i = 0; i < season; i++) seasonals[i] = history[i] / level;

    fitted[0] = level * seasonals[0];
    for (let i = 1; i < n; i++) {
      const s = seasonals[i % season];
      const prevLevel = level;
      level   = alpha * (history[i] / s) + (1 - alpha) * (level + trend);
      trend   = beta * (level - prevLevel) + (1 - beta) * trend;
      seasonals[i % season] = gamma * (history[i] / level) + (1 - gamma) * s;
      fitted[i] = (level + trend) * seasonals[i % season];
    }
    for (let h = 1; h <= horizon; h++) {
      forecast.push((level + h * trend) * seasonals[(n + h - 1) % season]);
    }
  }

  let sumAbsPct = 0, sumSq = 0, sumAbs = 0, sumErr = 0, cnt = 0;
  let sumActual = 0, sumSMAPE = 0;
  let sumNaiveSq = 0;
  for (let i = 0; i < n; i++) {
    if (fitted[i] == null || history[i] === 0) continue;
    const err = history[i] - (fitted[i] as number);
    sumAbsPct += Math.abs(err / history[i]);
    sumSq += err * err; sumAbs += Math.abs(err); sumErr += err; cnt++;
    sumActual += history[i];
    const denom = (Math.abs(history[i]) + Math.abs(fitted[i] as number)) / 2;
    if (denom > 0) sumSMAPE += Math.abs(err) / denom;
    if (i > 0) sumNaiveSq += (history[i] - history[i - 1]) ** 2;
  }
  const mae   = cnt ? sumAbs / cnt : 0;
  const rmse  = cnt ? Math.sqrt(sumSq / cnt) : 0;
  const bias  = cnt ? sumErr / cnt : 0;
  return {
    fitted, forecast: forecast.map((v) => Math.max(0, v)),
    mape:           cnt ? (sumAbsPct / cnt) * 100 : 0,
    rmse, mae, bias,
    wmape:          sumActual ? (sumAbs / sumActual) * 100 : 0,
    smape:          cnt ? (sumSMAPE / cnt) * 100 : 0,
    trackingSignal: mae ? sumErr / mae : 0,
    theilU:         sumNaiveSq ? Math.sqrt(sumSq / sumNaiveSq) : 0,
  };
}

export function genSeries(base: number, trend: number, seasonAmp: number, seed: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 24; i++) {
    const t = base + trend * i;
    const s = 1 + seasonAmp * Math.sin(((i % 12) / 12) * Math.PI * 2 - Math.PI / 2);
    const noise = 0.94 + ((Math.sin(i * 7.1 + seed) + 1) / 2) * 0.12;
    out.push(Math.round(t * s * noise));
  }
  return out;
}

export function parseDemandSeries(text: string): number[] {
  return text
    .split(/[\s,，;；\n\r\t]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item >= 0);
}

export function formatDemandSeries(values: number[]) {
  return values.join(", ");
}

export function formatEta(days: number) {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return `${d.getMonth() + 1}月${String(d.getDate()).padStart(2, "0")}日`;
}

export function demandDiagnostics(history: number[]) {
  const n = history.length || 1;
  const total = history.reduce((a, b) => a + b, 0);
  const mean = total / n;
  const sorted = [...history].sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const median = sorted.length % 2
    ? sorted[Math.floor(sorted.length / 2)]
    : ((sorted[sorted.length / 2 - 1] ?? 0) + (sorted[sorted.length / 2] ?? 0)) / 2;
  const std = Math.sqrt(history.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  const cov = mean ? std / mean : 0;
  const last3 = history.slice(-3).reduce((a, b) => a + b, 0) / Math.max(1, history.slice(-3).length);
  const prev3 = history.slice(-6, -3).reduce((a, b) => a + b, 0) / Math.max(1, history.slice(-6, -3).length);
  const recentTrend = prev3 ? ((last3 - prev3) / prev3) * 100 : 0;
  const zeros = history.filter((item) => item === 0).length;
  return { n, total, mean, median, min, max, std, cov, recentTrend, zeros };
}
