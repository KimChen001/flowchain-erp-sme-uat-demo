import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Clock3, X } from "lucide-react";
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
    <div className="mb-3 flex items-center justify-end gap-1" data-testid="recent-pages">
      <details className="relative group">
        <summary aria-current="page" className="list-none cursor-pointer inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: A.gray6, color: A.gray1 }} aria-label="最近访问">
          <Clock3 size={13} /><span>最近访问</span><ChevronDown size={12} />
        </summary>
        <div className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-xl bg-white p-1 shadow-xl" style={{ border: `1px solid ${A.border}` }}>
        {visible.slice().reverse().map((item) => {
          const active = item.path === location.pathname;
          return <button key={item.routeId} type="button" className="fc-recent-page flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-50" style={{ color: active ? A.blue : A.label }} onClick={() => navigate(item.path)}>
            <span className="truncate">{item.label}</span>
            {item.routeId !== "overview" && <X size={11} aria-label={`移除 ${item.label}`} onClick={(event) => close(event, item)} />}
          </button>;
        })}
        </div>
      </details>
      {current && current.id !== "overview" && visible.some((item) => item.routeId === current.id) && <button type="button" aria-label={`关闭 ${current.label}`} onClick={(event) => close(event, visible.find((item) => item.routeId === current.id)!)} className="rounded-lg p-2" style={{ background: A.gray6, color: A.gray2 }}><X size={12} /></button>}
    </div>
  );
}

export { MAX_RECENT, STORAGE_KEY as RECENT_PAGES_STORAGE_KEY };
