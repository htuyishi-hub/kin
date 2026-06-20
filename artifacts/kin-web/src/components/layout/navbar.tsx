import { Link } from "wouter";

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-night/80 backdrop-blur-md border-b border-divider">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-serif text-2xl font-bold text-bone flex items-center gap-2">
          Kin
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-bone-dim">
          <a href="#how" className="hover:text-bone transition-colors">How it works</a>
          <a href="#why" className="hover:text-bone transition-colors">Why Kin</a>
          <Link href="/terms" className="hover:text-bone transition-colors">Terms</Link>
        </nav>
        <a 
          href="#install" 
          className="bg-gold text-night px-4 py-2 rounded-md font-semibold text-sm hover:bg-gold/90 transition-colors"
        >
          Get Kin
        </a>
      </div>
    </header>
  );
}