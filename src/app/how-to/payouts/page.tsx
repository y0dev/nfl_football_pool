import { GuideLayout, textMid, textDim, b, bc, surface, border, gold } from '@/components/how-to/guide-layout';
import { Callout } from '@/components/how-to/callout';
import { Step } from '@/components/how-to/step';

export const metadata = { title: 'How to Set Up Payouts — How To' };

function MoneyNotice() {
  return (
    <div style={{ background: surface, border: `1px solid ${border}`, borderLeft: `3px solid ${gold}`, borderRadius: 8, padding: '1rem 1.25rem', margin: '1rem 0' }}>
      <p style={{ ...bc, fontWeight: 800, fontSize: '0.78rem', color: gold, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
        Sunday Huddle does not handle money
      </p>
      <p style={{ ...b, fontSize: '0.85rem', color: textMid, lineHeight: 1.6 }}>
        Payouts only calculate how winnings should be distributed based on rules you configure. Sunday Huddle never collects entry fees, holds participant funds, or transfers money — you&apos;re responsible for collecting entry fees and paying winners outside the app.
      </p>
    </div>
  );
}

export default function PayoutsGuide() {
  return (
    <GuideLayout
      slug="payouts"
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'How To', href: '/how-to' }, { label: 'Payouts' }]}
      title="How to Set Up Payouts"
      intro="Configure how your pool's winnings are calculated — Sunday Huddle does the math, you handle the money."
    >
      <MoneyNotice />

      <Step number={1} title="Enable Payout Tracking">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          From your pool&apos;s <strong>Settings</strong> tab, find the <strong>Payouts</strong> section and turn it on. This is entirely optional — a pool with payout tracking off works exactly as before, with no money involved at all. Turning it on doesn&apos;t collect anything; it just unlocks the configuration below.
        </p>
      </Step>

      <Step number={2} title="Entry Fee (Optional)">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Enter what each participant is paying, if anything. This number is used only to calculate dollar amounts — leave it blank for a pool that&apos;s purely competitive with no money changing hands.
        </p>
        <Callout
          items={[
            { label: 'Total Prize Pool', description: 'Entry fee × active participants. Shown live as you configure the rest of the payout settings.' },
          ]}
        />
      </Step>

      <Step number={3} title="Weekly Payouts">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Turn on Weekly Payouts to pay a winner (or a few) every week. Set the weekly amount as either a fixed dollar figure paid out every week, or a percentage of the total prize pool. Then choose how many weekly winners get paid and what share each place receives — pick a preset (1 through 5 winners) or customize your own split. Percentages must add up to exactly 100%.
        </p>
      </Step>

      <Step number={4} title="Overall Season Payouts">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Turn on Overall Payout to reward the season&apos;s final standings. Configure however many places you want to pay (not limited to three) and each place&apos;s percentage of the overall pool — which is automatically the total prize pool minus whatever&apos;s been allocated to weekly payouts. Weekly and Overall payouts are independent: you can run either one alone, or both together.
        </p>
      </Step>

      <Step number={5} title="Handling Ties">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Choose what happens when participants tie for a paid position:
        </p>
        <Callout
          items={[
            { label: 'Split tied payouts equally', description: 'The combined payout for every position the tie spans is divided evenly. Two people tied for 1st ($100) and 2nd ($50) each receive $75.' },
            { label: "Use this pool's tie-breaker", description: "Ranks tied participants using the same Monday-night tie-breaker your leaderboard already uses." },
            { label: 'Decide manually', description: "The calculator flags the tie and leaves the amount for you to fill in yourself, rather than guessing." },
          ]}
        />
      </Step>

      <Step number={6} title="Calculating Payouts">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Open the <strong>Payouts</strong> tab in Pool Management. Pick a week and click Calculate to see that week&apos;s winners and dollar amounts pulled straight from the live leaderboard — no manual math. At the end of the season, use the Overall Payout Calculator the same way against final standings.
        </p>
      </Step>

      <Step number={7} title="Marking Payouts as Paid">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Once you&apos;ve actually paid a winner outside the app, click <strong>Mark Paid</strong> next to their name. This is just a record for you — it doesn&apos;t transfer any money and doesn&apos;t notify the participant. Recalculating later (e.g. after more games finish) keeps whatever you&apos;ve already marked paid.
        </p>
      </Step>

      <Step number={8} title="Who Can See and Change Payout Settings">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Only you, as the pool&apos;s commissioner, can change payout settings or mark a payout as paid. Participants aren&apos;t shown commissioner-only payout controls.
        </p>
      </Step>

      <MoneyNotice />
    </GuideLayout>
  );
}
