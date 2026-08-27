import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalLayout, Section, greenHi, textDim } from '@/components/legal/legal-layout';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: "The terms governing use of Sunday Huddle's confidence pool, Pick'em, and Survivor pool software, including accounts, subscriptions, and acceptable use.",
};

const EFFECTIVE_DATE = 'August 27, 2026';
const LAST_UPDATED = 'August 27, 2026';

const toc = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'acceptance', label: 'Acceptance of Terms' },
  { id: 'eligibility', label: 'Eligibility' },
  { id: 'accounts', label: 'User Accounts' },
  { id: 'service', label: 'The Sunday Huddle Service' },
  { id: 'commissioners-participants', label: 'Commissioners and Participants' },
  { id: 'pool-rules-disputes', label: 'Pool Rules and Disputes' },
  { id: 'payments', label: 'Payments and Subscriptions' },
  { id: 'trials', label: 'Free Trials' },
  { id: 'acceptable-use', label: 'Acceptable Use' },
  { id: 'ip', label: 'Intellectual Property' },
  { id: 'user-content', label: 'User Content and Pool Data' },
  { id: 'third-party', label: 'Third-Party Services' },
  { id: 'availability', label: 'Availability and Changes' },
  { id: 'termination', label: 'Termination and Suspension' },
  { id: 'disclaimers', label: 'Disclaimers' },
  { id: 'liability', label: 'Limitation of Liability' },
  { id: 'indemnification', label: 'Indemnification' },
  { id: 'governing-law', label: 'Governing Law' },
  { id: 'changes', label: 'Changes to These Terms' },
  { id: 'contact', label: 'Contact' },
];

export default function TermsPage() {
  return (
    <LegalLayout
      breadcrumbCurrent="Terms of Service"
      eyebrow="Legal"
      title="Terms of Service"
      effectiveDate={EFFECTIVE_DATE}
      lastUpdated={LAST_UPDATED}
      intro={
        <p>
          These Terms of Service govern your use of Sunday Huddle. Please read them carefully — they explain what
          Sunday Huddle provides, what commissioners and participants are each responsible for, and how paid plans work.
        </p>
      }
      toc={toc}
    >
      <Section id="introduction" number={1} title="Introduction">
        <p>
          Sunday Huddle (&ldquo;Sunday Huddle,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is a
          web application that lets a &ldquo;commissioner&rdquo; create and manage sports pools — currently NFL
          confidence pools, Pick&rsquo;em pools, and Survivor pools — invite participants, collect and score picks,
          and track standings across a season. These Terms of Service (&ldquo;Terms&rdquo;) form a binding agreement
          between you and <strong>[LEGAL BUSINESS NAME]</strong> governing your access to and use of the Sunday
          Huddle website and application (together, the &ldquo;Service&rdquo;).
        </p>
        <p>
          Sunday Huddle is operated by <strong>[LEGAL BUSINESS NAME]</strong>, <strong>[MAILING ADDRESS]</strong>. If
          you have questions about these Terms, contact us at <strong>[CONTACT EMAIL]</strong>.
        </p>
      </Section>

      <Section id="acceptance" number={2} title="Acceptance of Terms">
        <p>
          By creating an account, accessing, or otherwise using the Service, you agree to be bound by these Terms and
          by our <Link href="/privacy" style={{ color: greenHi }}>Privacy Policy</Link>, which is incorporated into
          these Terms by reference. If you are using the Service on behalf of a group of participants (as a
          commissioner), you also agree to these Terms on your own behalf.
        </p>
        <p>
          If you do not agree to these Terms, you must not create an account or otherwise use the Service. Continuing
          to use the Service after these Terms have been updated constitutes acceptance of the revised Terms — see{' '}
          <a href="#changes" style={{ color: greenHi }}>Changes to These Terms</a> below.
        </p>
      </Section>

      <Section id="eligibility" number={3} title="Eligibility">
        <p>
          To use the Service, you must be capable of forming a legally binding contract under the laws that apply to
          you. Sunday Huddle is not directed to, and is not intended for use by, children under the age of 13. If a
          higher minimum age applies to you under the laws of your jurisdiction, you must meet that age before using
          the Service. <strong>[MINIMUM AGE, IF ONE IS FORMALLY ADOPTED]</strong>
        </p>
        <p>
          You must also provide accurate information when creating an account and use the Service only in a manner
          permitted by these Terms and by applicable law.
        </p>
      </Section>

      <Section id="accounts" number={4} title="User Accounts">
        <p>
          Commissioner accounts can be created with an email address and password, or by signing in with Google. When
          you create an account, you agree to provide accurate, current information (including your name and email
          address) and to keep that information up to date.
        </p>
        <p>
          You are responsible for maintaining the confidentiality of your password and for all activity that occurs
          under your account, whether or not you personally performed it. If you sign in with Google, you are
          responsible for keeping your Google account secure, since anyone with access to it may be able to sign in
          to Sunday Huddle as you.
        </p>
        <p>
          You must notify us promptly at <strong>[CONTACT EMAIL]</strong> if you become aware of any unauthorized
          access to, or use of, your account. We are not liable for any loss or damage arising from your failure to
          keep your account credentials secure or to notify us of unauthorized use.
        </p>
        <p>
          Participants who join a pool are added or invited by a commissioner and do not need to create their own
          password-protected account to make picks; a participant&rsquo;s picks are tied to the name/email a
          commissioner or the participant entered for that pool.
        </p>
      </Section>

      <Section id="service" number={5} title="The Sunday Huddle Service">
        <p>Sunday Huddle provides software for a commissioner to:</p>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <li>Create and manage confidence, Pick&rsquo;em, and Survivor pools for a given NFL season;</li>
          <li>Invite and manage participants, including adding participants directly or sharing a pool link/password;</li>
          <li>Configure pool settings, such as tie-breaker rules, pool privacy, and (for Standard-plan commissioners) season and playoff scope;</li>
          <li>Collect participant picks on a weekly basis, lock picks once games begin, and score results;</li>
          <li>Display standings, weekly and season leaderboards, and (where configured) quarter and playoff period winners;</li>
          <li>Send transactional emails such as pick reminders and weekly summaries, where enabled; and</li>
          <li>Purchase a paid subscription plan or add-on pools, as described in <a href="#payments" style={{ color: greenHi }}>Payments and Subscriptions</a> below.</li>
        </ul>
        <p>
          The Service organizes play by NFL season and week, and by season phase (preseason, regular season, and
          postseason). Features, plan limits, and supported sports or competition types may change over time as
          described in <a href="#availability" style={{ color: greenHi }}>Availability and Changes</a>.
        </p>
      </Section>

      <Section id="commissioners-participants" number={6} title="Commissioners and Participants">
        <p>This section describes the relationship between the three parties involved in any pool:</p>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <li><strong>Sunday Huddle</strong> is the software provider. We build and operate the platform that a commissioner uses to run a pool.</li>
          <li><strong>The commissioner</strong> is the person who creates and administers a pool. The commissioner decides who may join, configures pool settings and rules, and manages participants.</li>
          <li><strong>Participants</strong> are the people the commissioner invites or adds to a pool to make picks and compete in it.</li>
        </ul>
        <p>
          Sunday Huddle is not a party to, and does not control, the private arrangements a commissioner makes with
          their participants (for example, who is allowed to join, what a pool&rsquo;s rules are, or any entry fees or
          prizes a commissioner chooses to run outside the Service). Commissioners are solely responsible for managing
          their pools and for communicating their pool&rsquo;s rules to participants.
        </p>
      </Section>

      <Section id="pool-rules-disputes" number={7} title="Pool Rules and Disputes">
        <p>
          Commissioners may establish rules for their own pool (for example, tie-breakers, eligibility for prizes, or
          how disputes within the pool are resolved). Sunday Huddle provides the software used to administer a pool —
          collecting picks, scoring, and displaying standings — but does not set, enforce, or arbitrate a commissioner&rsquo;s
          private pool rules.
        </p>
        <p>
          <strong>Sunday Huddle does not collect entry fees, hold participant funds, or transfer money between
          participants and commissioners.</strong> Where a pool&rsquo;s commissioner has configured payout tracking,
          the Service only calculates how winnings should be split based on the rules the commissioner enters — it is
          the commissioner&rsquo;s responsibility to actually collect any entry fees and pay any winners outside the
          Service.
        </p>
        <p>
          Because of this, Sunday Huddle is not responsible for, and does not mediate, disputes between a commissioner
          and their participants regarding entry fees, prize amounts, payouts, commissioner decisions, or any other
          private pool rule. Any such dispute is between the commissioner and their participants.
        </p>
      </Section>

      <Section id="payments" number={8} title="Payments and Subscriptions">
        <p>
          Sunday Huddle offers a Free plan and a paid Standard plan, priced and sold on a <strong>per-season</strong>{' '}
          basis — not as a recurring monthly or annual subscription. Standard-plan commissioners may also purchase
          additional pool capacity (&ldquo;add-on pools&rdquo;) for the season, also sold per-season. Current pricing
          is shown on our Pricing page and at checkout; the price shown to you at checkout is the price you are
          charged.
        </p>
        <p>
          Payments are processed by Stripe, a third-party payment processor. Sunday Huddle does not receive or store
          your full card number — Stripe handles payment collection using its own secure, hosted checkout. Because
          Standard and add-on pools are one-time, per-season purchases rather than auto-renewing subscriptions, there
          is no recurring charge to cancel — a plan simply covers the season it was purchased for and does not
          automatically renew or re-charge you the following season.
        </p>
        <p>
          If a payment fails or is declined, the associated plan or add-on is not granted. If Stripe issues a refund
          for a purchase (for example, at our discretion or as required by law), the corresponding plan upgrade or
          add-on pool capacity is automatically revoked from your account once the refund is processed. We do not
          publish a fixed self-service refund window; if you believe you are entitled to a refund, contact us at{' '}
          <strong>[CONTACT EMAIL]</strong> and we will review your request.
        </p>
        <p>
          You are responsible for any applicable taxes on your purchase, except taxes on our net income. We may
          change our pricing at any time; a price change will not affect a season you have already paid for, and any
          new price will be shown to you before you are charged for a future purchase.
        </p>
      </Section>

      <Section id="trials" number={9} title="Free Trials">
        <p>
          Where offered, Sunday Huddle provides a free trial of the Standard plan for a limited number of days, shown
          to you on the Pricing/Upgrade page at the time the trial is offered. Starting a trial does not require
          payment information and does not automatically charge you when the trial ends.
        </p>
        <p>
          Each commissioner account is eligible to start a fresh free trial once. An account that has already started
          a trial, currently holds the Standard plan, has been granted a complimentary plan, or has previously
          completed a paid Standard purchase is not eligible to start another trial.
        </p>
        <p>
          When your trial ends, your account reverts to the Free plan and its limits unless you have purchased the
          Standard plan before the trial ends. We do not automatically charge you at the end of a trial.
        </p>
      </Section>

      <Section id="acceptable-use" number={10} title="Acceptable Use">
        <p>You agree not to use the Service to:</p>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <li>Violate any applicable law, or use the Service for fraud or in furtherance of illegal activity;</li>
          <li>Access or attempt to access another user&rsquo;s account, pool, or data without authorization;</li>
          <li>Interfere with, disrupt, or attempt to bypass the security or normal operation of the Service;</li>
          <li>Attempt to circumvent subscription plan limits or paid features without payment;</li>
          <li>Use bots, scrapers, or other automated means to access the Service outside of normal use, or to attack or overload it;</li>
          <li>Upload or transmit viruses, malware, or other malicious code;</li>
          <li>Impersonate any person or entity, or misrepresent your affiliation with a person or entity; or</li>
          <li>Upload or submit content through the Service that is unlawful, infringing, or violates the rights of others.</li>
        </ul>
        <p>
          We may investigate suspected violations of this section and take action as described in{' '}
          <a href="#termination" style={{ color: greenHi }}>Termination and Suspension</a>.
        </p>
      </Section>

      <Section id="ip" number={11} title="Intellectual Property">
        <p>
          Sunday Huddle and its licensors own all right, title, and interest in the Service, including its software,
          features, branding, logos, and the design of the site itself. These Terms grant you a limited,
          non-exclusive, non-transferable, revocable license to access and use the Service for its intended purpose —
          running or participating in sports pools — subject to these Terms. Nothing in these Terms transfers any
          ownership of Sunday Huddle&rsquo;s intellectual property to you.
        </p>
        <p>
          As between you and Sunday Huddle, you retain ownership of the pool information you submit (see{' '}
          <a href="#user-content" style={{ color: greenHi }}>User Content and Pool Data</a> below); we do not claim
          ownership of it. You grant us the right to host, store, process, and display that information as necessary
          to operate the Service for you and the participants in your pool.
        </p>
      </Section>

      <Section id="user-content" number={12} title="User Content and Pool Data">
        <p>
          Commissioners and participants may submit information through the Service, including pool names and
          descriptions, participant names and email addresses, weekly picks, tie-breaker answers, and pool settings
          (collectively, &ldquo;Pool Data&rdquo;). You are responsible for the accuracy of the Pool Data you submit
          and for having the right to submit any information about another person (for example, a participant&rsquo;s
          name or email address) that you enter into the Service.
        </p>
        <p>
          Pool Data associated with a pool is generally visible to that pool&rsquo;s commissioner and, depending on
          the pool&rsquo;s configuration and where picks have been revealed, to the other participants in that pool —
          see <Link href="/privacy#pool-participant-info" style={{ color: greenHi }}>Pool and Participant Information</Link>{' '}
          in our Privacy Policy for details.
        </p>
      </Section>

      <Section id="third-party" number={13} title="Third-Party Services">
        <p>The Service relies on the following third-party providers to operate:</p>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <li><strong>Stripe</strong> — processes payments for Standard plan and add-on pool purchases;</li>
          <li><strong>Google</strong> — provides &ldquo;Sign in with Google&rdquo; authentication, if you choose to use it;</li>
          <li><strong>Supabase</strong> — provides our hosted database and, for Google sign-in, the underlying authentication exchange;</li>
          <li><strong>Vercel</strong> — hosts the Sunday Huddle application;</li>
          <li>Our email delivery provider — sends transactional emails such as pick reminders, weekly summaries, and account-related notices; and</li>
          <li>ESPN&rsquo;s public sports data (with a secondary sports-data provider used as a fallback) — supplies NFL schedule, team, and score information used to score picks. This is sports data, not personal information about you.</li>
        </ul>
        <p>
          Your use of Google&rsquo;s sign-in service is also subject to Google&rsquo;s own terms of service. We do not
          currently use any third-party analytics or advertising service on the Service.
        </p>
      </Section>

      <Section id="availability" number={14} title="Availability and Changes">
        <p>
          We may add, change, or remove features of the Service at any time, including which sports, competition
          types, or seasons are supported. We may also perform maintenance that temporarily makes the Service
          unavailable. We do not guarantee that the Service will be available uninterrupted or error-free.
        </p>
      </Section>

      <Section id="termination" number={15} title="Termination and Suspension">
        <p>
          You may stop using the Service at any time. Commissioners may permanently delete their own account through
          Account Settings; doing so sends a confirmation link to your email that must be used within 24 hours to
          complete the deletion. Deleting your account permanently removes your profile, sign-in access, and account
          settings. Pools you created are archived (deactivated), not deleted — the historical picks, scores, and
          standings your participants earned are preserved but the pool is no longer active or accessible from your
          account. A commissioner may also directly delete an individual pool, which permanently removes that pool
          and its participants, picks, scores, and tie-breaker data, and notifies the pool&rsquo;s participants and
          commissioner by email.
        </p>
        <p>
          We may suspend or terminate your access to the Service if we reasonably believe you have violated these
          Terms (including the <a href="#acceptable-use" style={{ color: greenHi }}>Acceptable Use</a> section),
          engaged in fraud, or created a security risk to the Service or other users. Where practical, we will
          attempt to notify you of any such action.
        </p>
      </Section>

      <Section id="disclaimers" number={16} title="Disclaimers">
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT WARRANTIES OF ANY KIND,
          WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, AND NON-INFRINGEMENT, TO THE FULLEST EXTENT PERMITTED BY LAW.
        </p>
        <p>
          Sunday Huddle provides software for managing sports pools. We do not control the outcome of any NFL game,
          and scores, schedules, and statistics displayed in the Service depend on third-party sports data sources
          that may occasionally be delayed, incomplete, or inaccurate. We do not guarantee uninterrupted or
          error-free operation of the Service. As described above, Sunday Huddle is not responsible for a
          commissioner&rsquo;s decisions or for private disputes between a commissioner and their participants.
        </p>
      </Section>

      <Section id="liability" number={17} title="Limitation of Liability">
        <p>
          TO THE FULLEST EXTENT PERMITTED BY LAW, SUNDAY HUDDLE AND ITS OFFICERS, EMPLOYEES, AND AGENTS WILL NOT BE
          LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS,
          DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE. TO THE FULLEST EXTENT PERMITTED BY LAW, OUR TOTAL
          LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE WILL NOT EXCEED THE AMOUNT
          YOU PAID TO SUNDAY HUDDLE IN THE TWELVE (12) MONTHS BEFORE THE CLAIM AROSE.
        </p>
        <p style={{ color: textDim, fontSize: '0.85rem' }}>
          This limitation is intended to be a general, reviewable placeholder appropriate for a SaaS application; it
          should be confirmed with counsel for your jurisdiction before this page is treated as final.
        </p>
      </Section>

      <Section id="indemnification" number={18} title="Indemnification">
        <p>
          You agree to indemnify and hold Sunday Huddle harmless from any claims, damages, liabilities, and expenses
          (including reasonable attorneys&rsquo; fees) arising from your use of the Service, your Pool Data, your
          violation of these Terms, or your violation of any rights of a third party, including a participant in your
          pool.
        </p>
      </Section>

      <Section id="governing-law" number={19} title="Governing Law">
        <p>
          These Terms are governed by the laws of <strong>[GOVERNING LAW / JURISDICTION]</strong>, without regard to
          its conflict-of-laws principles. Any dispute arising from these Terms or the Service will be subject to the
          exclusive jurisdiction of the courts located in <strong>[GOVERNING LAW / JURISDICTION]</strong>, unless
          applicable law requires otherwise.
        </p>
      </Section>

      <Section id="changes" number={20} title="Changes to These Terms">
        <p>
          We may update these Terms from time to time. If we make a material change, we will update the
          &ldquo;Last updated&rdquo; date above and, where appropriate, notify you by email or through the Service.
          Your continued use of the Service after a change takes effect constitutes your acceptance of the revised
          Terms.
        </p>
      </Section>

      <Section id="contact" number={21} title="Contact">
        <p>
          Questions about these Terms can be sent to <strong>[LEGAL CONTACT EMAIL]</strong>.
        </p>
      </Section>
    </LegalLayout>
  );
}
