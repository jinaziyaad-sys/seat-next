import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Header } from "@/components/Header";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import MerchantAuth from "./pages/MerchantAuth";
import MerchantDashboard from "./pages/MerchantDashboard";
import DevAuth from "./pages/DevAuth";
import DevDashboard from "./pages/DevDashboard";
import AdminCreateMerchant from "./pages/AdminCreateMerchant";
import WaitlistJoin from "./pages/WaitlistJoin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true} storageKey="readyup-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Header />
          <Routes>
            {/* Patron App Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/waitlist/:venueId" element={<WaitlistJoin />} />
            
            {/* Merchant App Routes */}
            <Route path="/merchant/auth" element={<MerchantAuth />} />
            <Route path="/merchant/dashboard" element={<MerchantDashboard />} />
            
            {/* Developer App Routes */}
            <Route path="/dev/auth" element={<DevAuth />} />
            <Route path="/dev/dashboard" element={<DevDashboard />} />
            
            {/* Legacy route - redirect to dev dashboard */}
            <Route path="/admin/create-merchant" element={<AdminCreateMerchant />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
