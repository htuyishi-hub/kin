import { Link } from "wouter";
import { KinnLogo } from "@/components/KinnLogo";

export function Footer() {
  return (
    <footer className="bg-ink border-t border-divider py-12 md:py-16 mt-20">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="col-span-1 md:col-span-2 space-y-4">
          <Link href="/" className="flex items-center gap-2.5 font-serif text-3xl font-bold text-bone">
            <KinnLogo size={36} />
            <span>kinn</span>
          </Link>
          <p className="text-bone-dim max-w-sm">
            Abantu bawe bari hano. A trusted introduction network for serious people in Rwanda.
          </p>
        </div>
        
        <div className="space-y-4">
          <h4 className="font-medium text-bone">Product</h4>
          <ul className="space-y-2 text-sm text-bone-dim">
            <li><Link href="/download" className="hover:text-gold transition-colors font-medium text-gold">Download Android APK</Link></li>
            <li><a href="/landing#how" className="hover:text-gold transition-colors">How it works</a></li>
            <li><Link href="/" className="hover:text-gold transition-colors">Web App</Link></li>
          </ul>
        </div>
        
        <div className="space-y-4">
          <h4 className="font-medium text-bone">Company</h4>
          <ul className="space-y-2 text-sm text-bone-dim">
            <li><Link href="/terms" className="hover:text-gold transition-colors">Terms of Service</Link></li>
            <li><a href="mailto:tuyishimirehonore3@gmail.com" className="hover:text-gold transition-colors">Contact</a></li>
          </ul>
        </div>
      </div>
      
      <div className="container mx-auto px-4 mt-12 pt-8 border-t border-divider text-center text-sm text-bone-ghost">
        <p>© 2026 kinn. All rights reserved.</p>
      </div>
    </footer>
  );
}