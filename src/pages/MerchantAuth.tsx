import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function MerchantAuth() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    navigate(`/auth${location.search}`, { replace: true });
  }, [location.search, navigate]);

  return null;
}
