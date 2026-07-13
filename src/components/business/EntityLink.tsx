import type { ReactNode } from "react";
import { Link } from "react-router";

type EntityKind = "item" | "sales_order" | "purchase_request" | "purchase_order" | "supplier";

const routeFor: Record<EntityKind, (id: string) => string> = {
  item: (id) => `/app/master-data/items/${encodeURIComponent(id)}`,
  sales_order: (id) => `/app/sales/orders/${encodeURIComponent(id)}`,
  purchase_request: (id) => `/app/procurement/requests/${encodeURIComponent(id)}`,
  purchase_order: (id) => `/app/procurement/orders/${encodeURIComponent(id)}`,
  supplier: (id) => `/app/master-data/suppliers/${encodeURIComponent(id)}`,
};

export function EntityLink({ kind, id, children, className = "" }: { kind: EntityKind; id?: string | null; children?: ReactNode; className?: string }) {
  const value = String(id || "").trim();
  if (!value) return <span className={className}>{children}</span>;
  return <Link className={`fc-entity-link font-semibold underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`} to={routeFor[kind](value)}>{children ?? value}</Link>;
}
