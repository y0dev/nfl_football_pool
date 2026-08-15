// Client-safe plan-related copy — kept separate from src/lib/plan.ts (which
// also has DB-touching exports) so client components can import this
// without pulling the service-role client into their bundle.

// The commissioner multi-pool leaderboard tool (/leaderboard) is a Standard
// feature — same boundary as reminders. A trial counts as Standard (it
// already resolves to 'standard' in computePlanInfo); once the trial ends
// and the plan reverts to free, access reverts too.
export const LEADERBOARD_TOOL_PLAN_MESSAGE =
  'The full leaderboard tool requires the Standard plan. Upgrade to see live standings across your pools.';
