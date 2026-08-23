import { GuideLayout, textMid, textDim, b } from '@/components/how-to/guide-layout';
import { Callout } from '@/components/how-to/callout';
import { Step } from '@/components/how-to/step';

export const metadata = { title: "How Pick'em Works — How To" };

export default function PickemPicksGuide() {
  return (
    <GuideLayout
      slug="pickem-picks"
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'How To', href: '/how-to' }, { label: "Pick'em" }]}
      title="How Pick'em Works"
      intro="Pick'em keeps things simple: no confidence points to juggle, just pick who wins."
    >
      <Step number={1} title="Pick a Winner for Every Game">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Choose your name, then for each game tap the team you think will win. There&apos;s no confidence value to assign — every pick is worth the same.
        </p>
        <Callout
          items={[
            { label: 'Per-Game Locking', description: 'Each game locks independently at its own kickoff, not the whole week at once — so a Thursday night game locking doesn\'t stop you from picking Sunday\'s games.' },
            { label: 'One Point Each', description: 'A correct pick earns exactly 1 point. There\'s no bonus for a harder game or a bigger upset.' },
          ]}
        />
      </Step>

      <Step number={2} title="Predict the Tiebreaker Score">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Below the games, enter your prediction for the <strong>combined final score</strong>{' '}(both teams&apos; points added together) of that week&apos;s tiebreaker game — usually Monday Night Football, or the week&apos;s last game if there&apos;s no Monday game. This prediction never earns or costs points on its own; it only comes into play if you&apos;re tied with someone else. Submit it any time before that specific game kicks off.
        </p>
      </Step>

      <Step number={3} title="Submit Your Picks">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Once every open game has a pick, tap <strong>Submit Picks</strong>. Like Confidence pools, this is a one-time submission for the week — once it&apos;s in, your picks lock and only a commissioner or admin can unlock them for changes. (The tiebreaker prediction is a separate, independent submission from the game picks.)
        </p>
      </Step>

      <Step number={4} title="How Ties Are Broken">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6, marginBottom: '0.75rem' }}>
          If your commissioner has tiebreakers turned on for this pool (the default), a tie for the most correct picks — either for the week or for the season — is broken by whoever&apos;s tiebreaker prediction was closest to the tiebreaker game&apos;s actual combined score.
        </p>
        <Callout
          items={[
            { label: 'Weekly Ties', description: 'Whoever had the fewest correct picks that week is out of the running; among those tied for the most, closest prediction wins that week.' },
            { label: 'Season Ties', description: 'The same idea, but summed across every week\'s tiebreaker prediction — smallest total deviation from the actual scores wins the season.' },
            { label: 'Still Tied?', description: 'If nobody in the tied group submitted a prediction (or the deviations are exactly equal), the tie stands and everyone tied is a co-winner.' },
          ]}
        />
      </Step>

      <Step number={5} title="Weekly and Season Scoring">
        <p style={{ ...b, fontSize: '0.9rem', color: textMid, lineHeight: 1.6 }}>
          Your weekly score is your number of correct picks that week (out of that week&apos;s games). Your season total is the sum of every week&apos;s correct picks. The leaderboard ranks everyone by season total first, then by tiebreaker deviation if the pool has tiebreakers enabled.
        </p>
        <p style={{ ...b, fontSize: '0.82rem', color: textDim, lineHeight: 1.6, marginTop: '0.5rem' }}>
          A game only counts once it&apos;s finished — until then your pick shows as pending on the standings.
        </p>
      </Step>
    </GuideLayout>
  );
}
