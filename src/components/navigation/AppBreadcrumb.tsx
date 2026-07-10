import { ChevronRight, Home } from "lucide-react";
import { Link, useLocation } from "react-router";
import { breadcrumbRoutes, type AppRouteDefinition } from "../../app/routeRegistry";
import { A } from "../ui";

export function AppBreadcrumb({ route }: { route: AppRouteDefinition }) {
  const location = useLocation();
  const items = breadcrumbRoutes(route);
  return (
    <nav aria-label="面包屑" className="fc-breadcrumb" data-testid="app-breadcrumb">
      {items.map((item, index) => {
        const current = index === items.length - 1;
        return <span key={item.id} className="inline-flex items-center gap-1.5">
          {index > 0 && <ChevronRight size={12} aria-hidden style={{ color: A.gray3 }} />}
          {current ? (
            <span aria-current="page" className="fc-caption font-semibold" style={{ color: A.label }}>{index === 0 && <Home size={12} className="mr-1 inline" />}{item.id === "overview" ? "首页" : item.pageType === "detail" ? decodeURIComponent(location.pathname.split("/").at(-1) || item.label) : item.label}</span>
          ) : (
            <Link className="fc-caption inline-flex items-center gap-1 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500 rounded" style={{ color: A.blue }} to={item.path}>
              {index === 0 && <Home size={12} />}{item.id === "overview" ? "首页" : item.parentId ? item.label : item.moduleLabel}
            </Link>
          )}
        </span>;
      })}
    </nav>
  );
}
