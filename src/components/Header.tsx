import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import { Home } from "lucide-react";

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Routes where we don't show any home shortcut at all
  const isLanding = location.pathname === "/";
  const isApp = location.pathname === "/app";
  const isMerchantDashboard = location.pathname === "/merchant/dashboard";
  const isDevDashboard = location.pathname === "/dev/dashboard";

  if (isLanding || isApp || isMerchantDashboard || isDevDashboard) return null;

  // Determine where "home" goes based on current section
  const getHomeRoute = () => {
    if (location.pathname.startsWith("/merchant")) return "/merchant/dashboard";
    if (location.pathname.startsWith("/dev")) return "/dev/dashboard";
    return "/";
  };

  return (
    <>
      {/* Skip to content link for a11y */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:p-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to content
      </a>

      {/* Floating home button — no full sticky bar */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate(getHomeRoute())}
        aria-label="Go to home"
        className="fixed top-3 left-3 z-50 h-10 w-10 rounded-full bg-background/80 backdrop-blur-md border border-border/50 shadow-card hover:bg-background"
      >
        <Home className="h-5 w-5" />
      </Button>
    </>
  );
};
