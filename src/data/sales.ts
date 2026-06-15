function genSeries(base: number, trend: number, seasonAmp: number, seed: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 18; i++) {
    const season = Math.sin((i / 12) * Math.PI * 2) * seasonAmp;
    const noise = Math.sin((i + seed) * 1.7) * seasonAmp * 0.22;
    out.push(Math.max(0, Math.round(base + i * trend + season + noise)));
  }
  return out;
}

export const salesData = [
  { month: "1月",  revenue: 4820000,  orders: 312,  margin: 28.4 },
  { month: "2月",  revenue: 3960000,  orders: 278,  margin: 26.1 },
  { month: "3月",  revenue: 5310000,  orders: 394,  margin: 29.8 },
  { month: "4月",  revenue: 4750000,  orders: 341,  margin: 27.6 },
  { month: "5月",  revenue: 6120000,  orders: 432,  margin: 31.2 },
  { month: "6月",  revenue: 5880000,  orders: 415,  margin: 30.4 },
  { month: "7月",  revenue: 7240000,  orders: 501,  margin: 33.1 },
  { month: "8月",  revenue: 6890000,  orders: 488,  margin: 32.7 },
  { month: "9月",  revenue: 7580000,  orders: 534,  margin: 34.2 },
  { month: "10月", revenue: 8120000,  orders: 571,  margin: 35.6 },
  { month: "11月", revenue: 9340000,  orders: 648,  margin: 36.9 },
  { month: "12月", revenue: 8760000,  orders: 612,  margin: 35.1 },
];

export const forecastData = [
  { month: "9月",  actual: 7580000,  forecast: 7200000,  lower: 6800000,  upper: 7600000  },
  { month: "10月", actual: 8120000,  forecast: 8000000,  lower: 7600000,  upper: 8400000  },
  { month: "11月", actual: 9340000,  forecast: 8800000,  lower: 8300000,  upper: 9300000  },
  { month: "12月", actual: 8760000,  forecast: 9200000,  lower: 8700000,  upper: 9700000  },
  { month: "1月",  actual: null,     forecast: 9600000,  lower: 9000000,  upper: 10200000 },
  { month: "2月",  actual: null,     forecast: 10200000, lower: 9500000,  upper: 10900000 },
  { month: "3月",  actual: null,     forecast: 11100000, lower: 10200000, upper: 12000000 },
];

export const topProducts = [
  { name: "精密减速机 RS-200",   revenue: 3840000, growth: 12.4,  units: 284, margin: 38.2, returnRate: 0.4 },
  { name: "伺服驱动器 SD-750",   revenue: 2920000, growth: 8.7,   units: 391, margin: 34.7, returnRate: 0.6 },
  { name: "工业机器人关节模组", revenue: 2480000, growth: 21.3,  units: 128, margin: 42.1, returnRate: 0.2 },
  { name: "PLC 控制模块 C3000", revenue: 1860000, growth: -3.2,  units: 512, margin: 28.9, returnRate: 1.1 },
  { name: "气动执行器 PA-80",   revenue: 1340000, growth: 5.8,   units: 743, margin: 31.4, returnRate: 0.8 },
];

export const FULFILLMENT_STAGES = [
  { stage: "草稿",   count:  8, value:  2840000 },
  { stage: "已确认", count: 14, value:  9620000 },
  { stage: "拣货中", count: 22, value: 12480000 },
  { stage: "已发货", count: 31, value: 18460000 },
  { stage: "已交付", count: 48, value: 24820000 },
];

export const FORECAST_SKUS = [
  { sku: "SKU-00412", name: "伺服电机 750W",     onHand: 34,   open: 150, history: genSeries(120, 2.4,  0.18, 1.3), unit: "台" },
  { sku: "SKU-00623", name: "控制器主板 V3.2",   onHand: 12,   open: 60,  history: genSeries(46,  1.2,  0.22, 2.1), unit: "件" },
  { sku: "SKU-00287", name: "铝合金型材 6063",   onHand: 148,  open: 800, history: genSeries(620, 8,    0.14, 3.7), unit: "米" },
  { sku: "SKU-00142", name: "精密轴承 6204-ZZ",  onHand: 2840, open: 0,   history: genSeries(380, 4.6,  0.10, 4.5), unit: "件" },
  { sku: "SKU-00815", name: "液压油缸 50mm",     onHand: 67,   open: 0,   history: genSeries(140, 1.8,  0.16, 5.2), unit: "件" },
];
