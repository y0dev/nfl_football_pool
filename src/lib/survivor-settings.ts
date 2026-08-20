// Pure, client-safe Survivor type_settings helpers — split out of
// src/lib/survivor.ts specifically so client components (Pool Settings)
// can import them without pulling in that file's getSupabaseServiceClient
// import. Bundling the service-role client into browser JS is a real,
// previously-fixed class of bug in this project (the service key leaked
// once already via exactly this kind of same-file mixing) — this file has
// zero server-only imports, on purpose, so it's safe from any client
// component.

export type SurvivorNoPickRule = 'eliminate' | 'keep_active';
export type SurvivorTieRule = 'eliminate' | 'keep_active';
export type SurvivorEndOfSeasonRule = 'all_remaining_winners' | 'margin_tiebreaker';

export interface SurvivorTypeSettings {
  noPickRule: SurvivorNoPickRule;
  tieRule: SurvivorTieRule;
  endOfSeasonRule: SurvivorEndOfSeasonRule;
}

export const DEFAULT_SURVIVOR_TYPE_SETTINGS: SurvivorTypeSettings = {
  noPickRule: 'eliminate',
  tieRule: 'eliminate',
  endOfSeasonRule: 'all_remaining_winners',
};

/** `pools.type_settings` is untyped JSONB with no shape enforced at the DB
 * level — this is the one place that turns whatever's stored into a fully
 * populated, safe-to-use settings object, falling back per-field so a
 * partially-configured or pre-existing `{}` pool never produces undefined
 * behavior. */
export function parseSurvivorTypeSettings(raw: unknown): SurvivorTypeSettings {
  const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  const noPickRule: SurvivorNoPickRule = r.noPickRule === 'keep_active' ? 'keep_active' : DEFAULT_SURVIVOR_TYPE_SETTINGS.noPickRule;
  const tieRule: SurvivorTieRule = r.tieRule === 'keep_active' ? 'keep_active' : DEFAULT_SURVIVOR_TYPE_SETTINGS.tieRule;
  const endOfSeasonRule: SurvivorEndOfSeasonRule = r.endOfSeasonRule === 'margin_tiebreaker' ? 'margin_tiebreaker' : DEFAULT_SURVIVOR_TYPE_SETTINGS.endOfSeasonRule;
  return { noPickRule, tieRule, endOfSeasonRule };
}
