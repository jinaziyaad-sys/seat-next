import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import logo from "@/assets/logo.png";

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";
  
  // Don't show header on merchant or dev dashboards (they have their own headers)
  const isMerchantDashboard = location.pathname === "/merchant/dashboard";
  const isDevDashboard = location.pathname === "/dev/dashboard";
  
  if (isHome || isMerchantDashboard || isDevDashboard) return null;

  // Determine which home to navigate to based on current route
  const getHomeRoute = () => {
    if (location.pathname.startsWith("/merchant")) return "/merchant/dashboard";
    if (location.pathname.startsWith("/dev")) return "/dev/dashboard";
    return "/"; // Patron home
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(getHomeRoute())}
          className="hover:bg-transparent p-2"
        >
          <img 
            src={logo} 
            alt="ReadyUp" 
            className="h-8 w-auto"
          />
        </Button>
      </div>
    </header>
  );
};
