export default function Terms() {
  return (
    <div className="min-h-screen bg-night text-bone pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-4xl flex flex-col md:flex-row gap-12">
        {/* Sticky Sidebar */}
        <aside className="hidden md:block w-64 shrink-0">
          <div className="sticky top-32 space-y-4 border-l border-divider pl-6">
            <h3 className="font-serif font-bold text-gold uppercase tracking-widest text-sm mb-6">Contents</h3>
            <ul className="space-y-3 text-sm text-bone-dim">
              <li><a href="#eligibility" className="hover:text-bone transition-colors">1. Eligibility</a></li>
              <li><a href="#vouch" className="hover:text-bone transition-colors">2. The Vouch System</a></li>
              <li><a href="#conduct" className="hover:text-bone transition-colors">3. User Conduct</a></li>
              <li><a href="#privacy" className="hover:text-bone transition-colors">4. Privacy & Data</a></li>
              <li><a href="#communication" className="hover:text-bone transition-colors">5. Match Communication</a></li>
              <li><a href="#termination" className="hover:text-bone transition-colors">6. Account Termination</a></li>
              <li><a href="#liability" className="hover:text-bone transition-colors">7. Limitation of Liability</a></li>
            </ul>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 prose prose-invert prose-bone max-w-none">
          <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
          <p className="text-bone-dim text-lg mb-12">Last updated: May 15, 2026</p>

          <p>
            Welcome to Kin. By accessing or using our service, you agree to be bound by these Terms of Service. 
            Kin is designed as a trusted introduction network for serious people in Rwanda. Our terms reflect 
            our commitment to maintaining a safe, respectful, and intentional community.
          </p>

          <section id="eligibility" className="mt-12 scroll-mt-24">
            <h2 className="font-serif text-2xl font-bold text-gold">1. Eligibility</h2>
            <p>To use Kin, you must meet the following criteria:</p>
            <ul>
              <li>Be at least 22 years of age.</li>
              <li>Be a current resident of Rwanda.</li>
              <li>Be legally permitted to use the service under applicable laws.</li>
              <li>Be seeking a serious, long-term relationship.</li>
            </ul>
            <p>Kin reserves the right to verify eligibility and suspend accounts that do not meet these criteria.</p>
          </section>

          <section id="vouch" className="mt-12 scroll-mt-24">
            <h2 className="font-serif text-2xl font-bold text-gold">2. The Vouch System</h2>
            <p>
              Kin operates on a strict invite-only basis through our Vouch system. 
              To become a full member, you must be vouched for by an existing member in good standing.
            </p>
            <ul>
              <li><strong>Vouching Responsibility:</strong> When you vouch for someone, you attest to their character and serious intent.</li>
              <li><strong>Consequences:</strong> If a person you vouch for violates our terms of conduct, your account may also be subject to review or suspension.</li>
              <li><strong>Revocation:</strong> Kin may revoke vouching privileges at its sole discretion.</li>
            </ul>
          </section>

          <section id="conduct" className="mt-12 scroll-mt-24">
            <h2 className="font-serif text-2xl font-bold text-gold">3. User Conduct</h2>
            <p>We expect all members to behave with the utmost respect, honesty, and integrity. You agree NOT to:</p>
            <ul>
              <li>Provide false, misleading, or deceptive information in your profile.</li>
              <li>Harass, abuse, stalk, or intimidate other members.</li>
              <li>Use the platform for commercial purposes, soliciting, or prostitution.</li>
              <li>Share other members' private information, photos, or communications outside of Kin.</li>
              <li>Create multiple accounts or share your account with others.</li>
            </ul>
          </section>

          <section id="privacy" className="mt-12 scroll-mt-24">
            <h2 className="font-serif text-2xl font-bold text-gold">4. Privacy & Data</h2>
            <p>
              Your privacy is paramount. Kin collects only the data necessary to provide meaningful introductions.
              Your profile is only visible to curated matches, not to the general public.
            </p>
            <p>
              By using Kin, you consent to our collection and use of your data as outlined in our Privacy Policy.
              We do not sell your personal data to third-party data brokers.
            </p>
          </section>

          <section id="communication" className="mt-12 scroll-mt-24">
            <h2 className="font-serif text-2xl font-bold text-gold">5. Match Communication Rules</h2>
            <p>
              Communications within Kin must remain respectful. Kin employs automated and manual moderation tools 
              to ensure safety. Any use of hate speech, explicit content, or unsolicited sexually explicit material 
              will result in immediate termination.
            </p>
          </section>

          <section id="termination" className="mt-12 scroll-mt-24">
            <h2 className="font-serif text-2xl font-bold text-gold">6. Account Termination</h2>
            <p>
              Kin reserves the right to suspend or terminate your account at any time, with or without notice, 
              for any violation of these Terms, particularly regarding User Conduct or the Vouch System. 
              You may terminate your account at any time through the app settings.
            </p>
          </section>

          <section id="liability" className="mt-12 scroll-mt-24">
            <h2 className="font-serif text-2xl font-bold text-gold">7. Limitation of Liability</h2>
            <p>
              Kin provides introductions, but we are not responsible for the conduct of our members offline. 
              You agree to use caution and common sense in all interactions with other members. 
              Kin shall not be liable for any direct, indirect, incidental, or consequential damages arising 
              from your use of the service.
            </p>
          </section>

        </main>
      </div>
    </div>
  );
}