import { Link } from "wouter";
import { Download } from "lucide-react";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { RwandaMapAnimation } from "@/components/rwanda-map";
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
      <section className="relative h-[100vh] min-h-[640px] flex items-center justify-center pt-16 overflow-hidden">

        {/* Layer 1 — Rwanda map (primary hero visual) */}
        <div className="absolute inset-0 z-[1] flex items-center justify-center">
          <div className="w-full h-full max-w-5xl mx-auto relative">
            <RwandaMapAnimation />
          </div>
        </div>

        {/* Layer 2 — radial vignette so text stays legible */}
        <div className="absolute inset-0 z-[2] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 68% 55% at 50% 46%, transparent 0%, rgba(13,17,23,0.82) 70%, #0D1117 100%)",
          }}
        />

        {/* Layer 3 — hero text + CTA */}
        <div className="relative z-[3] container mx-auto px-4 flex flex-col items-center text-center" style={{ paddingBottom: "220px" }}>
          <span className="inline-block px-4 py-1.5 mb-6 border border-gold/30 rounded-full text-gold text-xs font-semibold tracking-[0.2em] uppercase backdrop-blur-sm bg-night/30">
            Rwanda's Trusted Network
          </span>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold text-bone mb-5 leading-[1.05] max-w-4xl"
            style={{ textShadow: "0 2px 40px rgba(0,0,0,0.9)" }}>
            Abantu bawe <br />
            <span className="italic text-gold">bari hano.</span>
          </h1>
          <p className="text-lg md:text-xl text-bone-dim max-w-xl mb-10 font-medium leading-relaxed"
            style={{ textShadow: "0 1px 16px rgba(0,0,0,0.95)" }}>
            Not a dating app. A warm, private introduction through a trusted elder.
            For serious people ready to find their person.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3.5">
            <Link
              href="/download"
              className="bg-gold text-night hover:bg-gold/90 font-bold px-8 py-4 text-base rounded-full inline-flex items-center justify-center gap-2.5 transition-all shadow-xl hover:scale-[1.02]"
            >
              <Download className="w-5 h-5" />
              <span>Download Android APK</span>
            </Link>
            <Link
              href="/"
              className="bg-ink-raised border border-divider text-bone hover:border-gold/50 font-semibold px-7 py-4 text-base rounded-full inline-flex items-center justify-center transition-colors backdrop-blur-sm"
            >
              Open Web App
            </Link>
            <Button
              variant="outline"
              className="px-6 py-4 text-sm rounded-full border-bone-ghost/40 text-bone hover:bg-bone hover:text-night transition-colors backdrop-blur-sm"
              onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
            >
              Learn how it works
            </Button>
          </div>
        </div>

        {/* Layer 4 — photo strip: successive, seamless, anchored to the bottom of hero */}
        <div className="absolute bottom-0 left-0 right-0 z-[4]" style={{ height: "210px" }}>
          {/* top fade so strip blends into map */}
          <div className="absolute inset-x-0 top-0 h-20 pointer-events-none z-10"
            style={{ background: "linear-gradient(to bottom, #0D1117, transparent)" }} />
          {/* bottom fade */}
          <div className="absolute inset-x-0 bottom-0 h-20 pointer-events-none z-10"
            style={{ background: "linear-gradient(to top, #0D1117, transparent)" }} />

          <div className="photo-strip h-full overflow-hidden">
            <div className="photo-strip-inner h-full flex">
              {/* Quadruple the images so the seamless loop never shows a gap */}
              {[...images, ...images, ...images, ...images].map((src, i) => (
                <div key={i} className="flex-shrink-0 h-full" style={{ width: "280px" }}>
                  <img
                    src={src}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-cover"
                    style={{ filter: "brightness(0.55) saturate(0.85)" }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="bg-ink border-y border-divider py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-divider">
            <div className="p-4">
              <h3 className="font-serif text-2xl text-gold mb-2">Invite-only</h3>
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
              <h3 className="font-serif text-xl font-bold text-bone mt-4 mb-3">Get Invited</h3>
              <p className="text-bone-dim">A current member must invite you. This keeps our community safe and aligned.</p>
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono mb-4">
              v1.0.0 Android APK Ready
            </div>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-bone mb-6">Ready to meet your person?</h2>
            <p className="text-bone-dim text-lg mb-10 max-w-2xl mx-auto">
              Download the official Android APK directly to your phone, or open the web app instantly in your browser.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/download"
                className="bg-gold text-night hover:bg-gold/90 font-bold px-8 py-4 text-base rounded-full inline-flex items-center justify-center gap-2.5 transition-all shadow-lg w-full sm:w-auto"
              >
                <Download className="w-5 h-5" />
                <span>Download Android APK</span>
              </Link>
              <PwaInstallButton className="px-8 py-4 text-base w-full sm:w-auto rounded-full" />
              <Button
                variant="outline"
                className="px-8 py-4 text-base w-full sm:w-auto rounded-full border-bone-ghost text-bone hover:bg-bone hover:text-night"
                onClick={() => window.location.href = '/'}
              >
                Use in Browser
              </Button>
            </div>
            
            <p className="text-sm text-bone-ghost mt-8">
              Available for Android (Direct APK), iOS (PWA), and Desktop.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}