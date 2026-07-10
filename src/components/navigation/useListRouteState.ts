import { useLayoutEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router";

type ListRouteStateOptions<T extends Record<string, string>> = {
  moduleId: string;
  routeId: string;
  defaults: T;
};

type SessionState = { scrollTop?: number; selectedId?: string };

export function listSessionStorageKey(moduleId: string, routeId: string) {
  return `flowchain:list:${moduleId}:${routeId}`;
}

function readSession(key: string): SessionState {
  try { return JSON.parse(sessionStorage.getItem(key) || "{}"); } catch { return {}; }
}

export function useListRouteState<T extends Record<string, string>>({ moduleId, routeId, defaults }: ListRouteStateOptions<T>) {
  const location = useLocation();
  const [, setParams] = useSearchParams();
  const search = location.search;
  const storageKey = listSessionStorageKey(moduleId, routeId);
  const [selectedId, setSelectedIdState] = useState(() => readSession(storageKey).selectedId || "");
  const values = useMemo(() => {
    const current = new URLSearchParams(search);
    return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, current.get(key) || fallback])) as T;
  }, [defaults, search]);

  function setValue<K extends keyof T & string>(key: K, value: T[K]) {
    const next = new URLSearchParams(window.location.search);
    if (value === defaults[key]) next.delete(key); else next.set(key, value);
    if (key !== "page" && "page" in defaults) next.delete("page");
    setParams(next, { replace: true });
  }

  function persist(patch: SessionState) {
    const next = { ...readSession(storageKey), ...patch };
    if (!next.selectedId) delete next.selectedId;
    sessionStorage.setItem(storageKey, JSON.stringify(next));
  }

  function setSelectedId(value: string) {
    setSelectedIdState(value);
    persist({ selectedId: value || undefined });
  }

  useLayoutEffect(() => {
    const container = document.querySelector<HTMLElement>("[data-testid='app-main']");
    const saved = readSession(storageKey).scrollTop || 0;
    let lastScrollTop = saved;
    const restore = () => { if (container) container.scrollTop = saved; };
    const frame = requestAnimationFrame(restore);
    const timer = window.setTimeout(restore, 80);
    const rememberScroll = () => {
      if (!container) return;
      lastScrollTop = container.scrollTop;
      persist({ scrollTop: container?.scrollTop || lastScrollTop });
    };
    container?.addEventListener("scroll", rememberScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      container?.removeEventListener("scroll", rememberScroll);
      persist({ scrollTop: lastScrollTop });
    };
  }, [storageKey]);

  return { values, setValue, selectedId, setSelectedId, storageKey };
}
