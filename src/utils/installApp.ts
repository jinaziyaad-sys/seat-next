// PWA install detection & helpers

export type Platform =
  | "android-installable" // Chrome/Edge/Samsung on Android (or desktop Chromium) with beforeinstallprompt
  | "ios-safari"          // iOS Safari — manual Add to Home Screen
  | "ios-other"           // iOS Chrome/Firefox/etc — must open in Safari
  | "desktop-other"       // Desktop Safari/Firefox — limited
  | "installed"           // Already running standalone
  | "unknown";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(p: BeforeInstallPromptEvent | null) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l(deferredPrompt));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((l) => l(null));
  });
}

export function getDeferredPrompt() {
  return deferredPrompt;
}

export function onPromptChange(cb: (p: BeforeInstallPromptEvent | null) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS legacy
    (window.navigator as any).standalone === true
  );
}

export function detectPlatform(): Platform {
  if (typeof window === "undefined") return "unknown";
  if (isStandalone()) return "installed";

  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;

  if (isIOS) {
    // On iOS, only Safari can install. CriOS = Chrome iOS, FxiOS = Firefox iOS, EdgiOS = Edge iOS
    const isSafari =
      /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/.test(ua);
    return isSafari ? "ios-safari" : "ios-other";
  }

  if (deferredPrompt) return "android-installable";

  // Android Chromium fallback (event might fire late)
  const isAndroid = /Android/.test(ua);
  const isChromium = /Chrome|Edg|SamsungBrowser/.test(ua);
  if (isAndroid && isChromium) return "android-installable";
  if (isChromium) return "android-installable"; // desktop Chromium

  return "desktop-other";
}
