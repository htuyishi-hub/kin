import React, { useState } from "react";
import { Link } from "wouter";
import { Download, Menu, X, Globe, ArrowUpRight } from "lucide-react";
import { KinnLogo } from "@/components/KinnLogo";
import { changeLanguage, getCurrentLanguage, type SupportedLanguage } from "@workspace/i18n";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lang, setLang] = useState<SupportedLanguage>(getCurrentLanguage());

  const toggleLang = async (next: SupportedLanguage) => {
    setLang(next);
    await changeLanguage(next);
  };

  const isRw = lang === "rw";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-night/85 backdrop-blur-xl border-b border-divider/80">
      <div className="container mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-serif text-2xl font-bold text-bone group">
          <KinnLogo size={32} />
          <span className="tracking-tight text-bone group-hover:text-gold transition-colors">kinn</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-bone-dim">
          <a href="/#features" className="hover:text-bone transition-colors">
            {isRw ? "Ibikorwa" : "Features"}
          </a>
          <a href="/#safety" className="hover:text-bone transition-colors">
            {isRw ? "Umutekano" : "Safety"}
          </a>
          <a href="/#pricing" className="hover:text-bone transition-colors">
            {isRw ? "Ibiciro" : "Pricing"}
          </a>
          <a href="/#faq" className="hover:text-bone transition-colors">
            FAQ
          </a>
          <Link href="/download" className="hover:text-gold transition-colors text-gold font-semibold">
            {isRw ? "Kuramo APK" : "Download APK"}
          </Link>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center bg-ink border border-divider rounded-full p-0.5 text-xs font-semibold">
            <Globe className="w-3.5 h-3.5 text-bone-dim ml-2 mr-1" />
            <button
              type="button"
              onClick={() => toggleLang("en")}
              className={`px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
                lang === "en" ? "bg-gold text-night font-bold" : "text-bone-dim hover:text-bone"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => toggleLang("rw")}
              className={`px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
                lang === "rw" ? "bg-gold text-night font-bold" : "text-bone-dim hover:text-bone"
              }`}
            >
              RW
            </button>
          </div>

          <Link
            href="/download"
            className="inline-flex items-center gap-1.5 border border-gold/40 text-gold hover:bg-gold/10 px-3.5 py-2 rounded-full font-semibold text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>APK</span>
          </Link>

          <a
            href="https://app.kinn.ink"
            className="inline-flex items-center gap-1.5 bg-gold text-night px-4 py-2 rounded-full font-bold text-xs hover:bg-gold/90 transition-all shadow-lg shadow-gold/15"
          >
            <span>{isRw ? "Fungura App" : "Open Web App"}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden p-2 rounded-lg border border-divider text-bone"
          aria-label="Menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-ink border-b border-divider px-4 py-5 space-y-4">
          <div className="flex flex-col gap-3 text-sm font-medium text-bone-dim">
            <a href="/#features" onClick={() => setMobileOpen(false)} className="hover:text-bone">
              {isRw ? "Ibikorwa" : "Features"}
            </a>
            <a href="/#safety" onClick={() => setMobileOpen(false)} className="hover:text-bone">
              {isRw ? "Umutekano" : "Safety"}
            </a>
            <a href="/#pricing" onClick={() => setMobileOpen(false)} className="hover:text-bone">
              {isRw ? "Ibiciro" : "Pricing"}
            </a>
            <a href="/#faq" onClick={() => setMobileOpen(false)} className="hover:text-bone">
              FAQ
            </a>
            <Link href="/download" onClick={() => setMobileOpen(false)} className="text-gold font-semibold">
              {isRw ? "Kuramo Android APK" : "Download Android APK"}
            </Link>
            <Link href="/terms" onClick={() => setMobileOpen(false)} className="hover:text-bone">
              {isRw ? "Amategeko" : "Terms"}
            </Link>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-divider">
            <div className="flex items-center gap-1 bg-night border border-divider rounded-full p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => toggleLang("en")}
                className={`px-3 py-1 rounded-full ${lang === "en" ? "bg-gold text-night font-bold" : "text-bone-dim"}`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => toggleLang("rw")}
                className={`px-3 py-1 rounded-full ${lang === "rw" ? "bg-gold text-night font-bold" : "text-bone-dim"}`}
              >
                RW
              </button>
            </div>
            <a
              href="https://app.kinn.ink"
              className="bg-gold text-night px-4 py-2 rounded-full font-bold text-xs"
            >
              {isRw ? "Fungura App" : "Open Web App"}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}