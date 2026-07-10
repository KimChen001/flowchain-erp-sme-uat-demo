import { ChevronRight, Home } from "lucide-react";
import { useNavigate } from "react-router";
import { breadcrumbRoutes, type AppRouteDefinition } from "../../app/routeRegistry";
import { A } from "../ui";

export function AppBreadcrumb({ route }: { route: AppRouteDefinition }) {
  const navigate = useNavigate();
  const items = breadcrumbRoutes(route);
  return (
    <nav aria-label="面包屑" className="fc-breadcrumb" data-testid="app-breadcrumb">
      {items.map((item, index) => {
        const current = index === items.length - 1;
        return <span key={item.id} className="inline-flex items-center gap-1.5">
          {index > 0 && <ChevronRight size={12} aria-hidden style={{ color: A.gray3 }} />}
          {current ? (
            <span aria-current="page" className="fc-caption font-semibold" style={{ color: A.label }}>{index === 0 && <Home size={12} className="mr-1 inline" />}{item.id === "overview" ? "首页" : item.label}</span>
          ) : (
            <button type="button" className="fc-caption inline-flex items-center gap-1 hover:underline" style={{ color: A.blue }} onClick={() => navigate(item.path)}>
              {index === 0 && <Home size={12} />}{item.id === "overview" ? "首页" : item.parentId ? item.label : item.moduleLabel}
            </button>
          )}
        </span>;
      })}
    </nav>
  );
}
