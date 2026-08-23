import { GuideLayout, textMid, textDim, b } from '@/components/how-to/guide-layout';
import { Callout } from '@/components/how-to/callout';
import { Step } from '@/components/how-to/step';

export const metadata = { title: 'How Survivor Works — How To' };

export default function SurvivorPicksGuide() {
  return (
    <GuideLayout
      slug="survivor-picks"
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'How To', href: '/how-to' }, { label: 'Survivor' }]}
      title="How Survivor Works"
      intro="One pick a week. Win and you move on; lose and you're out — with one catch: you can't lean on the same team twice."
    >
      <Step number={1} title="Pick One Team to Survive">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Choose your name, then pick <strong>one team</strong>{' '}you think will win this week&apos;s game. That&apos;s your only pick for the week — there&apos;s no full slate of games to fill out like Confidence or Pick&apos;em.
        </p>
        <Callout
          items={[
            { label: 'No Reusing a Team', description: 'Once you\'ve picked a team, you can never pick it again for the rest of the season — even after you\'ve survived several weeks with it. This is enforced by the pool: picking an already-used team is rejected outright.' },
            { label: 'Change Your Mind', description: 'You can switch your pick as many times as you like while the week is still unlocked — only your final submitted pick counts.' },
          ]}
        />
      </Step>

      <Step number={2} title="Submit Your Pick">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Tap <strong>Submit Pick</strong>{' '}once you&apos;ve chosen a team. Like Confidence and Pick&apos;em, this is a one-time submission for the week — after submitting, your pick locks and only a commissioner or admin can unlock it. Every pick also locks on its own at that week&apos;s kickoff, whichever comes first.
        </p>
      </Step>

      <Step number={3} title="Winning and Losing">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6, marginBottom: '0.75rem' }}>
          If your team wins, you survive to the next week. If your team loses, you&apos;re eliminated. Your commissioner sets the rules below for this specific pool — check with them if you&apos;re not sure which apply here.
        </p>
        <Callout
          items={[
            { label: 'A Tie', description: 'By default, a tied game eliminates you, same as a loss. Some pools are configured to let you stay active through a tie instead.' },
            { label: 'No Pick Submitted', description: 'By default, missing the week entirely (no pick before it locks) eliminates you. Some pools are configured to just skip that week and keep you active instead.' },
          ]}
        />
      </Step>

      <Step number={4} title="Once You're Eliminated">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          You&apos;ll see exactly which week you were eliminated, which team you picked, and why. You can still open the pool, view the standings, and see everyone else&apos;s picks — you just can&apos;t submit a new pick unless a commissioner unlocks a past week for you.
        </p>
      </Step>

      <Step number={5} title="How the Season Ends">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6, marginBottom: '0.75rem' }}>
          The pool tracks who&apos;s active and who&apos;s eliminated automatically all season, but the season&apos;s official winner is only set once your commissioner explicitly closes it out.
        </p>
        <Callout
          items={[
            { label: 'One Player Left', description: 'If everyone else has been eliminated, the last one standing is the winner.' },
            { label: 'Multiple Players Left', description: 'By default, everyone still active when the season ends shares the win. Some pools are instead configured to pick a single winner by cumulative margin of victory — the total point differential across every game you\'ve won.' },
            { label: 'Everyone Eliminated', description: 'If the whole pool gets wiped out, whoever lasted the longest (survived the most weeks) is treated as last-standing and the normal end-of-season rule above decides the winner among them.' },
          ]}
        />
        <p style={{ ...b, fontSize: '0.82rem', color: textDim, lineHeight: 1.6, marginTop: '0.75rem' }}>
          Staying &quot;active&quot; on the standings doesn&apos;t make you the winner by itself — that only happens once the commissioner finalizes the season.
        </p>
      </Step>
    </GuideLayout>
  );
}
