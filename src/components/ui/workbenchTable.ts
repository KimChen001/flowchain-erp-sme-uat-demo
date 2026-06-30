import { typography } from "./typography";

export const tableScrollClass = "overflow-x-auto";
export const tableBodyTextClass = typography.tableCell;
export const tableBaseClass = `w-full ${tableBodyTextClass}`;
export const tableMinSmClass = `w-full min-w-[980px] ${tableBodyTextClass}`;
export const tableMinMdClass = `w-full min-w-[1180px] ${tableBodyTextClass}`;
export const tableMinLgClass = `w-full min-w-[1280px] ${tableBodyTextClass}`;
export const tableMinXlClass = `w-full min-w-[1480px] ${tableBodyTextClass}`;

export const thClass = `text-left px-4 py-3 ${typography.tableHeader} whitespace-nowrap`;
export const thRightClass = `text-right px-4 py-3 ${typography.tableHeader} whitespace-nowrap`;
export const thWideClass = `text-left px-5 py-3 ${typography.tableHeader} whitespace-nowrap`;
export const tdClass = "px-4 py-3";
export const tdWideClass = "px-5 py-3";
export const tdNowrapClass = "px-4 py-3 whitespace-nowrap";
export const tdWideNowrapClass = "px-5 py-3 whitespace-nowrap";
export const tdIdClass = "px-4 py-3 whitespace-nowrap font-medium tabular-nums";
export const tdWideIdClass = "px-5 py-3 whitespace-nowrap font-medium tabular-nums";
export const tdNumericClass = "px-4 py-3 whitespace-nowrap tabular-nums";
export const tdWideNumericClass = "px-5 py-3 whitespace-nowrap tabular-nums";
export const tdNumericRightClass = "px-4 py-3 whitespace-nowrap tabular-nums text-right";
export const tdActionClass = "px-4 py-3 whitespace-nowrap min-w-[140px]";
export const tdWideActionClass = "px-5 py-3 whitespace-nowrap min-w-[140px]";
export const tdNameClass = "px-4 py-3 whitespace-nowrap";
export const tdWideNameClass = "px-5 py-3 whitespace-nowrap";
export const tableLinkClass = `${typography.tableLink} tabular-nums hover:underline rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200`;
