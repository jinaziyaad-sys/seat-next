import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabase } from "@/integrations/supabase/client";

// Global error capture for AI Operations Center
const captureError = async (error: Error, errorInfo?: { componentStack?: string }) => {
  try {
    // Get current route
    const route = window.location.pathname;
    
    // Get browser/device info
    const browserInfo = navigator.userAgent;
    const deviceInfo = `${navigator.platform} | ${window.innerWidth}x${window.innerHeight}`;
    
    // Extract component from stack if available
    const component = errorInfo?.componentStack?.split('\n')[1]?.trim() || undefined;
    
    // Get user if logged in
    const { data: { user } } = await supabase.auth.getUser();
    
    // Insert error into platform_errors table
    await supabase.from('platform_errors').insert({
      error_type: error.name || 'Error',
      error_message: error.message,
      stack_trace: error.stack,
      component,
      route,
      user_id: user?.id || null,
      browser_info: browserInfo,
      device_info: deviceInfo,
    });
    
    console.log('[Error Capture] Error logged to platform_errors');
  } catch (captureErr) {
    // Silently fail - don't create infinite loops
    console.error('[Error Capture] Failed to capture error:', captureErr);
  }
};

// Global error handler for uncaught errors
window.onerror = (message, source, lineno, colno, error) => {
  if (error) {
    captureError(error);
  } else {
    captureError(new Error(String(message)));
  }
  return false; // Let the error propagate
};

// Global handler for unhandled promise rejections
window.onunhandledrejection = (event) => {
  const error = event.reason instanceof Error 
    ? event.reason 
    : new Error(String(event.reason));
  captureError(error);
};

// Export for use in error boundaries
(window as any).__captureError = captureError;

createRoot(document.getElementById("root")!).render(<App />);
