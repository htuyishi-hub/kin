import { Link } from "wouter";
import { ShieldCheck, MapPin, Mail } from "lucide-react";
import { KinnLogo } from "@/components/KinnLogo";

export function Footer() {
  return (
    <footer className="bg-ink border-t border-divider py-14 md:py-20">
      <div className="container mx-auto px-4 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="col-span-1 md:col-span-2 space-y-4">
          <Link href="/" className="flex items-center gap-2.5 font-serif text-3xl font-bold text-bone">
            <KinnLogo size={36} />
            <span>kinn</span>
          </Link>
          <p className="text-bone-dim max-w-md text-sm leading-relaxed">
            Abantu bawe bari hano. Rwanda's verified connection platform built for real people, real neighborhoods, and meaningful dates.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-bone-dim">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-night border border-divider">
              <MapPin className="w-3.5 h-3.5 text-gold" />
              Kigali · Huye · Rubavu · Musanze
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-night border border-divider">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              MTN MoMo 623507
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-bone">Platform</h4>
          <ul className="space-y-2.5 text-sm text-bone-dim">
            <li><a href="/#features" className="hover:text-gold transition-colors">Features</a></li>
            <li><a href="/#safety" className="hover:text-gold transition-colors">Rwanda GPS Shield</a></li>
            <li><a href="/#pricing" className="hover:text-gold transition-colors">MoMo Pricing</a></li>
            <li><Link href="/download" className="hover:text-gold transition-colors text-gold font-medium">Download Android APK</Link></li>
            <li><a href="https://app.kinn.ink" className="hover:text-gold transition-colors">Open Web App</a></li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-bone">Trust & Legal</h4>
          <ul className="space-y-2.5 text-sm text-bone-dim">
            <li><Link href="/terms" className="hover:text-gold transition-colors">Terms of Service</Link></li>
            <li><a href="/#faq" className="hover:text-gold transition-colors">FAQ</a></li>
            <li>
              <a href="mailto:tuyishimirehonore3@gmail.com" className="inline-flex items-center gap-1.5 hover:text-gold transition-colors">
                <Mail className="w-3.5 h-3.5" />
                <span>Support</span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="container mx-auto px-4 lg:px-8 mt-12 pt-8 border-t border-divider flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-bone-ghost">
        <p>© 2026 kinn. All rights reserved.</p>
        <p>Built for Rwanda 🇷🇼 · Verified 18+ Community</p>
      </div>
    </footer>
  );
}