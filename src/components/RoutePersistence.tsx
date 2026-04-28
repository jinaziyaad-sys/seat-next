import { useEffect, useRef } from "react";
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
  const hasCheckedInitialRoute = useRef(false);
  const restoredOnLaunch = useRef(false);

  // On mount: if we're at "/" but the user previously had a deeper route,
  // restore it. Only runs once per app load.
  useEffect(() => {
    if (hasCheckedInitialRoute.current) return;
    hasCheckedInitialRoute.current = true;

    if (location.pathname !== "/") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved !== "/" && !SKIP_PATHS.some(p => saved.startsWith(p))) {
        restoredOnLaunch.current = true;
        navigate(saved, { replace: true });
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On every navigation: save the current route for next launch.
  useEffect(() => {
    if (restoredOnLaunch.current && location.pathname === "/") return;

    if (SKIP_PATHS.some(p => location.pathname.startsWith(p))) return;
    try {
      localStorage.setItem(STORAGE_KEY, location.pathname + location.search);
      restoredOnLaunch.current = false;
    } catch { /* ignore */ }
  }, [location.pathname, location.search]);

  // Mobile PWAs can be suspended abruptly, so persist again when backgrounded.
  useEffect(() => {
    const saveCurrentRoute = () => {
      if (SKIP_PATHS.some(p => location.pathname.startsWith(p))) return;
      try {
        localStorage.setItem(STORAGE_KEY, location.pathname + location.search);
      } catch { /* ignore */ }
    };

    window.addEventListener("pagehide", saveCurrentRoute);
    document.addEventListener("visibilitychange", saveCurrentRoute);

    return () => {
      window.removeEventListener("pagehide", saveCurrentRoute);
      document.removeEventListener("visibilitychange", saveCurrentRoute);
    };
  }, [location.pathname, location.search]);

  return null;
};
