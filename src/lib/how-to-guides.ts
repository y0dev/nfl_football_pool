// Single source of truth for the How-To section's guides — landing-page
// cards, breadcrumb labels, and Previous/Next order all read from here, so
// adding/reordering a guide only ever needs an edit in this one file.

export interface HowToGuide {
  slug: string;
  /** Landing-page card title / breadcrumb label. */
  title: string;
  /** Landing-page card body text. */
  summary: string;
}

export const HOW_TO_GUIDES: HowToGuide[] = [
  {
    slug: 'commissioner-dashboard',
    title: 'Commissioner Dashboard',
    summary: 'Learn what everything on your dashboard means.',
  },
  {
    slug: 'create-a-pool',
    title: 'Create Your First Pool',
    summary: 'Learn how to create a pool from your Huddle.',
  },
  {
    slug: 'invite-participants',
    title: 'Invite Participants',
    summary: 'Learn how participants are added and used by your pools.',
  },
  {
    slug: 'share-a-pool',
    title: 'Share Your Pool',
    summary: 'Learn how to share your pool with participants.',
  },
  {
    slug: 'make-picks',
    title: 'Make Picks',
    summary: 'Learn how participants make weekly picks.',
  },
  {
    slug: 'pickem-picks',
    title: "How Pick'em Works",
    summary: "Learn the rules for a Pick'em pool: no confidence points, one point per correct pick, and how ties break.",
  },
  {
    slug: 'survivor-picks',
    title: 'How Survivor Works',
    summary: 'Learn the rules for a Survivor pool: one team a week, never reused, and what happens once you’re out.',
  },
  {
    slug: 'leaderboard',
    title: 'View the Leaderboard',
    summary: 'Learn how to track standings and results.',
  },
  {
    slug: 'manage-your-pool',
    title: 'Manage Your Pool',
    summary: 'Learn how to manage your pool throughout the season.',
  },
  {
    slug: 'payouts',
    title: 'Set Up Payouts',
    summary: 'Learn how to configure and calculate weekly and season payouts.',
  },
];

export function getGuideBySlug(slug: string): HowToGuide | undefined {
  return HOW_TO_GUIDES.find(g => g.slug === slug);
}

/** Previous/Next neighbors for a guide, in the recommended read order above. */
export function getGuideNeighbors(slug: string): { prev?: HowToGuide; next?: HowToGuide } {
  const i = HOW_TO_GUIDES.findIndex(g => g.slug === slug);
  if (i === -1) return {};
  return { prev: HOW_TO_GUIDES[i - 1], next: HOW_TO_GUIDES[i + 1] };
}
