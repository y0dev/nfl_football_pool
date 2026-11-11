// deno-lint-ignore-file no-explicit-any
// ESPN scoreboard helpers for the update-game-scores Edge Function. No
// imports, so the same file runs under Deno and under the Node unit tests
// (tests/unit/espn-score-sync.test.ts).

export const ESPN_BASE = 'https://site.web.api.espn.com/apis/site/v2/sports/football/nfl'

/** Upper bound on scoreboard days fetched per run, so a long-stale open game
 * can't trigger a request flood. */
export const MAX_SCOREBOARD_DAYS = 14

const DAY_MS = 86_400_000

export function toYMD(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
}

/**
 * The scoreboard days to fetch: today, plus each open game's kickoff date
 * and the days either side. Driving this off the open games' own kickoff
 * dates, rather than a fixed window around today, means a game the cron
 * missed on its day is still picked up on a later run. Games more than a
 * day in the future are skipped. Capped at the most recent
 * MAX_SCOREBOARD_DAYS days.
 *
 * ESPN files games under their US Eastern calendar date, which trails the
 * UTC date for evening kickoffs (an 8:20pm ET game is 00:20 UTC the next
 * day), hence the day before as well as the day after.
 */
export function scoreboardDates(openGames: Array<{ kickoff_time?: string | null }>, now: number = Date.now()): string[] {
  const dates = new Set<string>([toYMD(new Date(now))])
  for (const g of openGames) {
    const kickoff = g.kickoff_time ? new Date(g.kickoff_time).getTime() : NaN
    if (Number.isNaN(kickoff) || kickoff > now + DAY_MS) continue
    for (const offset of [-1, 0, 1]) dates.add(toYMD(new Date(kickoff + offset * DAY_MS)))
  }
  // YYYYMMDD sorts chronologically; keep the most recent days if capped.
  return [...dates].sort().slice(-MAX_SCOREBOARD_DAYS)
}

/** ESPN's scoreboard rejects `dates=START-END` ranges with a 400, so each day
 * is its own `dates=YYYYMMDD` request. */
export function scoreboardUrl(date: string): string {
  return `${ESPN_BASE}/scoreboard?dates=${date}`
}

type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean
  status: number
  statusText: string
  json: () => Promise<any>
}>

/** Fetches each day in parallel and merges events by id. Any failed day
 * fails the whole call, so a partial result can't pass for a complete one. */
export async function fetchScoreboardEvents(dates: string[], fetchFn: FetchLike = fetch as unknown as FetchLike): Promise<any[]> {
  // Deliberately no custom User-Agent override — ESPN's WAF 403s a spoofed
  // or app-identifying UA (confirmed: 'NFL-Confidence-Pool/1.0' and even a
  // full browser UA both get blocked) but passes an honest, unmodified
  // runtime default (Deno/*, curl/*). Don't "fix" this by adding one back.
  //
  // Fetched in parallel: pg_net gives the cron's HTTP call only 5s, so a
  // sequential loop over several days risks timing out.
  const days = await Promise.all(dates.map(async (date) => {
    const response = await fetchFn(scoreboardUrl(date), { headers: { 'Accept': 'application/json' } })
    if (!response.ok) {
      throw new Error(`ESPN API request failed for ${date}: ${response.status} ${response.statusText}`)
    }
    const data = await response.json()
    return (data?.events ?? []) as any[]
  }))
  const events = new Map<string, any>()
  for (const day of days) for (const event of day) events.set(event.id, event)
  return [...events.values()]
}

export interface GameScoreUpdate {
  status: 'scheduled' | 'live' | 'finished'
  home_score: number | null
  away_score: number | null
  winner: string | null
}

/** Maps one ESPN event onto the games row it belongs to. `winner` is the
 * game's own home_team/away_team text, matching what picks store; a tie has
 * no winner. */
export function gameUpdateFromEvent(event: any, game: { home_team: string; away_team: string }): GameScoreUpdate {
  const competition = event?.competitions?.[0]
  const state = competition?.status?.type?.state ?? 'pre'
  const status = state === 'post' ? 'finished' : state === 'in' ? 'live' : 'scheduled'

  const homeC = competition?.competitors?.find((c: any) => c.homeAway === 'home')
  const awayC = competition?.competitors?.find((c: any) => c.homeAway === 'away')
  const parse = (score: unknown) => (score != null && score !== '' ? parseInt(String(score), 10) : null)
  const home_score = parse(homeC?.score)
  const away_score = parse(awayC?.score)

  let winner: string | null = null
  if (status === 'finished' && home_score != null && away_score != null) {
    if (home_score > away_score) winner = game.home_team
    else if (away_score > home_score) winner = game.away_team
  }
  return { status, home_score, away_score, winner }
}

/** Pairs fetched events with the open games they update, by ESPN event id. */
export function planGameUpdates<G extends { id: string; home_team: string; away_team: string }>(
  openGames: G[],
  events: any[],
): Array<{ id: string; update: GameScoreUpdate }> {
  const byId = new Map(openGames.map(g => [g.id, g]))
  const updates: Array<{ id: string; update: GameScoreUpdate }> = []
  for (const event of events) {
    const game = byId.get(event?.id)
    if (game) updates.push({ id: game.id, update: gameUpdateFromEvent(event, game) })
  }
  return updates
}
