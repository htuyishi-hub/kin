export default function Terms() {
  return (
    <div className="min-h-screen bg-night text-bone pt-24 pb-24">
      <div className="container mx-auto px-4 max-w-5xl flex flex-col md:flex-row gap-12">

        {/* Sticky sidebar */}
        <aside className="hidden md:block w-56 shrink-0">
          <div className="sticky top-28 space-y-6 border-l border-divider pl-5">
            <div>
              <h3 className="font-serif font-bold text-gold uppercase tracking-widest text-xs mb-3">
                Part One
              </h3>
              <p className="text-bone text-xs font-semibold mb-3 uppercase tracking-wide">Terms of Service</p>
              <ul className="space-y-2 text-xs text-bone-dim">
                <li><a href="#tos-1"  className="hover:text-bone transition-colors">1. Acceptance of Terms</a></li>
                <li><a href="#tos-2"  className="hover:text-bone transition-colors">2. Eligibility</a></li>
                <li><a href="#tos-3"  className="hover:text-bone transition-colors">3. Nature of the Service</a></li>
                <li><a href="#tos-4"  className="hover:text-bone transition-colors">4. Account Verification &amp; Vouching</a></li>
                <li><a href="#tos-5"  className="hover:text-bone transition-colors">5. Community Standards</a></li>
                <li><a href="#tos-6"  className="hover:text-bone transition-colors">6. Consequences of Violations</a></li>
                <li><a href="#tos-7"  className="hover:text-bone transition-colors">7. Payments &amp; Refunds</a></li>
                <li><a href="#tos-8"  className="hover:text-bone transition-colors">8. Intellectual Property</a></li>
                <li><a href="#tos-9"  className="hover:text-bone transition-colors">9. Disclaimers &amp; Liability</a></li>
                <li><a href="#tos-10" className="hover:text-bone transition-colors">10. Termination</a></li>
                <li><a href="#tos-11" className="hover:text-bone transition-colors">11. If Kin Ceases Operations</a></li>
                <li><a href="#tos-12" className="hover:text-bone transition-colors">12. Governing Law</a></li>
                <li><a href="#tos-13" className="hover:text-bone transition-colors">13. Changes to These Terms</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-serif font-bold text-gold uppercase tracking-widest text-xs mb-3">
                Part Two
              </h3>
              <p className="text-bone text-xs font-semibold mb-3 uppercase tracking-wide">Privacy Policy</p>
              <ul className="space-y-2 text-xs text-bone-dim">
                <li><a href="#pp-1"  className="hover:text-bone transition-colors">1. Information We Collect</a></li>
                <li><a href="#pp-2"  className="hover:text-bone transition-colors">2. How We Use Your Info</a></li>
                <li><a href="#pp-3"  className="hover:text-bone transition-colors">3. What We Never Do</a></li>
                <li><a href="#pp-4"  className="hover:text-bone transition-colors">4. Location Data</a></li>
                <li><a href="#pp-5"  className="hover:text-bone transition-colors">5. Student ID Verification</a></li>
                <li><a href="#pp-6"  className="hover:text-bone transition-colors">6. Messages &amp; Conversations</a></li>
                <li><a href="#pp-7"  className="hover:text-bone transition-colors">7. Data Retention &amp; Deletion</a></li>
                <li><a href="#pp-8"  className="hover:text-bone transition-colors">8. Success Stories</a></li>
                <li><a href="#pp-9"  className="hover:text-bone transition-colors">9. Your Rights</a></li>
                <li><a href="#pp-10" className="hover:text-bone transition-colors">10. Data Security</a></li>
                <li><a href="#pp-11" className="hover:text-bone transition-colors">11. Children's Privacy</a></li>
                <li><a href="#pp-12" className="hover:text-bone transition-colors">12. Changes to This Policy</a></li>
                <li><a href="#pp-13" className="hover:text-bone transition-colors">13. Contact</a></li>
              </ul>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">

          {/* Header */}
          <div className="mb-14 pb-10 border-b border-divider">
            <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-gold mb-4">
              Legal Document
            </span>
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-bone mb-3">
              Terms of Service<br />
              <span className="italic text-bone-dim">&amp; Privacy Policy</span>
            </h1>
            <p className="text-bone-dim text-sm mt-5 leading-relaxed max-w-xl">
              Rwanda &nbsp;·&nbsp; Draft v1.0 &nbsp;·&nbsp; 2026 &nbsp;·&nbsp;
              <span className="text-gold/80">Not yet reviewed by counsel.</span>
              &nbsp;This is a working draft. It is not a substitute for review by a licensed Rwandan lawyer before publication.
            </p>
          </div>

          {/* ════════════════════════════════ PART ONE ════════════════════════════════ */}
          <div className="mb-20">
            <div className="mb-10">
              <span className="inline-block px-3 py-1 text-xs font-bold tracking-widest uppercase bg-trust/10 text-trust rounded-full mb-3">
                Part One
              </span>
              <h2 className="font-serif text-3xl font-bold text-bone">Terms of Service</h2>
            </div>

            <Section id="tos-1" number="1" title="Acceptance of Terms">
              <p>
                By creating an account on Kin, you agree to be bound by these Terms of Service and the Privacy
                Policy below. If you do not agree, do not use Kin. These Terms apply to the Kin mobile
                application and the kin.rw website (together, the Service), operated in Rwanda.
              </p>
            </Section>

            <Section id="tos-2" number="2" title="Eligibility">
              <ul>
                <li>You must be at least 18 years old to use Kin. Anyone found to be underage will have their account permanently closed.</li>
                <li>You must provide a real, working phone number capable of receiving SMS verification.</li>
                <li>You must provide accurate information about yourself, including your name, age, gender, and photo. Misrepresentation is a violation of these Terms.</li>
                <li>You may only maintain one active Kin account at a time.</li>
              </ul>
            </Section>

            <Section id="tos-3" number="3" title="The Nature of the Service">
              <p>
                Kin is a trust-based introduction network. It facilitates connections between verified
                individuals seeking serious relationships, long-term partnerships, or marriage. Kin is not
                an employment, financial, or social media service. Kin does not guarantee that you will meet
                a partner, form a relationship, or have any particular experience using the Service.
              </p>
            </Section>

            <Section id="tos-4" number="4" title="Account Verification and Vouching">
              <p>
                Kin requires new users to be vouched for by at least two existing contacts before their
                profile becomes visible in the match pool. By vouching for another user, you confirm that
                you genuinely know them and believe the information they have provided is accurate. Vouching
                for a user who is later found to have violated these Terms may reduce your own account's
                standing on the Service.
              </p>
            </Section>

            <Section id="tos-5" number="5" title="Community Standards and Acceptable Use">
              <p>
                All users must comply with the Kin Community Standards, summarized below. The full Community
                Standards are also published in-app at Settings &gt; Community Standards and form part of
                these Terms by reference.
              </p>
              <ul>
                <li>Kin is for genuine, serious relationship-seeking. It is not a venue for casual browsing, entertainment, solicitation, or financial arrangements.</li>
                <li>You must communicate with other users respectfully. Harassment, threats, hate speech, or abusive language of any kind will result in immediate account removal.</li>
                <li>You may not ask another user to move conversations off-platform, request money, or request sensitive personal information before meeting in person. These are reportable warning signs.</li>
                <li>You may not use Kin if you are under 18, have been previously banned, or are using the Service to commit fraud or exploitation.</li>
                <li>Reporting another user for a Community Standards violation is treated seriously and reviewed within 24 hours of submission.</li>
              </ul>
            </Section>

            <Section id="tos-6" number="6" title="Consequences of Violations">
              <p>
                Kin reserves the right to suspend or permanently terminate any account, without prior notice,
                where there is a confirmed violation of these Terms or the Community Standards. Confirmed
                violations involving harassment, exploitation, or misrepresentation result in permanent
                removal with no warning. A removed user's phone number and device identifiers may be flagged
                to prevent re-registration under a new account.
              </p>
            </Section>

            <Section id="tos-7" number="7" title="Payments and Refunds">
              <p>
                Kin offers optional paid features, including connection tokens, the crossing fee, profile
                boosts, and (in future versions) a professional subscription tier. All payments are processed
                through MTN Mobile Money.
              </p>
              <ul>
                <li>Payments are non-refundable, except where a technical error on Kin's part resulted in a feature not being delivered after payment was confirmed. Such cases must be reported to <a href="mailto:support@kin.rw" className="text-trust hover:underline">support@kin.rw</a> within 7 days of the transaction.</li>
                <li>Kin may change pricing for any feature with at least 14 days' notice communicated inside the app. Previously purchased tokens or features are not affected retroactively by a price change.</li>
                <li>Subscription features, where offered, may be cancelled at any time; cancellation takes effect at the end of the current billing period.</li>
              </ul>
            </Section>

            <Section id="tos-8" number="8" title="Intellectual Property">
              <p>
                The Kin name, logo, the K mark, the welcome animation, and all associated branding are the
                property of Kin and may not be reproduced, copied, or used commercially without written
                permission. Content you submit to Kin, including profile information, micro-prompt answers,
                and success stories, remains yours, but by submitting a success story with shareable consent,
                you grant Kin a license to generate and display a shareable card containing your story under
                the terms you select at the time of submission. This license is non-exclusive and may be
                withdrawn by deleting your account.
              </p>
            </Section>

            <Section id="tos-9" number="9" title="Disclaimers and Limitation of Liability">
              <p>
                Kin verifies users through phone number confirmation, vouching, and, where applicable,
                student ID review, but does not conduct criminal background checks. Kin is not responsible
                for the conduct of any user, on or off the platform, including conduct that occurs during
                or after an in-person meeting arranged through the Service. Users meet and interact with
                each other at their own risk and are encouraged to take standard safety precautions: meeting
                in public places, informing a trusted person, and reporting any concerns immediately through
                the in-app reporting tool.
              </p>
              <p>
                To the maximum extent permitted under Rwandan law, Kin's liability for any claim arising
                from use of the Service is limited to the amount, if any, paid by the user to Kin in the
                twelve months preceding the claim.
              </p>
            </Section>

            <Section id="tos-10" number="10" title="Termination">
              <p>
                You may delete your account at any time from within the app. Kin may suspend or terminate
                your account for violation of these Terms, at its discretion, with or without notice
                depending on the severity of the violation.
              </p>
            </Section>

            <Section id="tos-11" number="11" title="If Kin Ceases Operations">
              <p>
                If Kin permanently stops operating, users will receive in-app notice at least 30 days before
                closure. All user data will be permanently deleted within 90 days of the closure
                announcement. No user data will be sold, transferred to a third party, or retained beyond
                this period.
              </p>
            </Section>

            <Section id="tos-12" number="12" title="Governing Law">
              <p>
                These Terms are governed by the laws of the Republic of Rwanda. Any dispute arising from
                these Terms or use of the Service shall first be addressed through good-faith negotiation,
                and if unresolved, submitted to the competent courts of Rwanda.
              </p>
            </Section>

            <Section id="tos-13" number="13" title="Changes to These Terms">
              <p>
                Kin may update these Terms from time to time. Material changes will be communicated in-app
                and via the contact email on file at least 14 days before taking effect. Continued use of
                the Service after changes take effect constitutes acceptance of the revised Terms.
              </p>
            </Section>
          </div>

          {/* Divider */}
          <div className="border-t border-divider my-16" />

          {/* ════════════════════════════════ PART TWO ════════════════════════════════ */}
          <div>
            <div className="mb-10">
              <span className="inline-block px-3 py-1 text-xs font-bold tracking-widest uppercase bg-gold/10 text-gold rounded-full mb-3">
                Part Two
              </span>
              <h2 className="font-serif text-3xl font-bold text-bone">Privacy Policy</h2>
              <p className="text-bone-dim text-sm mt-4 max-w-xl leading-relaxed">
                This Privacy Policy explains what information Kin collects, how it is used, and the rights
                you have over your data. It is the legal counterpart to the plain-language privacy summary
                shown in-app at Settings &gt; Privacy &amp; Safety.
              </p>
            </div>

            <Section id="pp-1" number="1" title="Information We Collect">
              <ul>
                <li><strong>Identity:</strong> Phone number, full name, date of birth, gender.</li>
                <li><strong>Profile:</strong> Campus or city, faculty, year of study, hostel name, district, primary relationship intent.</li>
                <li><strong>Photos:</strong> Your primary profile photo, visible to other users, and any additional photos you upload, blurred until certain conversation milestones are reached.</li>
                <li><strong>Verification:</strong> Student ID photo, where applicable, used solely to confirm student status.</li>
                <li><strong>Content you create:</strong> Micro-prompt answers, messages sent within the Service, vouch records, reports submitted, and exit survey or success story responses.</li>
                <li><strong>Technical:</strong> Device push notification token, and only with your explicit consent, Bluetooth or GPS signals used solely to verify in-person meetups.</li>
                <li><strong>Payment records:</strong> Transaction records processed through MTN Mobile Money. Kin does not store your Mobile Money PIN or full financial account details; these are handled directly by MTN's payment infrastructure.</li>
              </ul>
            </Section>

            <Section id="pp-2" number="2" title="How We Use Your Information">
              <p>
                Information is used exclusively to operate the Service: to verify your identity, to compute
                compatibility and matching rank, to deliver and display messages, to process payments you
                initiate, to enforce these Terms and Community Standards, and to improve the Service based
                on aggregated, anonymized usage patterns. Certain internal classifications, including your
                matching tier and trust score, are computed and stored for matching purposes but are never
                disclosed to other users.
              </p>
            </Section>

            <Section id="pp-3" number="3" title="What We Never Do">
              <p>
                Kin does not sell user data. Kin does not share user data with advertisers. Kin does not
                provide user information to any third party for marketing or any commercial purpose unrelated
                to operating the Service. This restriction is enforced at the database level through access
                control policies, not only as a written policy.
              </p>
            </Section>

            <Section id="pp-4" number="4" title="Location Data">
              <p>
                Kin only accesses Bluetooth or GPS signals if you explicitly opt in. When enabled, this
                data is used solely to detect and verify that you attended an in-person meetup with a match,
                for the purpose of the in-app meetup reward system. Kin does not track real-time location
                and does not retain a history of your movements.
              </p>
            </Section>

            <Section id="pp-5" number="5" title="Student ID Verification">
              <p>
                If your account requires student status verification, your student ID photo is reviewed only
                by the Kin moderation team. It is never shown to other users. Once verification is complete,
                the photo is deleted from Kin's storage within 7 days.
              </p>
            </Section>

            <Section id="pp-6" number="6" title="Messages and Conversations">
              <p>
                Conversations between matched users are private and are not read by Kin staff under normal
                circumstances. A message may be reviewed by a moderator only where it has been reported for
                a safety concern under these Terms.
              </p>
            </Section>

            <Section id="pp-7" number="7" title="Data Retention and Deletion">
              <p>
                If you delete your account, all associated data — including profile information, photos,
                conversation history, and vouch records — is permanently deleted within 30 days. No data is
                archived or retained for future use beyond this period, except where retention is required
                by Rwandan law, for example financial transaction records related to payments.
              </p>
            </Section>

            <Section id="pp-8" number="8" title="Success Stories and Shareable Content">
              <p>
                If you choose to submit a success story after pausing your profile, it is used internally
                only unless you separately and explicitly consent to its public or shareable use. You control
                the attribution shown — anonymous, first names, or fully private — at the time of
                submission, and this choice is enforced technically, not only by policy.
              </p>
            </Section>

            <Section id="pp-9" number="9" title="Your Rights">
              <ul>
                <li>You have the right to access the personal information Kin holds about you.</li>
                <li>You have the right to correct inaccurate information through your profile settings.</li>
                <li>You have the right to delete your account and associated data at any time.</li>
                <li>You have the right to withdraw consent for location-based features or shareable story content at any time.</li>
              </ul>
            </Section>

            <Section id="pp-10" number="10" title="Data Security">
              <p>
                Kin stores data using Supabase's PostgreSQL infrastructure with row-level security policies
                restricting access to each user's own data. Sensitive operations, including payment
                verification and trust scoring, are handled exclusively by isolated server-side functions
                and are never exposed to client applications.
              </p>
            </Section>

            <Section id="pp-11" number="11" title="Children's Privacy">
              <p>
                Kin is not intended for use by anyone under 18. Kin does not knowingly collect information
                from minors. Any account found to belong to a person under 18 will be terminated and
                associated data deleted.
              </p>
            </Section>

            <Section id="pp-12" number="12" title="Changes to This Policy">
              <p>
                Kin may update this Privacy Policy from time to time. Material changes will be communicated
                in-app and via the contact email on file at least 14 days before taking effect.
              </p>
            </Section>

            <Section id="pp-13" number="13" title="Contact">
              <p>Questions about this Privacy Policy or your data:</p>
              <div className="mt-6 rounded-xl border border-divider overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink text-bone-dim uppercase tracking-wider text-xs">
                      <th className="text-left px-5 py-3 font-semibold">Purpose</th>
                      <th className="text-left px-5 py-3 font-semibold">Contact</th>
                      <th className="text-left px-5 py-3 font-semibold">Response Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {[
                      ["Privacy questions",  "privacy@kin.rw",  "48 hours"],
                      ["Payment issues",     "support@kin.rw",  "48 hours"],
                      ["Safety emergencies", "safety@kin.rw",   "12 hours"],
                      ["Report a bug",       "bugs@kin.rw",     "72 hours"],
                      ["Legal notices",      "legal@kin.rw",    "5 business days"],
                    ].map(([purpose, email, time]) => (
                      <tr key={email} className="hover:bg-ink/60 transition-colors">
                        <td className="px-5 py-4 text-bone">{purpose}</td>
                        <td className="px-5 py-4">
                          <a href={`mailto:${email}`} className="text-trust hover:underline">{email}</a>
                        </td>
                        <td className="px-5 py-4 text-bone-dim">{time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>

          {/* Footer note */}
          <div className="mt-20 pt-10 border-t border-divider">
            <p className="text-bone-ghost text-xs leading-relaxed">
              Kin Terms of Service &amp; Privacy Policy — Draft v1.0 &nbsp;·&nbsp; Confidential &nbsp;·&nbsp;
              Pending legal review by a licensed Rwandan lawyer before publication.
            </p>
          </div>

        </main>
      </div>
    </div>
  );
}

function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-28 group">
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-xs font-bold text-bone-ghost tabular-nums">{number}.</span>
        <h3 className="font-serif text-xl font-bold text-gold">{title}</h3>
      </div>
      <div className="pl-6 text-bone-dim leading-relaxed space-y-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_ul]:mt-3 [&_strong]:text-bone [&_a]:text-trust [&_a:hover]:underline">
        {children}
      </div>
    </section>
  );
}
