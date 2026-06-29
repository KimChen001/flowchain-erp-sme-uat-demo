export const typography = {
  kpiValue: "text-[20px] leading-7 font-semibold tracking-normal",
  kpiLabel: "text-[11px] leading-4 font-medium tracking-normal",
  tableHeader: "text-[11px] leading-4 font-semibold tracking-normal",
  tableCell: "text-[12px] leading-5 tracking-normal",
  detailTitle: "text-[18px] leading-7 font-semibold tracking-normal",
  detailMeta: "text-[12px] leading-5 tracking-normal",
  searchResultTitle: "text-xs leading-5 font-semibold tracking-normal",
  searchResultMeta: "text-[11px] leading-4 tracking-normal",
} as const;

export type TypographyToken = keyof typeof typography;
