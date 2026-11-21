import React, { useState, useEffect } from 'react';
import { Wifi, Signal, Battery, Smartphone } from 'lucide-react';
import { Link, useLocation } from 'wouter';

interface MobileShellProps {
  children: React.ReactNode;
}

export function MobileShell({ children }: MobileShellProps) {
  const [currentTime, setCurrentTime] = useState('09:41');
  const [location] = useLocation();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#070A0F] text-[#F0EDE6] flex flex-col items-center justify-center sm:py-8 sm:px-4 selection:bg-[#FF6B6B]/30">
      {/* Desktop Top Control Bar */}
      <header className="hidden sm:flex items-center justify-between w-full max-w-[420px] mb-3 px-2 text-xs text-[#A8A49E]">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-[#3FB950] animate-pulse" />
          <span className="font-semibold text-[#F0EDE6] tracking-wide">Kin Live Mobile View</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/landing"
            className="hover:text-[#F0EDE6] transition-colors underline-offset-4 hover:underline"
          >
            Landing Page
          </Link>
          <span className="text-[#21262D]">|</span>
          <span className="text-[#A8A49E]/70 font-mono">v1.0.0</span>
        </div>
      </header>

      {/* Device Frame */}
      <div className="w-full sm:max-w-[420px] sm:min-h-[850px] sm:h-[860px] sm:rounded-[48px] sm:border-[8px] sm:border-[#1E242E] sm:shadow-[0_25px_70px_rgba(0,0,0,0.85)] bg-[#0D1117] flex flex-col relative overflow-hidden flex-1 sm:flex-none">
        {/* Dynamic Island / Notch + Status Bar */}
        <div className="w-full pt-3 px-7 flex items-center justify-between select-none z-40 bg-[#0D1117]/90 backdrop-blur-sm">
          <span className="text-xs font-semibold text-[#F0EDE6] tracking-tight pl-1">
            {currentTime}
          </span>

          {/* Dynamic Island Pill */}
          <div className="w-24 h-5 rounded-full bg-black/90 flex items-center justify-center border border-white/5 shadow-inner">
            <div className="w-2.5 h-2.5 rounded-full bg-[#1A1A2E] mr-2" />
            <div className="w-2 h-2 rounded-full bg-[#2563EB]/40 animate-pulse" />
          </div>

          <div className="flex items-center gap-1.5 text-[#F0EDE6]">
            <Signal className="w-3.5 h-3.5" />
            <Wifi className="w-3.5 h-3.5" />
            <Battery className="w-4 h-4" />
          </div>
        </div>

        {/* Inner Screen Content */}
        <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden relative">
          {children}
        </div>

        {/* iOS Home Indicator Bar */}
        <div className="w-full py-2 flex justify-center items-center select-none bg-[#0D1117] pointer-events-none">
          <div className="w-36 h-1 rounded-full bg-white/25" />
        </div>
      </div>
    </div>
  );
}
