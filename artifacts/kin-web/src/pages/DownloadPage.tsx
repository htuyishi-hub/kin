import React, { useState } from 'react';
import { Link } from 'wouter';
import { Download, ExternalLink, QrCode, Smartphone, CheckCircle, ShieldAlert, Copy, Check } from 'lucide-react';
import { PwaInstallButton } from '@/components/pwa-install-button';

const LATEST_APK_URL = 'https://github.com/htuyishi-hub/kin/releases/download/v1.0.0-build-20261123074334/app-release.apk';
const GDRIVE_MIRROR_URL = 'https://drive.google.com/file/d/1e757c2rIlXk7nPjx_dT254SX5f3fU11j/view?usp=drivesdk';

export default function DownloadPage() {
  const base = import.meta.env.BASE_URL;
  const [copied, setCopied] = useState(false);

  function copyDownloadLink() {
    navigator.clipboard.writeText(LATEST_APK_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <main className="min-h-screen bg-night text-bone pt-24 pb-20">
      <div className="container mx-auto px-4 max-w-3xl">

        {/* Hero Header */}
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs font-semibold uppercase tracking-wider">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android APK Release</span>
          </div>

          <h1 className="font-serif text-4xl md:text-5xl font-bold text-bone">
            Get <span className="text-gold">kinn</span> on your phone
          </h1>
          <p className="text-bone-dim text-base max-w-lg mx-auto">
            Download and install the official Android app directly. No waitlist, fully native performance, and end-to-end encrypted messaging.
          </p>
        </div>

        {/* Download Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
          
          {/* Card 1: Direct APK */}
          <div className="p-6 rounded-2xl bg-ink-raised border border-divider flex flex-col justify-between space-y-6 hover:border-gold/50 transition-all shadow-xl relative overflow-hidden group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-mono">
                  v1.0.0 APK
                </span>
                <span className="text-xs text-bone-ghost">72 MB</span>
              </div>
              <h3 className="font-serif text-xl font-bold text-bone">Direct APK Package</h3>
              <p className="text-bone-dim text-xs leading-relaxed">
                Official standalone Android release package with Email &amp; Password and Google authentication.
              </p>
            </div>

            <a
              href={LATEST_APK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-5 rounded-xl bg-gold text-night font-bold text-sm flex items-center justify-center gap-2 hover:bg-gold/90 transition-all shadow-lg group-hover:scale-[1.01]"
            >
              <Download className="w-4 h-4" />
              <span>Download APK</span>
            </a>
          </div>

          {/* Card 2: Google Drive Fast Mirror */}
          <div className="p-6 rounded-2xl bg-ink-raised border border-divider flex flex-col justify-between space-y-6 hover:border-trust/50 transition-all shadow-xl group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 rounded-full uppercase text-[10px]">
                  Fast Cloud Mirror
                </span>
                <span className="text-xs text-bone-ghost">Google Drive</span>
              </div>
              <h3 className="font-serif text-xl font-bold text-bone">High-Speed Mirror</h3>
              <p className="text-bone-dim text-xs leading-relaxed">
                Opens directly in Google Drive on your Android device for reliable, high-speed mobile download.
              </p>
            </div>

            <a
              href={GDRIVE_MIRROR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-5 rounded-xl bg-trust text-bone font-bold text-sm flex items-center justify-center gap-2 hover:bg-trust/90 transition-all shadow-lg group-hover:scale-[1.01]"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Download via Drive</span>
            </a>
          </div>
        </div>

        {/* QR Code Section for Desktop Visitors */}
        <div className="p-6 md:p-8 rounded-2xl bg-ink border border-divider mb-12 flex flex-col sm:flex-row items-center gap-8 shadow-xl">
          <div className="p-3 bg-white rounded-xl shadow-md shrink-0 w-36 h-36 flex items-center justify-center">
            <img src={`${base}qr.svg`} alt="Scan QR to Download" className="w-full h-full object-contain" />
          </div>
          <div className="space-y-3 text-center sm:text-left flex-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold">
              <QrCode className="w-4 h-4" />
              <span>Scan with phone camera</span>
            </div>
            <h3 className="font-serif text-lg font-bold text-bone">Visiting on your computer?</h3>
            <p className="text-bone-dim text-xs leading-relaxed">
              Scan this QR code with your Android phone's camera app to open the direct download on your phone instantly.
            </p>
            <button
              onClick={copyDownloadLink}
              className="inline-flex items-center gap-1.5 text-xs text-bone-dim hover:text-gold transition-colors font-mono cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Link copied!' : 'Copy direct link'}</span>
            </button>
          </div>
        </div>

        {/* 3 Steps Install Guide */}
        <div className="p-6 rounded-2xl bg-ink/70 border border-divider space-y-4 mb-12">
          <h3 className="font-serif text-lg font-bold text-bone flex items-center gap-2">
            <span>📲</span>
            <span>How to install on Android (3 Steps)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-bone-dim pt-2">
            <div className="p-4 rounded-xl bg-night border border-divider space-y-2">
              <div className="font-bold text-gold text-sm">Step 1</div>
              <p>Tap <strong className="text-bone">Download APK</strong> above to save the installation file.</p>
            </div>
            <div className="p-4 rounded-xl bg-night border border-divider space-y-2">
              <div className="font-bold text-gold text-sm">Step 2</div>
              <p>When Android warns <span className="text-bone">"File might be harmful"</span>, tap <strong className="text-bone">Download anyway</strong> (standard notice for direct downloads).</p>
            </div>
            <div className="p-4 rounded-xl bg-night border border-divider space-y-2">
              <div className="font-bold text-gold text-sm">Step 3</div>
              <p>Open the file and tap <strong className="text-gold">Install</strong>. If asked, enable <span className="text-bone">Allow from this source</span>.</p>
            </div>
          </div>
        </div>

        {/* iOS / Web Alternative */}
        <div className="text-center pt-6 border-t border-divider space-y-3">
          <p className="text-xs text-bone-dim">Using an iPhone or prefer the web browser?</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <PwaInstallButton className="px-6 py-2.5 text-sm rounded-full" />
            <Link
              href="/"
              className="px-6 py-2.5 text-sm rounded-full border border-bone-ghost/60 text-bone hover:bg-bone hover:text-night transition-colors"
            >
              Use in Browser
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}
