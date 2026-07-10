import React from "react";
import { Search } from "lucide-react";
import { A } from "../ui";

export function PageHeader({ title, subtitle, primaryAction, secondaryActions, backAction }: { title: string; subtitle?: string; primaryAction?: React.ReactNode; secondaryActions?: React.ReactNode; backAction?: React.ReactNode }) {
  return <div className="fc-page-header"><div className="flex min-w-0 items-start gap-3">{backAction}<div><h2 className="fc-page-title">{title}</h2>{subtitle && <p className="fc-page-subtitle mt-1">{subtitle}</p>}</div></div><div className="flex items-center gap-2">{secondaryActions}{primaryAction}</div></div>;
}

export function ModuleHeader({ moduleTitle, moduleDescription, moduleActions }: { moduleTitle: string; moduleDescription?: string; moduleActions?: React.ReactNode }) {
  return <div className="fc-module-header"><div><h1 className="fc-module-title">{moduleTitle}</h1>{moduleDescription && <p className="fc-page-subtitle mt-1">{moduleDescription}</p>}</div>{moduleActions}</div>;
}

export function FilterBar({ search, onSearchChange, searchLabel = "搜索", children, resultCount, actions }: { search?: string; onSearchChange?: (value: string) => void; searchLabel?: string; children?: React.ReactNode; resultCount?: React.ReactNode; actions?: React.ReactNode }) {
  return <div className="fc-filter-bar">{onSearchChange && <label className="fc-search-input"><Search size={14} /><span className="sr-only">{searchLabel}</span><input aria-label={searchLabel} value={search || ""} onChange={(event) => onSearchChange(event.target.value)} placeholder={searchLabel} /></label>}{children}<span className="ml-auto fc-caption" style={{ color: A.gray2 }}>{resultCount}</span>{actions}</div>;
}

export type ActionVariant = "primary" | "secondary" | "quiet" | "danger" | "compact" | "table-action";
export function ActionButton({ variant = "secondary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ActionVariant }) {
  return <button {...props} className={`fc-action-button fc-action-${variant} ${className}`} />;
}

export function StatusChip({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "info" | "success" | "warning" | "danger" }) {
  return <span className={`fc-status-chip fc-status-${tone}`}>{label}</span>;
}

export function DetailField({ label, value, className = "" }: { label: string; value?: React.ReactNode; className?: string }) {
  return <div className={`fc-detail-field ${className}`}><div className="fc-label">{label}</div><div className="fc-body font-semibold">{value === undefined || value === null || value === "" ? "—" : value}</div></div>;
}

export function DataTable({ children, minWidth = 980 }: { children: React.ReactNode; minWidth?: number }) {
  return <div className="overflow-x-auto"><table className="fc-data-table" style={{ minWidth }}>{children}</table></div>;
}
