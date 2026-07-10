import { useEffect, useMemo, useState } from "react";
import { Clock3, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { appRouteRegistry, routeByPath } from "../../app/routeRegistry";
import { A } from "../ui";

type RecentPage = { routeId: string; path: string; label: string };
const STORAGE_KEY = "flowchain:recent-pages:v1";
const MAX_RECENT = 8;

function readRecent(): RecentPage[] {
  try {
    const rows = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as RecentPage[];
    return rows.filter((row) => appRouteRegistry.some((route) => route.id === row.routeId && route.path === row.path)).slice(-MAX_RECENT);
  } catch { return []; }
}

export function RecentPages() {
  const location = useLocation();
  const navigate = useNavigate();
  const [pages, setPages] = useState<RecentPage[]>(readRecent);
  const current = routeByPath(location.pathname);

  useEffect(() => {
    if (!current || current.pageType === "create" || current.pageType === "edit") return;
    setPages((existing) => {
      const next = [...existing.filter((item) => item.routeId !== current.id), { routeId: current.id, path: current.path, label: current.label }].slice(-MAX_RECENT);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [current?.id]);

  const visible = useMemo(() => pages.filter((item) => appRouteRegistry.some((route) => route.id === item.routeId)), [pages]);
  if (visible.length < 2) return null;

  function close(event: React.MouseEvent, item: RecentPage) {
    event.stopPropagation();
    const next = visible.filter((entry) => entry.routeId !== item.routeId);
    setPages(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (item.path === location.pathname) navigate(next.at(-1)?.path || "/app/overview");
  }

  return (
    <div className="fc-recent-pages" data-testid="recent-pages" aria-label="最近访问">
      <Clock3 size={13} className="shrink-0" style={{ color: A.gray2 }} />
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {visible.map((item) => {
          const active = item.path === location.pathname;
          return <button key={item.routeId} type="button" aria-current={active ? "page" : undefined} className={`fc-recent-page ${active ? "is-active" : ""}`} onClick={() => navigate(item.path)}>
            <span className="truncate">{item.label}</span>
            {item.routeId !== "overview" && <X size={11} aria-label={`关闭 ${item.label}`} onClick={(event) => close(event, item)} />}
          </button>;
        })}
      </div>
    </div>
  );
}

export { MAX_RECENT, STORAGE_KEY as RECENT_PAGES_STORAGE_KEY };
