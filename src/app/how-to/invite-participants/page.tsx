import { GuideLayout, card, border, surface, greenHi, gold, text, textMid, textDim, bc, b } from '@/components/how-to/guide-layout';
import { Screenshot } from '@/components/how-to/screenshot';
import { Step } from '@/components/how-to/step';

export const metadata = { title: 'Invite Participants — How To' };

export default function InviteParticipantsGuide() {
  return (
    <GuideLayout
      slug="invite-participants"
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'How To', href: '/how-to' }, { label: 'Invite Participants' }]}
      title="Invite Participants"
      intro="People are added at the Huddle level first, then assigned into whichever pools they're playing in — this section explains how that works and why."
    >
      <section style={{ background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: gold, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.85rem' }}>Huddle → Roster → Pool</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {[
            { label: 'Huddle', desc: 'The overall group you manage as commissioner — e.g. "Morgan Family". It has its own roster of people and can contain multiple pools.' },
            { label: 'Roster Members', desc: 'People belonging to your Huddle. Adding someone to the roster doesn\'t put them in a pool yet — it just makes them available to add.' },
            { label: 'Pool', desc: 'The actual competition where picks happen. Participants in a pool are usually roster members you\'ve added to it — a pool can also allow people to join directly via a shared link.' },
          ].map((row, i) => (
            <div key={row.label} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', paddingLeft: i * 20 }}>
              <span style={{ ...bc, fontWeight: 900, fontSize: '0.9rem', color: greenHi }}>{'→'.repeat(i ? 1 : 0)}</span>
              <div>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.85rem', color: text, textTransform: 'uppercase' }}>{row.label}</p>
                <p style={{ ...b, fontSize: '0.85rem', color: textMid, margin: '0.15rem 0 0' }}>{row.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Step number={1} title="Add People to Your Huddle Roster">
        <Screenshot
          src="/how-to/huddle-detail-roster.png"
          alt="Morgan Family Huddle page on a phone, showing the League Roster with three members added, and the Morgan Family Pool card with an Add from Roster section"
          width={1170} height={4107}
        />
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          On your Huddle page, enter a <strong>name</strong> (required) and an optional <strong>email</strong>, then click <strong>Add to League</strong>. Adding an email lets that person be invited automatically when you add them to a pool — leave it blank if you&apos;d rather notify them yourself.
        </p>
      </Step>

      <Step number={2} title="Assign Them Into a Pool">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Under each pool card, an <strong>Add from Roster</strong> section lists everyone in the Huddle who isn&apos;t in that pool yet — click a name to add them as a participant. Each roster member shows how many pools they&apos;re currently in (e.g. &quot;In 0 of 1 Pool&quot;), so you can see at a glance who still needs to be added.
        </p>
      </Step>

      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1rem 1.25rem', marginTop: '1.5rem' }}>
        <p style={{ ...bc, fontWeight: 700, fontSize: '0.8rem', color: textDim, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.35rem' }}>What happens next</p>
        <p style={{ ...b, fontSize: '0.85rem', color: textMid, lineHeight: 1.6, margin: 0 }}>
          Once someone is a participant in a pool, they can make picks each week — either using the pool link you share with them, or the invitation email if you added one. No account or sign-up is required on their end.
        </p>
      </div>
    </GuideLayout>
  );
}
