import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const STORAGE_KEY = "readyup:lastRoute";

// Routes we never want to auto-restore (transient/auth flows)
const SKIP_PATHS = ["/auth", "/reset-password", "/~oauth"];

/**
 * Persists the last visited route in localStorage and restores it on cold app
 * launch (e.g. when an installed PWA is reopened on iOS/Android after the OS
 * killed the process). Without this, the app always boots on "/".
 */
export const RoutePersistence = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // On mount: if we're at "/" but the user previously had a deeper route,
  // restore it. Only runs once per app load.
  useEffect(() => {
    if (location.pathname !== "/") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved !== "/" && !SKIP_PATHS.some(p => saved.startsWith(p))) {
        navigate(saved, { replace: true });
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On every navigation: save the current route for next launch.
  useEffect(() => {
    if (SKIP_PATHS.some(p => location.pathname.startsWith(p))) return;
    try {
      localStorage.setItem(STORAGE_KEY, location.pathname + location.search);
    } catch { /* ignore */ }
  }, [location.pathname, location.search]);

  return null;
};
