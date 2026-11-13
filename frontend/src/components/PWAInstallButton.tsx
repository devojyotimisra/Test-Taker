import { useEffect, useState } from "react";
import { Download, Share2, PlusSquare, X } from "lucide-react";
import { Button } from "./ui/button";
import { useToast } from "./ui/toast";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PWAInstallButton() {
  const { toast } = useToast();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    const isAppStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");
    setIsStandalone(Boolean(isAppStandalone));

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIpadOrIphone =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(Boolean(isIpadOrIphone));

    // Listen for beforeinstallprompt event (Chrome, Edge, Android, etc.)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      toast({
        type: "success",
        title: "App Installed!",
        description: "Test Taker is now installed on your device for fast, offline-ready access.",
      });
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [toast]);

  // If already running as an installed PWA, don't show install button
  if (isStandalone) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  // Only show if the browser fired beforeinstallprompt or on iOS
  if (!deferredPrompt && !isIOS) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleInstallClick}
        className="h-8 px-2.5 sm:px-3 text-xs font-semibold gap-1.5 border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
        title="Install Test Taker on your device"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden xs:inline sm:inline">Install App</span>
      </Button>

      {/* iOS Instructions Dialog */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl space-y-4 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold">
                📱
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">Install on iPhone / iPad</h3>
                <p className="text-xs text-muted-foreground">Add to Home Screen in 2 taps</p>
              </div>
            </div>

            <ol className="text-xs space-y-2.5 text-foreground/90 pl-1">
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary">1.</span>
                <span>
                  Tap the <strong className="inline-flex items-center gap-1 font-semibold text-primary"><Share2 className="h-3 w-3 inline" /> Share</strong> button at the bottom of Safari.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary">2.</span>
                <span>
                  Scroll down and tap <strong className="inline-flex items-center gap-1 font-semibold text-primary"><PlusSquare className="h-3 w-3 inline" /> Add to Home Screen</strong>.
                </span>
              </li>
            </ol>

            <Button
              className="w-full text-xs h-9 cursor-pointer"
              onClick={() => setShowIOSModal(false)}
            >
              Got it
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
