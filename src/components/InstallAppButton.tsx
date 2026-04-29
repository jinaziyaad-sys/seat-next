import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, Smartphone, Share, Plus, X, Copy, Check, Apple } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  detectPlatform,
  getDeferredPrompt,
  onPromptChange,
  type Platform,
} from "@/utils/installApp";

interface InstallAppButtonProps {
  variant?: "banner" | "card" | "inline";
  onDismiss?: () => void;
}

const DISMISS_KEY = "install_app_banner_dismissed_at";
const DISMISS_DAYS = 7;

export function InstallAppButton({ variant = "card", onDismiss }: InstallAppButtonProps) {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [showOpenInSafari, setShowOpenInSafari] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setPlatform(detectPlatform());
    const off = onPromptChange(() => setPlatform(detectPlatform()));

    if (variant === "banner") {
      const ts = localStorage.getItem(DISMISS_KEY);
      if (ts) {
        const days = (Date.now() - parseInt(ts, 10)) / (1000 * 60 * 60 * 24);
        if (days < DISMISS_DAYS) setDismissed(true);
      }
    }
    return () => { off(); };
  }, [variant]);

  if (platform === "installed" || platform === "unknown") return null;
  if (variant === "banner" && dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
    onDismiss?.();
  };

  const handleInstall = async () => {
    if (platform === "android-installable") {
      const prompt = getDeferredPrompt();
      if (prompt) {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === "accepted") {
          toast({ title: "Installing…", description: "ReadyUp is being added to your home screen." });
          handleDismiss();
        }
      } else {
        toast({
          title: "Install not available yet",
          description: "Tap your browser menu → 'Install app' or 'Add to Home Screen'.",
        });
      }
    } else if (platform === "ios-safari") {
      setShowIosHelp(true);
    } else if (platform === "ios-other") {
      setShowOpenInSafari(true);
    } else {
      toast({
        title: "Use Chrome or Edge to install",
        description: "Your current browser doesn't support one-click install.",
      });
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Please copy the URL manually." });
    }
  };

  const ctaLabel =
    platform === "ios-safari" || platform === "ios-other"
      ? "Add to Home Screen"
      : "Install App";

  // ---------- BANNER ----------
  if (variant === "banner") {
    return (
      <>
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 backdrop-blur-sm p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">Get the full experience</p>
                <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                  Install ReadyUp for push alerts & faster access
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleInstall}
                className="active:scale-97 transition-transform"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Install
              </Button>
              <button
                onClick={handleDismiss}
                aria-label="Dismiss"
                className="flex-shrink-0 w-7 h-7 rounded-full hover:bg-foreground/5 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
        {renderDialogs()}
      </>
    );
  }

  // ---------- CARD (settings) ----------
  if (variant === "card") {
    return (
      <>
        <Card className="shadow-card overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">Install ReadyUp</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add to your home screen for one-tap access, push notifications on the lock screen, and a full-screen app experience.
                </p>
                <Button
                  onClick={handleInstall}
                  className="mt-3 active:scale-97 transition-transform"
                  size="sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {ctaLabel}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        {renderDialogs()}
      </>
    );
  }

  // ---------- INLINE ----------
  return (
    <>
      <Button onClick={handleInstall} className="active:scale-97 transition-transform">
        <Download className="w-4 h-4 mr-2" />
        {ctaLabel}
      </Button>
      {renderDialogs()}
    </>
  );

  function renderDialogs() {
    return (
      <>
        {/* iOS Safari instructions */}
        <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Apple className="w-5 h-5" />
                Add to Home Screen
              </DialogTitle>
              <DialogDescription>
                iOS doesn't allow one-tap install — but it only takes 3 quick steps:
              </DialogDescription>
            </DialogHeader>
            <ol className="space-y-4 mt-2">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center">1</span>
                <div className="flex-1 text-sm">
                  Tap the <Share className="inline w-4 h-4 mx-1 text-primary" />
                  <strong>Share</strong> button at the bottom of Safari
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center">2</span>
                <div className="flex-1 text-sm">
                  Scroll down and tap <Plus className="inline w-4 h-4 mx-1 text-primary" />
                  <strong>Add to Home Screen</strong>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center">3</span>
                <div className="flex-1 text-sm">
                  Tap <strong>Add</strong> in the top-right — done!
                </div>
              </li>
            </ol>
            <p className="text-xs text-muted-foreground mt-2 p-3 rounded-lg bg-muted/50">
              💡 You'll need to open the app from your home screen icon to receive push notifications.
            </p>
          </DialogContent>
        </Dialog>

        {/* iOS Chrome/Firefox — open in Safari */}
        <Dialog open={showOpenInSafari} onOpenChange={setShowOpenInSafari}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Open in Safari to install</DialogTitle>
              <DialogDescription>
                Apple only allows installing web apps from <strong>Safari</strong> on iPhone & iPad. Other browsers (Chrome, Firefox, Edge) can't install on iOS.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-2">
                <p className="font-medium">How to switch:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Copy the link below</li>
                  <li>Open the <strong>Safari</strong> app</li>
                  <li>Paste & go, then tap Share → Add to Home Screen</li>
                </ol>
              </div>
              <Button onClick={copyLink} variant="outline" className="w-full">
                {copied ? (
                  <><Check className="w-4 h-4 mr-2" /> Link copied!</>
                ) : (
                  <><Copy className="w-4 h-4 mr-2" /> Copy app link</>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }
}
