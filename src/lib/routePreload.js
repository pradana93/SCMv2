// Route chunk preloading: tab switches felt janky because each page is a
// lazily-loaded chunk, so the first visit to a tab suspended the whole
// <Routes> tree into the full-screen PageLoader spinner. Preloading the
// chunks (once, when idle, plus on nav hover/focus) makes tab switches
// swap instantly between already-mounted keep-alive tabs. No app logic
// or visuals change here — only when code is downloaded.

export const pageLoaders = {
  '/dashboard': () => import('@/pages/Dashboard'),
  '/pengiriman': () => import('@/pages/Shipments'),
  '/admin': () => import('@/pages/Admin'),
  '/report': () => import('@/pages/Report'),
  '/super-admin': () => import('@/pages/SuperAdmin'),
  '/stok': () => import('@/pages/Stock'),
  '/produksi': () => import('@/pages/Production'),
  '/penerimaan': () => import('@/pages/Penerimaan'),
  '/accurate': () => import('@/pages/AccurateSettings'),
  '/koli': () => import('@/pages/KoliDetail'),
};

function fire(loader) {
  try {
    const p = loader();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    // ignore — the normal lazy() import will retry on navigation
  }
}

export function preloadRoute(path) {
  const loader = pageLoaders[path];
  if (loader) fire(loader);
}

let preloadedAll = false;
export function preloadAllRoutes() {
  if (preloadedAll) return;
  preloadedAll = true;
  Object.values(pageLoaders).forEach(fire);
}

export function preloadAllRoutesWhenIdle() {
  const run = () => preloadAllRoutes();
  try {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 4000 });
      return;
    }
  } catch {
    // fall through to timeout
  }
  setTimeout(run, 2500);
}
