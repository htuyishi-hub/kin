import { useState, useEffect } from "react";
import { Button } from "./ui/button";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed',
    platform: string
  }>;
  prompt(): Promise<void>;
}

export function PwaInstallButton({ className }: { className?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosPrompt, setShowIosPrompt] = useState(false);

  useEffect(() => {
    // Check if iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    
    // Check if already installed
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIosPrompt(true);
      setTimeout(() => setShowIosPrompt(false), 5000);
    }
  };

  if (isStandalone) {
    return (
      <Button 
        className={`bg-trust hover:bg-trust-dim text-white font-medium ${className}`}
        onClick={() => window.location.href = '/'}
      >
        Open App
      </Button>
    );
  }

  return (
    <div className="relative inline-block">
      <Button 
        onClick={handleInstallClick}
        className={`bg-gold text-night hover:bg-gold/90 font-bold ${className}`}
      >
        Download App
      </Button>
      
      {showIosPrompt && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-ink-raised border border-divider rounded-lg shadow-xl z-50 text-sm text-bone text-center animate-in fade-in slide-in-from-top-2">
          To install on iOS: tap the Share button at the bottom of Safari, then select <strong>"Add to Home Screen"</strong>.
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-ink-raised border-t border-l border-divider rotate-45"></div>
        </div>
      )}
    </div>
  );
}