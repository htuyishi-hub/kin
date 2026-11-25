import React, { useState } from "react";
import { Link } from "wouter";
import {
  Download,
  ShieldCheck,
  MapPin,
  Flame,
  Trophy,
  Heart,
  Mic,
  EyeOff,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ArrowUpRight,
  Lock,
  Smartphone,
} from "lucide-react";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { RwandaMapAnimation } from "@/components/rwanda-map";
import { useTranslation } from "react-i18next";

const FAQS = [
  {
    qEn: "Who can join kinn?",
    aEn: "Any verified adult (18+) physically located in Rwanda — university students, graduates, and working professionals across Kigali, Huye, Rubavu, and Musanze.",
    qRw: "Ninde wemerewe kwinjira kuri kinn?",
    aRw: "Umuntu wese ufite imyaka 18+ uherereye mu Rwanda — abanyeshuri ba kaminuza, abarangije kwiga, n'abakozi muri Kigali, Huye, Rubavu, na Musanze.",
  },
  {
    qEn: "How does the Rwanda-Only GPS Shield stop bots?",
    aEn: "kinn verifies your real device GPS coordinates inside Rwanda (-2.84° to -1.04° lat, 28.86° to 30.90° lng) and rejects foreign or spoofed locations automatically.",
    qRw: "GPS yo mu Rwanda irinda ite abashukanyi?",
    aRw: "kinn igenzura aho uherereye mu Rwanda ukoresheje GPS ya nyayo, igahita yanga konti zose ziva hanze y'igihugu cyangwa zikoresha amayeri.",
  },
  {
    qEn: "How do MTN MoMo payments (100 / 200 / 300 RWF) work?",
    aEn: "There are no expensive monthly subscriptions. Unlock secret admirers, send a virtual coffee or rose, or boost your profile anytime via MTN MoMo Code 623507.",
    qRw: "Kwishyura na MTN MoMo (100 / 200 / 300 RWF) bikora bite?",
    aRw: "Nta fatabuguzi ry'ukwezi rihanitse rihari. Fungura abakunzi bawe cyangwa wohereze impano ukoresheje Code 623507 igihe ubishakiye.",
  },
  {
    qEn: "Can I hide my profile from friends, coworkers, or exes?",
    aEn: "Yes. Use 1-Tap Phone Contact Import in Privacy Settings to block specific numbers so you remain 100% mutually invisible, or enable Incognito Mode.",
    qRw: "Nshobora guhisha umwirondoro wanjye inshuti cyangwa abavandimwe?",
    aRw: "Yego. Hitamo nimero mu mazina ya telefone yawe muri Settings cyangwa ufungure Incognito Mode kugira ngo utagaragara.",
  },
];

export default function Home() {
  const { i18n } = useTranslation();
  const isRw = i18n.language === "rw";
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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
      <section className="relative min-h-[94vh] flex items-center justify-center pt-20 pb-48 overflow-hidden">
        {/* Layer 1 — Rwanda map */}
        <div className="absolute inset-0 z-[1] flex items-center justify-center">
          <div className="w-full h-full max-w-5xl mx-auto relative">
            <RwandaMapAnimation />
          </div>
        </div>

        {/* Layer 2 — radial vignette */}
        <div
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 72% 60% at 50% 45%, transparent 0%, rgba(13,17,23,0.85) 70%, #0D1117 100%)",
          }}
        />

        {/* Layer 3 — hero text + CTAs */}
        <div className="relative z-[3] container mx-auto px-4 lg:px-8 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 border border-gold/35 rounded-full text-gold text-xs font-semibold tracking-[0.16em] uppercase backdrop-blur-md bg-night/50">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{isRw ? "🇷🇼 Mu Rwanda Hose · Kigali · Huye · Rubavu" : "🇷🇼 Live Across Rwanda · Kigali · Huye · Rubavu"}</span>
          </div>

          <h1
            className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-bone mb-6 leading-[1.03] max-w-4xl tracking-tight"
            style={{ textShadow: "0 2px 40px rgba(0,0,0,0.9)" }}
          >
            {isRw ? (
              <>
                Abantu bawe <br />
                <span className="italic text-gold">bari hano.</span>
              </>
            ) : (
              <>
                Meet Real People <br />
                <span className="italic text-gold">Across Rwanda.</span>
              </>
            )}
          </h1>

          <p
            className="text-base sm:text-lg md:text-xl text-bone-dim max-w-2xl mb-10 font-medium leading-relaxed"
            style={{ textShadow: "0 1px 16px rgba(0,0,0,0.95)" }}
          >
            {isRw
              ? "Urubuga rwizewe ruhuza abantu nyabo mu Rwanda — bemejwe na GPS ya nyayo, umutekano usesuye, n'uburyo bworoshye bwa MTN MoMo."
              : "Rwanda's verified dating & connection platform. Built with strict Rwanda-only GPS anti-bot protection, live date safety monitoring, and instant MTN MoMo micro-unlocks."}
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
            <a
              href="https://app.kinn.ink"
              className="bg-gold text-night hover:bg-gold/90 font-bold px-8 py-4 text-base rounded-full inline-flex items-center justify-center gap-2 transition-all shadow-xl shadow-gold/20 hover:scale-[1.02] w-full sm:w-auto"
            >
              <span>{isRw ? "Fungura Web App" : "Open Web App"}</span>
              <ArrowUpRight className="w-5 h-5" />
            </a>
            <Link
              href="/download"
              className="bg-ink-raised border border-divider text-bone hover:border-gold/50 font-semibold px-7 py-4 text-base rounded-full inline-flex items-center justify-center gap-2 transition-colors backdrop-blur-sm w-full sm:w-auto"
            >
              <Download className="w-5 h-5 text-gold" />
              <span>{isRw ? "Kuramo Android APK" : "Download Android APK"}</span>
            </Link>
          </div>
        </div>

        {/* Layer 4 — seamless photo strip */}
        <div className="absolute bottom-0 left-0 right-0 z-[4]" style={{ height: "190px" }}>
          <div
            className="absolute inset-x-0 top-0 h-20 pointer-events-none z-10"
            style={{ background: "linear-gradient(to bottom, #0D1117, transparent)" }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-20 pointer-events-none z-10"
            style={{ background: "linear-gradient(to top, #0D1117, transparent)" }}
          />
          <div className="photo-strip h-full overflow-hidden">
            <div className="photo-strip-inner h-full flex">
              {[...images, ...images, ...images, ...images].map((src, i) => (
                <div key={i} className="flex-shrink-0 h-full" style={{ width: "260px" }}>
                  <img
                    src={src}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-cover"
                    style={{ filter: "brightness(0.5) saturate(0.85)" }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ENTERPRISE TRUST & METRICS BAR */}
      <section className="bg-ink border-y border-divider py-10">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            <div className="p-4 rounded-2xl bg-night/50 border border-divider/60">
              <div className="text-2xl md:text-3xl font-serif font-bold text-gold mb-1">100% RW</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-bone-dim">
                {isRw ? "GPS yo mu Rwanda gusa" : "Hardware GPS Geofence"}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-night/50 border border-divider/60">
              <div className="text-2xl md:text-3xl font-serif font-bold text-emerald-400 mb-1">✓ Verified</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-bone-dim">
                {isRw ? "Kwemeza isura na kamera" : "Live Selfie & UR Badges"}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-night/50 border border-divider/60">
              <div className="text-2xl md:text-3xl font-serif font-bold text-bone mb-1">100 RWF</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-bone-dim">
                {isRw ? "MTN MoMo Code 623507" : "MTN MoMo Sachet Economy"}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-night/50 border border-divider/60">
              <div className="text-2xl md:text-3xl font-serif font-bold text-sky-400 mb-1">8:00 PM</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-bone-dim">
                {isRw ? "Rush Blind Speed Date" : "Live 3-Min Blind Rush"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENTO FEATURE ARCHITECTURE */}
      <section id="features" className="py-24 bg-night relative">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="inline-block px-3.5 py-1 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs font-bold uppercase tracking-widest mb-4">
              {isRw ? "Ibyiza bya kinn" : "Platform Architecture"}
            </span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-bone mb-4">
              {isRw ? "Byubakiwe u Rwanda rw'iki gihe." : "Engineered for authentic Rwandan connections."}
            </h2>
            <p className="text-bone-dim text-base md:text-lg">
              {isRw
                ? "Kuva ku kwerekana amafoto nka Story kugeza ku biganiro byihuse bya saa mbiri z'ijoro."
                : "Every interaction is fast, intentional, and designed to turn online matches into safe real-world Kigali dates."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <FeatureCard
              icon={<Heart className="w-5 h-5 text-[#FF6B6B]" />}
              badge="Discovery"
              title={isRw ? "Ikarita & Voice Bio 15s" : "Interactive Deck & 15s Voice Bio"}
              desc={isRw
                ? "Kanda ku ifoto urebe izindi, wumve ijwi rye mu masegonda 15, cyangwa umwoherereze ikawa (100 RWF)."
                : "Story-style photo tapping, 15-second voice bios, Free Tonight status, Weekend Passport, and Virtual Coffee (100 RWF)."}
            />
            <FeatureCard
              icon={<Flame className="w-5 h-5 text-[#FF6B6B]" />}
              badge="Live Event"
              title={isRw ? "8 PM Rush Blind Date" : "The 8 PM Rush Blind Date"}
              desc={isRw
                ? "Iminota 3 yo kuganira amafoto ahishwe. Mwahuriza hamwe, amafoto agahita afunguka."
                : "3-minute live blind chat every evening. Photos stay blurred until both tap Reveal & Match at 0:00."}
            />
            <FeatureCard
              icon={<Trophy className="w-5 h-5 text-gold" />}
              badge="Leaderboard"
              title={isRw ? "Abakunzwe muri Kaminuza n'Umujyi" : "Most Wanted Campus & City Podium"}
              desc={isRw
                ? "Tora buri munsi cyangwa wohereze Urubuto (100 RWF) utere inkunga inshuti zawe muri Kigali na Huye."
                : "Weekly rankings across UR Huye, Gikondo, and Kigali with 100 RWF Rose votes and VIP Spotlight."}
            />
            <FeatureCard
              icon={<Mic className="w-5 h-5 text-sky-400" />}
              badge="Chat Playground"
              title={isRw ? "Ikiganiro gishyushye & Date Spots" : "Rich Chat & Kigali Date Spots"}
              desc={isRw
                ? "Amajwi y'amasegonda 60, umukino w'ibibazo, n'ubutumire bwo guhurira ahantu heza i Kigali."
                : "60s voice notes, mystery question games, message reactions, ⚡ Nudge, and 1-tap Kigali date spot invites."}
            />
            <FeatureCard
              icon={<Sparkles className="w-5 h-5 text-gold" />}
              badge="Admirers"
              title={isRw ? "Menya uwagukunze n'uwagushakishije" : "Secret Admirers & Name Search Reveal"}
              desc={isRw
                ? "Fungura abagukunze cyangwa abashakishije izina ryawe na 300 RWF gusa kuri MTN MoMo."
                : "See everyone who liked your profile or searched your exact name in Kigali for just 300 RWF."}
            />
            <FeatureCard
              icon={<MapPin className="w-5 h-5 text-emerald-400" />}
              badge="Intent Badges"
              title={isRw ? "Abanyeshuri & Abakozi 18+" : "Open to All Verified Adults"}
              desc={isRw
                ? "Abanyeshuri ba UR bafite ikirango cyabo, abakozi n'abarangije kwiga nabo bakinjira nta mbogamizi."
                : "Clear Marriage, Serious Dating, and Casual badges—welcoming both university students and working professionals."}
            />
          </div>
        </div>
      </section>

      {/* ENTERPRISE SAFETY & RWANDA GPS SHIELD */}
      <section id="safety" className="py-24 bg-ink border-y border-divider relative overflow-hidden">
        <div className="container mx-auto px-4 lg:px-8 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-widest">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isRw ? "Umutekano n'Ubuzima Bwite" : "Zero-Bot & Physical Safety"}</span>
              </span>
              <h2 className="font-serif text-4xl md:text-5xl font-bold text-bone leading-tight">
                {isRw ? "Abantu ba nyabo bari mu Rwanda gusa." : "100% real locals. Zero foreign bots."}
              </h2>
              <p className="text-bone-dim text-base leading-relaxed">
                {isRw
                  ? "kinn ikoresha GPS ya nyayo ikemeza ko uri mu Rwanda, ikaguha uburenganzira bwo guhisha inshuti zawe, ndetse no gusangiza aho uri mu gihe cyo guhura."
                  : "Every account is anchored by hardware GPS geofencing inside Rwanda and mandatory Rwandan phone verification—eliminating fake overseas profiles."}
              </p>

              <div className="space-y-3 pt-2">
                <SafetyRow
                  icon={<Lock className="w-4 h-4 text-emerald-400" />}
                  title={isRw ? "GPS yo mu Rwanda Gusa" : "Strict Rwanda GPS Geofence"}
                  desc={isRw ? "Konti zose ziva hanze y'u Rwanda zirahagarikwa." : "Automatically blocks spoofed or foreign coordinates outside Rwanda."}
                />
                <SafetyRow
                  icon={<EyeOff className="w-4 h-4 text-gold" />}
                  title={isRw ? "Hisha Inshuti & Umuryango" : "1-Tap Phone Contact Shield"}
                  desc={isRw ? "Funga nimero z'inshuti cyangwa abo mukorana mu kanya gato." : "Import contacts to stay 100% mutually invisible to friends, coworkers, and exes."}
                />
                <SafetyRow
                  icon={<MapPin className="w-4 h-4 text-sky-400" />}
                  title={isRw ? "Aho Uri & SOS ku Nshuti" : "Live Date Location & 1-Tap SOS"}
                  desc={isRw ? "Reba iminota asigaje kugera aho muhurira nohereze SOS igihe bibaye ngombwa." : "Real-time walking ETA in chat plus 1-tap WhatsApp SOS GPS dispatch to your bestie."}
                />
              </div>
            </div>

            <div className="bg-night border border-divider rounded-3xl p-7 md:p-9 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-divider pb-4">
                <span className="text-xs font-mono uppercase tracking-wider text-emerald-400">
                  ● GPS SHIELD ACTIVE
                </span>
                <span className="text-xs font-semibold text-bone-dim">RWANDA (-2.84° to -1.04°)</span>
              </div>
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-ink border border-emerald-500/30 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-bone">📍 Kimihurura, Gasabo</div>
                    <div className="text-xs text-bone-dim">Hardware GPS Verified · ✓</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold">
                    ALLOWED
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-ink border border-divider flex items-center justify-between opacity-75">
                  <div>
                    <div className="text-sm font-bold text-bone">📍 UR Huye Campus, Huye</div>
                    <div className="text-xs text-bone-dim">Smart Travel Shift Detected</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-400 text-xs font-bold">
                    SYNCED
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-ink border border-[#FF6B6B]/30 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-[#FF6B6B]">🚫 Foreign / Spoofed IP-GPS</div>
                    <div className="text-xs text-bone-dim">403 LOCATION_UNSUPPORTED</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#FF6B6B]/15 text-[#FF6B6B] text-xs font-bold">
                    BLOCKED
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SACHET PRICING MATRIX (100 / 200 / 300 RWF) */}
      <section id="pricing" className="py-24 bg-night">
        <div className="container mx-auto px-4 lg:px-8 max-w-5xl">
          <div className="text-center mb-14">
            <span className="inline-block px-3.5 py-1 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs font-bold uppercase tracking-widest mb-4">
              MTN MoMo Code · 623507
            </span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-bone mb-4">
              {isRw ? "Ibiciro byoroheye buri wese." : "Pay only for what you use."}
            </h2>
            <p className="text-bone-dim text-base">
              {isRw
                ? "Nta fatabuguzi rihenze. Koresha 100, 200, cyangwa 300 RWF kuri MTN MoMo."
                : "No expensive monthly subscriptions. Instant micro-unlocks via MTN MoMo."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PricingTier
              price="100 RWF"
              name={isRw ? "Micro-Coins" : "Micro-Impulse"}
              items={[
                isRw ? "Gusubiza inyuma ikarita (Rewind)" : "Instant Swipe Rewind",
                isRw ? "Urubuto mu kiganiro 🌹" : "Digital Rose in Chat 🌹",
                isRw ? "Ikawa ku ikarita ☕" : "Virtual Coffee on Deck ☕",
                isRw ? "Gushakisha mu ibanga" : "Anonymous Search Shield",
                isRw ? "Amahirwe ya 2 (Second Chance)" : "Second Chance Card Revive",
              ]}
            />
            <PricingTier
              price="200 RWF"
              name={isRw ? "Active Dater" : "Pocket Change"}
              featured
              items={[
                isRw ? "Swipes 25 z'inyongera" : "25 Swipes Refill",
                isRw ? "Igitekerezo ku ifoto 💬" : "Pinned Photo Compliment 💬",
                isRw ? "Cocktail ku ikarita 🍸" : "Virtual Cocktail on Deck 🍸",
                isRw ? "Gukangura ikiganiro cyarangiye" : "72-Hour Match Revive",
                isRw ? "Passport (Rubavu / Musanze) ✈️" : "Weekend Travel Passport ✈️",
              ]}
            />
            <PricingTier
              price="300 RWF"
              name={isRw ? "Curiosity & Status" : "Curiosity & VIP"}
              items={[
                isRw ? "Reba abagukunze bose (24h)" : "Unblur Secret Admirers (24h)",
                isRw ? "Menya abashakishije izina ryawe" : "Who Searched Your Name 🔎",
                isRw ? "VIP Spotlight (Amasaha 2) 🌟" : "2-Hour VIP Spotlight 🌟",
                isRw ? "Kwiyongera kugaragara 10x ⚡" : "30-Min 10x Profile Boost ⚡",
              ]}
            />
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="py-20 bg-ink border-t border-divider">
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-bone text-center mb-10">
            {isRw ? "Ibibazo Bikunze Kubazwa" : "Frequently Asked Questions"}
          </h2>
          <div className="space-y-3">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className="bg-night border border-divider rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left cursor-pointer"
                  >
                    <span className="font-semibold text-sm md:text-base text-bone">
                      {isRw ? item.qRw : item.qEn}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-gold transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-4 text-sm text-bone-dim leading-relaxed">
                      {isRw ? item.aRw : item.aEn}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* INSTALL / CTA SECTION */}
      <section id="install" className="py-24 bg-night border-t border-divider relative overflow-hidden">
        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="max-w-4xl mx-auto bg-ink border border-gold/30 rounded-3xl p-8 md:p-16 text-center shadow-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono mb-4">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android APK · iOS PWA · Web App</span>
            </div>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-bone mb-5">
              {isRw ? "Witeguye guhura n'uwawe?" : "Ready to meet your person?"}
            </h2>
            <p className="text-bone-dim text-base md:text-lg mb-10 max-w-2xl mx-auto">
              {isRw
                ? "Fungura kinn muri browser cyangwa ukuremo Android APK kuri telefone yawe."
                : "Join verified daters across Kigali, Huye, Rubavu, and Musanze in under 60 seconds."}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://app.kinn.ink"
                className="bg-gold text-night hover:bg-gold/90 font-bold px-8 py-4 text-base rounded-full inline-flex items-center justify-center gap-2 transition-all shadow-lg w-full sm:w-auto"
              >
                <span>{isRw ? "Fungura Web App" : "Open Web App"}</span>
                <ArrowUpRight className="w-5 h-5" />
              </a>
              <Link
                href="/download"
                className="bg-ink-raised border border-divider text-bone hover:border-gold/50 font-bold px-8 py-4 text-base rounded-full inline-flex items-center justify-center gap-2.5 transition-all w-full sm:w-auto"
              >
                <Download className="w-5 h-5 text-gold" />
                <span>{isRw ? "Kuramo Android APK" : "Download Android APK"}</span>
              </Link>
              <PwaInstallButton className="px-8 py-4 text-base w-full sm:w-auto rounded-full" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  icon,
  badge,
  title,
  desc,
}: {
  icon: React.ReactNode;
  badge: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="p-7 rounded-3xl bg-ink border border-divider hover:border-gold/40 transition-colors flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-2xl bg-night border border-divider flex items-center justify-center">
          {icon}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-night border border-divider text-bone-dim">
          {badge}
        </span>
      </div>
      <h3 className="font-serif text-xl font-bold text-bone mt-1">{title}</h3>
      <p className="text-sm text-bone-dim leading-relaxed">{desc}</p>
    </div>
  );
}

function SafetyRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-night/60 border border-divider">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <div className="text-sm font-bold text-bone">{title}</div>
        <div className="text-xs text-bone-dim mt-0.5">{desc}</div>
      </div>
    </div>
  );
}

function PricingTier({
  price,
  name,
  items,
  featured,
}: {
  price: string;
  name: string;
  items: string[];
  featured?: boolean;
}) {
  return (
    <div
      className={`p-7 rounded-3xl border flex flex-col gap-4 ${
        featured ? "bg-ink border-gold shadow-xl shadow-gold/10" : "bg-ink border-divider"
      }`}
    >
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-gold">{name}</span>
        <div className="font-serif text-3xl font-bold text-bone mt-1">{price}</div>
      </div>
      <ul className="space-y-2.5 flex-1">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-bone-dim">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <a
        href="https://app.kinn.ink"
        className={`w-full py-2.5 rounded-full text-center text-xs font-bold transition-colors ${
          featured ? "bg-gold text-night hover:bg-gold/90" : "bg-night border border-divider text-bone hover:border-gold/50"
        }`}
      >
        MoMo · 623507
      </a>
    </div>
  );
}