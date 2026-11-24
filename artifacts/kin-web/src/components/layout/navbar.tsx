import { Link } from "wouter";
import { Download } from "lucide-react";
import { KinnLogo } from "@/components/KinnLogo";

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-night/80 backdrop-blur-md border-b border-divider">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-serif text-2xl font-bold text-bone group">
          <KinnLogo size={32} />
          <span className="tracking-tight text-bone group-hover:text-gold transition-colors">kinn</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-bone-dim">
          <a href="/#how" className="hover:text-bone transition-colors">How it works</a>
          <a href="/#why" className="hover:text-bone transition-colors">Why kinn</a>
          <Link href="/download" className="hover:text-bone transition-colors text-gold font-semibold">Download APK</Link>
          <Link href="/terms" className="hover:text-bone transition-colors">Terms</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link 
            href="/download"
            className="hidden sm:inline-flex items-center gap-1.5 border border-gold/40 text-gold hover:bg-gold/10 px-3 py-1.5 rounded-md font-semibold text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download APK</span>
          </Link>
          <a 
            href="https://app.kinn.ink" 
            className="bg-gold text-night px-4 py-2 rounded-md font-semibold text-sm hover:bg-gold/90 transition-colors"
          >
            Open App
          </a>
        </div>
      </div>
    </header>
  );
}