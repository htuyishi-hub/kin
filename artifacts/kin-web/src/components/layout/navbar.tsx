import { Link } from "wouter";

export function Navbar() {
  const base = import.meta.env.BASE_URL;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-night/80 backdrop-blur-md border-b border-divider">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/landing" className="flex items-center gap-2.5 font-serif text-2xl font-bold text-bone group">
          <img
            src={`${base}logo_mark_transparent.png`}
            alt="kinn"
            className="w-8 h-8 rounded-lg object-contain shadow-sm"
          />
          <span className="tracking-tight text-bone group-hover:text-gold transition-colors">kinn</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-bone-dim">
          <a href="#how" className="hover:text-bone transition-colors">How it works</a>
          <a href="#why" className="hover:text-bone transition-colors">Why kinn</a>
          <Link href="/terms" className="hover:text-bone transition-colors">Terms</Link>
        </nav>
        <Link 
          href="/" 
          className="bg-gold text-night px-4 py-2 rounded-md font-semibold text-sm hover:bg-gold/90 transition-colors"
        >
          Open App
        </Link>
      </div>
    </header>
  );
}