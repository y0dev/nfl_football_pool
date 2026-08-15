import { GuideLayout, textMid, b } from '@/components/how-to/guide-layout';
import { Screenshot } from '@/components/how-to/screenshot';
import { Callout } from '@/components/how-to/callout';
import { Step } from '@/components/how-to/step';

export const metadata = { title: 'Commissioner Dashboard — How To' };

export default function CommissionerDashboardGuide() {
  return (
    <GuideLayout
      slug="commissioner-dashboard"
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'How To', href: '/how-to' }, { label: 'Commissioner Dashboard' }]}
      title="Commissioner Dashboard"
      intro="Your dashboard at /dashboard is where you manage everything — your Huddles, your pools, and how participants are doing each week."
    >
      <Step number={1} title="Your Access & Stats">
        <Screenshot
          src="/how-to/dashboard-top.png"
          alt="Sunday Huddle commissioner dashboard header showing account status, number of Huddles, pools, and members"
        />
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          The top of your dashboard shows your account status, plan (Standard Commissioner in this example), and quick counts: how many Huddles you run, how many pools are active, and how many members are across all of them.
        </p>
      </Step>

      <Step number={2} title="The Full Dashboard">
        <Screenshot
          src="/how-to/dashboard-full.png"
          alt="Full Sunday Huddle commissioner dashboard showing this week's games, your League card, and the Pool Workspace with tabs for Overview, Players, Leaderboard, and Settings"
        />
        <Callout
          items={[
            { label: 'This Week\'s Games', description: 'A live look at the current week\'s NFL games and scores — no need to leave the dashboard to check.' },
            { label: 'Your Huddle Card', description: 'Shows your Huddle\'s name and how many pools it has, with quick links to create a pool or manage the Huddle.' },
            { label: 'Pool Workspace', description: 'Once you have a pool, this section appears with tabs — Overview, Players, Leaderboard, Override Picks, Season Review, Export, and Settings — for managing that specific pool.' },
            { label: 'Recent Activity', description: 'A running log of what\'s happened in your pool — who joined, when picks were submitted, and more.' },
          ]}
        />
      </Step>

      <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6, marginTop: '1.5rem' }}>
        If you manage more than one pool, a dropdown above the Pool Workspace lets you switch between them — each pool gets its own set of tabs and stats.
      </p>
    </GuideLayout>
  );
}
