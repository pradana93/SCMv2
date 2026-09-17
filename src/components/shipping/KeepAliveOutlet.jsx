import { useOutlet, useLocation } from "react-router-dom";
import { useRef, useEffect } from "react";

const TAB_PATHS = ["/dashboard", "/pengiriman", "/penerimaan", "/produksi", "/stok", "/admin", "/report"];

export default function KeepAliveOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const cache = useRef(new Map());
  const scrollPositions = useRef(new Map());

  const currentPath = "/" + (location.pathname.replace(/^\//, "").split("/")[0] || "");
  const isTab = TAB_PATHS.includes(currentPath);

  useEffect(() => {
    if (!isTab) return;
    return () => {
      scrollPositions.current.set(currentPath, window.scrollY);
    };
  }, [currentPath, isTab]);

  useEffect(() => {
    if (!isTab) return;
    const saved = scrollPositions.current.get(currentPath) || 0;
    const t = setTimeout(() => window.scrollTo({ top: saved, behavior: "instant" }), 50);
    return () => clearTimeout(t);
  }, [currentPath, isTab]);

  if (isTab) {
    cache.current.set(currentPath, outlet);
  }

  return (
    <>
      {TAB_PATHS.map((path) => {
        const isActive = path === currentPath && isTab;
        const cached = cache.current.get(path);
        if (!isActive && !cached) return null;
        return (
          <div key={path} hidden={!isActive} className={!isActive ? "hidden" : ""}>
            {isActive ? outlet : cached}
          </div>
        );
      })}
      {!isTab && outlet}
    </>
  );
}