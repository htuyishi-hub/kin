import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-ink border-t border-divider py-12 md:py-16 mt-20">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="col-span-1 md:col-span-2 space-y-4">
          <Link href="/" className="font-serif text-3xl font-bold text-bone">
            Kin
          </Link>
          <p className="text-bone-dim max-w-sm">
            Abantu bawe bari hano. A trusted introduction network for serious people in Rwanda.
          </p>
        </div>
        
        <div className="space-y-4">
          <h4 className="font-medium text-bone">Product</h4>
          <ul className="space-y-2 text-sm text-bone-dim">
            <li><a href="#how" className="hover:text-gold transition-colors">How it works</a></li>
            <li><a href="#install" className="hover:text-gold transition-colors">Get the app</a></li>
          </ul>
        </div>
        
        <div className="space-y-4">
          <h4 className="font-medium text-bone">Company</h4>
          <ul className="space-y-2 text-sm text-bone-dim">
            <li><Link href="/terms" className="hover:text-gold transition-colors">Terms of Service</Link></li>
            <li><a href="mailto:support@kin.rw" className="hover:text-gold transition-colors">Contact</a></li>
          </ul>
        </div>
      </div>
      
      <div className="container mx-auto px-4 mt-12 pt-8 border-t border-divider text-center text-sm text-bone-ghost">
        <p>© 2026 Kin Rwanda. All rights reserved.</p>
      </div>
    </footer>
  );
}