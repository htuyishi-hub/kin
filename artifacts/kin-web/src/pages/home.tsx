import { PwaInstallButton } from "@/components/pwa-install-button";
import { Button } from "@/components/ui/button";

export default function Home() {
  const base = import.meta.env.BASE_URL;
  const images = [
    `${base}images/couple1.jpg`,
    `${base}images/couple2.jpg`,
    `${base}images/couple3.jpg`,
    `${base}images/couple4.jpg`,
    `${base}images/couple5.jpg`,
    `${base}images/couple6.jpg`,
  ];

  return (
    <main className="min-h-screen bg-night text-bone overflow-hidden">
      {/* HERO SECTION */}
      <section className="relative h-[90vh] min-h-[600px] flex items-center justify-center pt-16 overflow-hidden">
        {/* Background sliding banner */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-night/70 z-10"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-night via-night/50 to-transparent z-10"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-night via-transparent to-night z-10"></div>
          
          <div className="w-[200%] h-full flex scroller">
            <div className="scroller-inner h-full flex gap-4 pr-4">
              {[...images, ...images].map((src, i) => (
                <div key={i} className="h-full w-auto min-w-[30vw] flex-shrink-0">
                  <img 
                    src={src} 
                    alt="Rwandan couple" 
                    className="w-full h-full object-cover rounded-xl grayscale-[20%] sepia-[20%]"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-20 container mx-auto px-4 flex flex-col items-center text-center">
          <span className="inline-block px-4 py-1.5 mb-6 border border-gold/30 rounded-full text-gold text-sm font-medium tracking-wide uppercase tracking-[0.2em]">
            Rwanda's Trusted Network
          </span>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold text-bone mb-6 leading-tight max-w-4xl drop-shadow-2xl">
            Abantu bawe <br/><span className="text-gold italic">bari hano.</span>
          </h1>
          <p className="text-lg md:text-xl text-bone-dim max-w-2xl mb-10 font-medium drop-shadow-md">
            Not a dating app. A warm, private introduction through a trusted elder. 
            For serious people ready to find their person.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <PwaInstallButton className="px-8 py-6 text-lg rounded-full" />
            <Button variant="outline" className="px-8 py-6 text-lg rounded-full border-bone-ghost text-bone hover:bg-bone hover:text-night transition-colors" onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}>
              Learn how it works
            </Button>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="bg-ink border-y border-divider py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-divider">
            <div className="p-4">
              <h3 className="font-serif text-2xl text-gold mb-2">Vouch-only</h3>
              <p className="text-bone-dim">You must be invited by a trusted member to join.</p>
            </div>
            <div className="p-4">
              <h3 className="font-serif text-2xl text-gold mb-2">Serious Intent</h3>
              <p className="text-bone-dim">Built for meaningful, long-term relationships.</p>
            </div>
            <div className="p-4">
              <h3 className="font-serif text-2xl text-gold mb-2">Private</h3>
              <p className="text-bone-dim">Your profile is only visible to curated matches.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-24 bg-night relative">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-bone mb-6">Like an introduction from family.</h2>
            <p className="text-bone-dim text-lg">We've digitized the traditional Rwandan way of meeting someone special — through community, trust, and intention.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            <div className="relative p-8 rounded-2xl bg-ink-raised border border-divider">
              <div className="absolute -top-6 left-8 w-12 h-12 rounded-full bg-trust flex items-center justify-center font-serif text-xl font-bold text-white shadow-lg">1</div>
              <h3 className="font-serif text-xl font-bold text-bone mt-4 mb-3">Get Vouched</h3>
              <p className="text-bone-dim">A current member must vouch for your character. This keeps our community safe and aligned.</p>
            </div>
            <div className="relative p-8 rounded-2xl bg-ink-raised border border-divider">
              <div className="absolute -top-6 left-8 w-12 h-12 rounded-full bg-trust flex items-center justify-center font-serif text-xl font-bold text-white shadow-lg">2</div>
              <h3 className="font-serif text-xl font-bold text-bone mt-4 mb-3">Share Intentions</h3>
              <p className="text-bone-dim">Complete a thoughtful profile focusing on values, family, and what you're building in life.</p>
            </div>
            <div className="relative p-8 rounded-2xl bg-ink-raised border border-divider">
              <div className="absolute -top-6 left-8 w-12 h-12 rounded-full bg-trust flex items-center justify-center font-serif text-xl font-bold text-white shadow-lg">3</div>
              <h3 className="font-serif text-xl font-bold text-bone mt-4 mb-3">Curated Matches</h3>
              <p className="text-bone-dim">Receive mindful introductions. If both are interested, you connect.</p>
            </div>
          </div>
        </div>
      </section>

      {/* INSTALL SECTION */}
      <section id="install" className="py-24 bg-ink border-t border-divider relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-trust/5 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gold/5 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto bg-night border border-divider rounded-3xl p-8 md:p-16 text-center">
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-bone mb-6">Ready to meet your person?</h2>
            <p className="text-bone-dim text-lg mb-10 max-w-2xl mx-auto">
              Kin is designed as a web app. Install it directly to your phone's home screen for the best experience.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <PwaInstallButton className="px-8 py-4 text-lg w-full sm:w-auto" />
              <Button variant="outline" className="px-8 py-4 text-lg w-full sm:w-auto border-bone-ghost text-bone hover:bg-bone hover:text-night" onClick={() => window.location.href = '/'}>
                Use in Browser
              </Button>
            </div>
            
            <p className="text-sm text-bone-ghost mt-8">
              Available for iOS, Android, and Desktop.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}