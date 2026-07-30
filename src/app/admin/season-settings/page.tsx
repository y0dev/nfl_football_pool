'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Save } from 'lucide-react';
import { useAuth, AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { loadSeasonSettings, updateSeasonSettings } from '@/actions/seasonSettings';
import { getNFLSeasonYear, debugError } from '@/lib/utils';

const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const inputStyle = { ...b, background: surface, border: `1px solid ${border}`, color: text, padding: '0.5rem 0.75rem', width: '100%', borderRadius: 6, boxSizing: 'border-box' as const, fontSize: '0.875rem' };
const labelStyle = { ...bc, fontSize: '0.65rem', fontWeight: 700 as const, color: textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block', marginBottom: '0.35rem' };

const SEASON_TYPES = [
  { value: 0, label: 'Offseason' },
  { value: 1, label: 'Preseason' },
  { value: 2, label: 'Regular Season' },
  { value: 3, label: 'Postseason' },
];

function SeasonSettingsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [season, setSeason] = useState(getNFLSeasonYear());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preseasonStartDate, setPreseasonStartDate] = useState('');
  const [regularSeasonStartDate, setRegularSeasonStartDate] = useState('');
  const [postseasonStartDate, setPostseasonStartDate] = useState('');
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeasonType, setCurrentSeasonType] = useState(0);
  const [seasonOver, setSeasonOver] = useState(false);

  const load = useCallback(async (targetSeason: number) => {
    setIsLoading(true);
    try {
      const settings = await loadSeasonSettings(targetSeason);
      setPreseasonStartDate(settings.preseasonStartDate?.slice(0, 10) ?? '');
      setRegularSeasonStartDate(settings.regularSeasonStartDate?.slice(0, 10) ?? '');
      setPostseasonStartDate(settings.postseasonStartDate?.slice(0, 10) ?? '');
      setCurrentWeek(settings.currentWeek);
      setCurrentSeasonType(settings.currentSeasonType);
      setSeasonOver(settings.seasonOver);
    } catch (error) {
      debugError('Failed to load season settings:', error);
      toast({ title: 'Error', description: 'Failed to load season settings.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(season); }, [season, load]);

  const handleSave = async () => {
    if (!user?.email) return;
    setIsSaving(true);
    try {
      const result = await updateSeasonSettings(season, {
        preseasonStartDate: preseasonStartDate || null,
        regularSeasonStartDate: regularSeasonStartDate || null,
        postseasonStartDate: postseasonStartDate || null,
        currentWeek,
        currentSeasonType,
        seasonOver,
      }, user.email);

      if (!result.success) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Saved', description: `Season ${season} settings updated.` });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'oklch(13% 0.025 255 / 0.95)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${border}` }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <button onClick={() => router.push('/admin/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 }}>
              <ArrowLeft style={{ width: 12, height: 12 }} /> Back
            </button>
            <div style={{ width: 1, height: 20, background: border, flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Calendar style={{ width: 14, height: 14, color: bg }} />
              </div>
              <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Season Settings
              </span>
            </div>
          </div>
        </div>
      </nav>

      <section style={{ padding: '2.5rem 0 3rem' }}>
        <div className="lp-inner" style={{ maxWidth: 640 }}>
          <p style={{ ...b, fontSize: '0.85rem', color: textMid, marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Controls when each season phase is considered active — used to block creating a pool scoped to a phase whose last week has already started (e.g. no new preseason-only pools once preseason week 4 has begun).
          </p>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>Season Year</label>
            <input
              type="number"
              value={season}
              onChange={(e) => setSeason(Number(e.target.value) || getNFLSeasonYear())}
              style={{ ...inputStyle, maxWidth: 160 }}
            />
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: textDim, ...b, fontSize: '0.85rem' }}>Loading…</div>
          ) : (
            <div style={{ background: card, border: `1px solid ${border}`, borderLeft: `3px solid ${green}`, borderRadius: 8, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Preseason Start Date</label>
                  <input type="date" value={preseasonStartDate} onChange={(e) => setPreseasonStartDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Regular Season Start Date</label>
                  <input type="date" value={regularSeasonStartDate} onChange={(e) => setRegularSeasonStartDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Postseason Start Date</label>
                  <input type="date" value={postseasonStartDate} onChange={(e) => setPostseasonStartDate(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Current Phase</label>
                  <Select value={String(currentSeasonType)} onValueChange={(v) => setCurrentSeasonType(Number(v))}>
                    <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEASON_TYPES.map(t => (
                        <SelectItem key={t.value} value={String(t.value)}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label style={labelStyle}>Current Week <span style={{ textTransform: 'none', fontWeight: 400 }}>(within that phase)</span></label>
                  <input type="number" min={1} value={currentWeek} onChange={(e) => setCurrentWeek(Number(e.target.value) || 1)} style={inputStyle} />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                <Checkbox checked={seasonOver} onCheckedChange={(v) => setSeasonOver(v === true)} />
                <span style={{ ...b, fontSize: '0.85rem', color: text }}>Season is over</span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: isSaving ? surface : green, color: isSaving ? textDim : text, border: 'none', borderRadius: 6, cursor: isSaving ? 'not-allowed' : 'pointer', ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                >
                  <Save style={{ width: 13, height: 13 }} />
                  {isSaving ? 'Saving…' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function SeasonSettingsPage() {
  return (
    <AuthProvider>
      <AdminGuard requireSuperAdmin>
        <SeasonSettingsContent />
      </AdminGuard>
    </AuthProvider>
  );
}
