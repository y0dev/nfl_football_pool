import Link from 'next/link';
import { GuideLayout, textMid, textDim, greenHi, b, bc } from '@/components/how-to/guide-layout';
import { Screenshot } from '@/components/how-to/screenshot';
import { Callout } from '@/components/how-to/callout';
import { Step } from '@/components/how-to/step';

export const metadata = { title: 'Create Your First Pool — How To' };

export default function CreateAPoolGuide() {
  return (
    <GuideLayout
      slug="create-a-pool"
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'How To', href: '/how-to' }, { label: 'Create Your First Pool' }]}
      title="Create Your First Pool"
      intro="Every pool lives inside a Huddle. If this is your first pool, Sunday Huddle already created a Huddle for you automatically — you can rename it or create additional ones from My Huddles."
    >
      <Step number={1} title="Open Your Huddle">
        <Screenshot
          src="/how-to/my-huddles.png"
          alt="My Huddles page listing the Morgan Family Huddle with a Create Huddle button"
        />
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          From the nav menu, open <strong>My Huddles</strong>, then click into the Huddle you want to create a pool in. Need a separate Huddle for a different group of friends or family? Use <strong>Create Huddle</strong> here.
        </p>
      </Step>

      <Step number={2} title='Click "Create Pool"'>
        <Screenshot
          src="/how-to/huddle-detail-top.png"
          alt="Huddle detail page for Morgan Family showing the League Roster and a Create Pool button"
        />
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Inside your Huddle, click <strong>Create Pool</strong> to open the setup form.
        </p>
      </Step>

      <Step number={3} title="Configure Your Pool">
        <Screenshot
          src="/how-to/create-pool-dialog.png"
          alt="Create New Pool dialog showing fields for competition type, pool name, season, season scope, pool type, password, and public/private visibility"
        />
        <Callout
          items={[
            { label: 'Competition Type', description: 'NFL Confidence Pool ranks weekly picks by confidence points — the classic format.' },
            { label: 'Pool Name & Season', description: 'What participants will see, and which NFL season this pool tracks.' },
            { label: 'Season Scope', description: 'Which part of the season this pool covers — regular season only, or including the postseason.' },
            { label: 'Pool Type', description: 'Normal Pool uses tie-breakers at set weeks and the Super Bowl.' },
            { label: 'Visibility', description: 'Public pools can be found by search; Private pools are invite-only and require a password.' },
          ]}
        />
      </Step>

      <Step number={4} title="Private Pools Require a Password">
        <Screenshot
          src="/how-to/create-pool-dialog-private.png"
          alt="Create New Pool dialog with Private selected, showing required Pool Password and Confirm Password fields"
        />
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Switch <strong>Visibility</strong> to <strong>Private</strong> and a password becomes required — anyone with the pool link will need it to view picks, the leaderboard, or results. You can view, copy, or change this password later from the pool&apos;s Settings tab.
        </p>
      </Step>

      <div style={{ background: 'oklch(20% 0.03 255)', border: `1px solid oklch(46% 0.14 155 / 0.4)`, borderRadius: 10, padding: '1.25rem', marginTop: '2rem', textAlign: 'center' }}>
        <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: greenHi, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Your pool is ready.</p>
        <p style={{ ...b, fontSize: '0.85rem', color: textDim, marginBottom: '0.85rem' }}>Next, add the people who&apos;ll be picking:</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href="/how-to/invite-participants" style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: greenHi, textDecoration: 'underline' }}>Invite Participants →</Link>
          <Link href="/how-to/share-a-pool" style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: greenHi, textDecoration: 'underline' }}>Share Your Pool →</Link>
        </div>
      </div>
    </GuideLayout>
  );
}
