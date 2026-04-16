import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Header } from "@/components/Header";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import MerchantAuth from "./pages/MerchantAuth";
import MerchantDashboard from "./pages/MerchantDashboard";
import MerchantSignup from "./pages/MerchantSignup";
import DevAuth from "./pages/DevAuth";
import DevDashboard from "./pages/DevDashboard";

import Privacy from "./pages/Privacy";
import MerchantBilling from "./pages/MerchantBilling";
import WaitlistJoin from "./pages/WaitlistJoin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true} storageKey="readyup-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <OfflineIndicator />
        <BrowserRouter>
          <Header />
          <Routes>
            {/* Public Marketing Landing Page */}
            <Route path="/" element={<Landing />} />
            
            {/* Patron App Routes */}
            <Route path="/app" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            
            <Route path="/privacy" element={<Privacy />} />
            
            {/* Merchant App Routes */}
            <Route path="/merchant/auth" element={<MerchantAuth />} />
            <Route path="/merchant/signup" element={<MerchantSignup />} />
            <Route path="/merchant/dashboard" element={<MerchantDashboard />} />
            <Route path="/merchant/billing" element={<MerchantBilling />} />
            
            {/* Developer App Routes */}
            <Route path="/dev/auth" element={<DevAuth />} />
            <Route path="/dev/dashboard" element={<DevDashboard />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
