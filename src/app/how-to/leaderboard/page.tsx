import { GuideLayout, textMid, b } from '@/components/how-to/guide-layout';
import { Screenshot } from '@/components/how-to/screenshot';
import { Callout } from '@/components/how-to/callout';
import { Step } from '@/components/how-to/step';

export const metadata = { title: 'View the Leaderboard — How To' };

export default function LeaderboardGuide() {
  return (
    <GuideLayout
      slug="leaderboard"
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'How To', href: '/how-to' }, { label: 'Leaderboard' }]}
      title="View the Leaderboard"
      intro="Every pool has a public leaderboard — no login needed — with three ways to look at standings."
    >
      <Step number={1} title="Weekly, Season, and Periods">
        <Screenshot
          src="/how-to/leaderboard-page.png"
          alt="Sunday Huddle leaderboard page on a phone, showing Weekly, Season, and Periods tabs, and a standings table with rank, participant, and points"
          width={1170} height={1992}
        />
        <Callout
          items={[
            { label: 'Weekly', description: 'Standings for one week at a time — points, correct picks, and each participant\'s pick on every game that week. Use Prev/Next to move between weeks and season types (preseason, regular season, postseason).' },
            { label: 'Season', description: 'Cumulative standings across the whole season — who\'s leading overall.' },
            { label: 'Periods', description: 'Standings broken into quarters of the regular season, for pools that track period winners alongside the season champion.' },
          ]}
        />
      </Step>

      <Step number={2} title="How Standings Are Calculated">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Each correct pick earns its assigned confidence points. A week&apos;s total is the sum of points from correct picks that week; ties are broken using the pool&apos;s configured tie-breaker method. A game only counts once it&apos;s finished — until then it shows as pending on the standings table.
        </p>
      </Step>

      <Step number={3} title="What to Look For as Commissioner">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          The leaderboard is also where weekly and season winners get recorded automatically once all of a week&apos;s games finish — worth checking after Monday Night Football each week, and again once the season wraps up.
        </p>
      </Step>
    </GuideLayout>
  );
}
