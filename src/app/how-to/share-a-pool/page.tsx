import { GuideLayout, card, border, amber, textMid, b, bc } from '@/components/how-to/guide-layout';
import { Screenshot } from '@/components/how-to/screenshot';
import { Step } from '@/components/how-to/step';

export const metadata = { title: 'Share Your Pool — How To' };

export default function ShareAPoolGuide() {
  return (
    <GuideLayout
      slug="share-a-pool"
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'How To', href: '/how-to' }, { label: 'Share Your Pool' }]}
      title="Share Your Pool"
      intro="Once your pool has participants, they need the pool link to make picks — and for private pools, the password too."
    >
      <Step number={1} title="Find the Share Button">
        <Screenshot
          src="/how-to/picks-page.png"
          alt="Sunday Huddle picks page on a phone, showing the Share, Make Picks, and Stats buttons below the week heading"
          width={1170} height={1992}
        />
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          On the pool&apos;s Picks page, click <strong>Share</strong>. On mobile, this opens your device&apos;s normal share sheet (text, email, whatever apps you have). On desktop, it copies the pool link — and password, if the pool is private — to your clipboard.
        </p>
      </Step>

      <Step number={2} title="Public Pools">
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1rem 1.25rem' }}>
          <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6, margin: 0 }}>
            A public pool&apos;s link is all anyone needs — no password. Public pools can also be found by searching from the Sunday Huddle home page.
          </p>
        </div>
      </Step>

      <Step number={3} title="Private Pools">
        <div style={{ background: card, border: `1px solid ${amber}55`, borderRadius: 10, padding: '1rem 1.25rem' }}>
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', color: amber, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.5rem' }}>Requires both</p>
          <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6, margin: 0 }}>
            A private pool needs the <strong>pool link</strong> and the <strong>pool password</strong> — participants can&apos;t view picks, the leaderboard, or results with just the link. As the commissioner, your Share message automatically includes the password so you don&apos;t have to look it up separately. You can also view or copy it anytime from the pool&apos;s Settings tab.
          </p>
        </div>
      </Step>
    </GuideLayout>
  );
}
