import { useEffect, useRef, type ReactNode } from "react";
import { A } from "./index";

export function WorkbenchMoreMenu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    const closeOthers = () => document.querySelectorAll<HTMLDetailsElement>("details[data-workbench-more][open]").forEach((item) => { if (item !== ref.current) item.open = false; });
    const current = ref.current;
    document.addEventListener("pointerdown", closeOutside);
    current?.addEventListener("toggle", closeOthers);
    return () => { document.removeEventListener("pointerdown", closeOutside); current?.removeEventListener("toggle", closeOthers); };
  }, []);
  return <details ref={ref} data-workbench-more className="relative" onKeyDown={(event) => { if (event.key === "Escape" && ref.current) { ref.current.open = false; ref.current.querySelector("summary")?.focus(); } }}>
    <summary className="cursor-pointer list-none rounded-md px-2 py-1 text-[11px] font-medium" style={{ background: A.gray6 }}>更多</summary>
    <div className="absolute bottom-full right-0 z-50 mb-1 w-36 rounded-lg border bg-white p-1 shadow-lg" onClick={() => { if (ref.current) ref.current.open = false; }}>{children}</div>
  </details>;
}
