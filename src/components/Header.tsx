import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import logo from "@/assets/logo.png";

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";

  if (isHome) return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
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
