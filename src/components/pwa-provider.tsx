"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface PwaContextValue {
  canInstall: boolean;
  isInstalled: boolean;
  isIos: boolean;
  install(): Promise<"accepted" | "dismissed" | "unavailable">;
}

const PwaContext = createContext<PwaContextValue | null>(null);

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      setIsInstalled(isStandalone());
      setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));
    }, 0);

    const shouldRegisterServiceWorker = process.env.NODE_ENV === "production"
      || process.env.NEXT_PUBLIC_ENABLE_PWA === "true";
    if ("serviceWorker" in navigator) {
      if (shouldRegisterServiceWorker) {
        void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
      } else {
        void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(
          registrations
            .filter((registration) => registration.active?.scriptURL.endsWith("/sw.js"))
            .map((registration) => registration.unregister()),
        )).catch(() => undefined);
      }
    }

    const displayMode = window.matchMedia("(display-mode: standalone)");
    const updateDisplayMode = () => setIsInstalled(isStandalone());
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const markInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    displayMode.addEventListener("change", updateDisplayMode);
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.clearTimeout(initialize);
      displayMode.removeEventListener("change", updateDisplayMode);
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  const value = useMemo<PwaContextValue>(() => ({
    canInstall: installPrompt !== null,
    isInstalled,
    isIos,
    async install() {
      if (!installPrompt) return "unavailable";
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      setInstallPrompt(null);
      return outcome;
    },
  }), [installPrompt, isInstalled, isIos]);

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa() {
  const value = useContext(PwaContext);
  if (!value) throw new Error("usePwa muss innerhalb des PwaProvider verwendet werden.");
  return value;
}
