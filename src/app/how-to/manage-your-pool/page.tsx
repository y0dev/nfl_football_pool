import { GuideLayout, textMid, b } from '@/components/how-to/guide-layout';
import { Screenshot } from '@/components/how-to/screenshot';
import { Callout } from '@/components/how-to/callout';
import { Step } from '@/components/how-to/step';

export const metadata = { title: 'Manage Your Pool — How To' };

export default function ManageYourPoolGuide() {
  return (
    <GuideLayout
      slug="manage-your-pool"
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'How To', href: '/how-to' }, { label: 'Manage Your Pool' }]}
      title="Manage Your Pool"
      intro="Everything from setup through the end of the season happens in the Pool Workspace on your dashboard — this guide covers what each tab is for."
    >
      <Step number={1} title="Overview">
        <Screenshot
          src="/how-to/pool-workspace-overview.png"
          alt="Pool Workspace Overview tab on a phone, showing participant count, pending picks, completion rate, and a list of participants missing this week's picks"
          width={1170} height={1992}
        />
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          The Overview tab is your at-a-glance check for the current week: how many participants have submitted picks, who&apos;s still pending, and the pool&apos;s overall completion rate.
        </p>
      </Step>

      <Step number={2} title="Players">
        <Screenshot
          src="/how-to/pool-workspace-players.png"
          alt="Pool Workspace Players tab on a phone, listing pool participants with their email and join date, and Add User / Bulk Add / Export controls"
          width={1170} height={1992}
        />
        <Callout
          items={[
            { label: 'Pool Participants', description: 'Everyone currently in this specific pool — search, add, or remove people here.' },
            { label: 'Add / Bulk Add', description: 'Add one participant at a time, or bring in several at once.' },
            { label: 'Export', description: 'Download the participant list for this pool.' },
          ]}
        />
      </Step>

      <Step number={3} title="Leaderboard">
        <Screenshot
          src="/how-to/pool-workspace-leaderboard.png"
          alt="Pool Workspace Leaderboard tab on a phone, showing season standings for the pool"
          width={1170} height={1992}
        />
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          The same standings your participants see publicly, without leaving your dashboard. See the <a href="/how-to/leaderboard" style={{ color: textMid, textDecoration: 'underline' }}>Leaderboard guide</a> for how Weekly, Season, and Periods work.
        </p>
      </Step>

      <Step number={4} title="Settings">
        <Screenshot
          src="/how-to/pool-workspace-settings.png"
          alt="Pool Workspace Settings tab on a phone, showing General Settings (name, season scope, status, password, visibility) along with Close Season, Transfer to Another League, and Danger Zone sections"
          width={1170} height={1992}
        />
        <Callout
          items={[
            { label: 'General Settings', description: 'Pool name, season scope, active/inactive status, join password (public pools), and public/private visibility.' },
            { label: 'Close Season', description: 'Lock the pool, stop new picks, and compute the final season winner once the NFL season ends.' },
            { label: 'Transfer to Another League', description: 'Hand the pool — with its participants — to another commissioner\'s Huddle.' },
            { label: 'Danger Zone', description: 'Delete the pool permanently. This also deletes its participants, picks, and scores — there\'s no undo.' },
          ]}
        />
      </Step>

      <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6, marginTop: '1.5rem' }}>
        A pool from a season that&apos;s already ended has its settings locked — this preserves an accurate record of how that season actually ran. Closing the season, transferring, and deleting stay available regardless.
      </p>
    </GuideLayout>
  );
}
