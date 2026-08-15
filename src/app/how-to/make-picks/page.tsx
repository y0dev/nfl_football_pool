import { GuideLayout, textMid, b } from '@/components/how-to/guide-layout';
import { Screenshot } from '@/components/how-to/screenshot';
import { Callout } from '@/components/how-to/callout';
import { Step } from '@/components/how-to/step';

export const metadata = { title: 'How to Make Your Picks — How To' };

export default function MakePicksGuide() {
  return (
    <GuideLayout
      slug="make-picks"
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'How To', href: '/how-to' }, { label: 'Making Picks' }]}
      title="How to Make Your Picks"
      intro="This is what participants see each week — no account needed, just the pool link (and password, for private pools)."
    >
      <Step number={1} title="Open the Pool and Pick a Week">
        <Screenshot
          src="/how-to/picks-page.png"
          alt="Sunday Huddle picks page for Week 1 showing the game count, week navigation, and a list of all 16 games with kickoff times"
        />
        <Callout
          items={[
            { label: 'Week Navigator', description: 'Use Prev / Current / Next, or the Week dropdown, to jump to any week in the pool\'s season.' },
            { label: 'Game Count & Status', description: 'Badges show how many games this week, the season type, and whether picks are currently locked or open.' },
            { label: 'Game Details', description: 'Each game lists both teams with their logos, kickoff time, and a status badge — Available, Upcoming, Locked, or Final.' },
          ]}
        />
      </Step>

      <Step number={2} title="Select a Team and Confidence Points">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Click <strong>Make Picks</strong>, choose your name, then for each game tap the team you think will win — its logo and colors highlight to confirm your selection. Assign each pick a <strong>confidence point</strong> value (1 up to the number of games that week): use your highest number on the game you&apos;re most sure about, since correct picks are worth more points at higher confidence.
        </p>
      </Step>

      <Step number={3} title="Submit Your Picks">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Once every game has a team and a confidence value assigned, save your picks. You can come back and change them anytime before the week locks.
        </p>
      </Step>

      <Step number={4} title="Locked and Finished Games">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Picks for the entire week <strong>lock</strong> as soon as the first game of that week kicks off — every game shows Locked at that point, even ones that haven&apos;t started yet. Once a game ends, it shows <strong>Final</strong> with the score, and whether your pick was correct.
        </p>
      </Step>
    </GuideLayout>
  );
}
