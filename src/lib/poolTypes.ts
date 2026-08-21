// Registry of pool competition types. Single source of truth for the create-
// pool UI picker (src/components/pools/create-pool-dialog.tsx) and
// server-side validation (src/actions/createPool.ts). Mirrors the
// `pools_competition_type_check` constraint in docs/migrations/add-huddles.sql
// — adding a new type here still requires widening that CHECK constraint.

export type CompetitionType =
  | 'NFL_CONFIDENCE'
  | 'NCAA_CONFIDENCE'
  | 'SURVIVOR'
  | 'PICKEM'
  | 'MARCH_MADNESS';

export interface PoolTypeDef {
  id: CompetitionType;
  label: string;
  description: string;
  available: boolean;
}

export const POOL_TYPES: PoolTypeDef[] = [
  {
    id: 'NFL_CONFIDENCE',
    label: 'NFL Confidence Pool',
    description: 'Pick every game and assign confidence points.',
    available: true,
  },
  {
    id: 'NCAA_CONFIDENCE',
    label: 'NCAA Confidence Pool',
    description: 'Coming soon.',
    available: false,
  },
  {
    id: 'SURVIVOR',
    label: 'Survivor Pool',
    description: "Pick one team each week. If your team loses, you're eliminated — and you can't use the same team twice.",
    available: true,
  },
  {
    id: 'PICKEM',
    label: "Pick'em Pool",
    description: "Pick the winner of every game. Each correct pick is worth one point.",
    available: false, // backend service layer exists; Picks/Leaderboard/Settings UI not yet built — see session notes
  },
  {
    id: 'MARCH_MADNESS',
    label: 'March Madness Pool',
    description: 'Coming soon.',
    available: false,
  },
];

export const DEFAULT_COMPETITION_TYPE: CompetitionType = 'NFL_CONFIDENCE';

export function isAvailableCompetitionType(value: unknown): value is CompetitionType {
  return POOL_TYPES.some(t => t.available && t.id === value);
}
