export const typography = {
  pageTitle: "text-[20px] leading-7 font-semibold tracking-normal",
  sectionTitle: "text-[16px] leading-6 font-semibold tracking-normal",
  subsectionTitle: "text-[15px] leading-[22px] font-semibold tracking-normal",
  body: "text-[14px] leading-[22px] tracking-normal",
  metadata: "text-[12px] leading-[18px] tracking-normal",
  compactMetadata: "text-[11px] leading-4 tracking-normal",
  kpiValue: "text-[20px] leading-7 font-semibold tracking-normal",
  kpiLabel: "text-[12px] leading-[18px] font-medium tracking-normal",
  tableHeader: "text-[13px] leading-5 font-semibold tracking-normal",
  tableCell: "text-[14px] leading-[22px] tracking-normal",
  tableLink: "text-[14px] leading-[22px] font-medium tracking-normal",
  formLabel: "text-[13px] leading-5 font-semibold tracking-normal",
  formInput: "text-[14px] leading-[22px] tracking-normal",
  button: "text-[14px] leading-5 font-semibold tracking-normal",
  denseButton: "text-[12px] leading-[18px] font-medium tracking-normal",
  chip: "text-[12px] leading-[18px] font-semibold tracking-normal",
  detailTitle: "text-[18px] leading-7 font-semibold tracking-normal",
  detailMeta: "text-[12px] leading-[18px] tracking-normal",
  searchResultTitle: "text-[13px] leading-5 font-semibold tracking-normal",
  searchResultMeta: "text-[12px] leading-[18px] tracking-normal",
} as const;

export type TypographyToken = keyof typeof typography;
