'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Share2, Copy, Check, Smartphone, Mail, Calendar } from 'lucide-react';
import { getUpcomingWeek } from '@/actions/loadCurrentWeek';
import { useToast } from '@/hooks/use-toast';

const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const labelSt: React.CSSProperties = { ...bc, fontSize: '0.68rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.35rem' };
const inputSt: React.CSSProperties = { ...b, background: surface, border: `1px solid ${border}`, color: textMid, padding: '0.5rem 0.75rem', width: '100%', borderRadius: 6, boxSizing: 'border-box', fontSize: '0.78rem' };
const btnBase: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', border: `1px solid ${border}`, borderRadius: 6, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase' };

const ALL_SEASON_TYPES = [
  { value: 1, label: 'Preseason' },
  { value: 2, label: 'Regular Season' },
  { value: 3, label: 'Postseason' },
];

interface SharePoolButtonProps {
  poolId: string;
  poolName: string;
  seasonScope?: number[];
}

export function SharePoolButton({ poolId, poolName, seasonScope }: SharePoolButtonProps) {
  const scope = seasonScope && seasonScope.length > 0 ? [...seasonScope].sort((a, b) => a - b) : [1, 2, 3];
  const clampToScope = (st: number) => scope.includes(st) ? st : scope[0];

  const [isOpen, setIsOpen] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeasonType, setCurrentSeasonType] = useState(clampToScope(2));
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedSeasonType, setSelectedSeasonType] = useState(clampToScope(2));
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [availableWeeks, setAvailableWeeks] = useState<number[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const loadWeek = async () => {
      try {
        const { week, seasonType } = await getUpcomingWeek();
        const clamped = clampToScope(seasonType);
        setCurrentWeek(week);
        setCurrentSeasonType(clamped);
        setSelectedWeek(week);
        setSelectedSeasonType(clamped);
        setAvailableWeeks(Array.from({ length: getMaxWeeks(clamped) }, (_, i) => i + 1));
      } catch {
        const fallback = clampToScope(2);
        setCurrentWeek(1);
        setCurrentSeasonType(fallback);
        setSelectedWeek(1);
        setSelectedSeasonType(fallback);
        setAvailableWeeks(Array.from({ length: getMaxWeeks(fallback) }, (_, i) => i + 1));
      }
    };
    loadWeek();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShareUrl(`${window.location.origin}/pool/${poolId}/picks?week=${selectedWeek}&seasonType=${selectedSeasonType}`);
    }
  }, [poolId, selectedWeek, selectedSeasonType]);

  const getSeasonTypeName = (st: number) =>
    st === 1 ? 'Preseason' : st === 2 ? 'Regular Season' : st === 3 ? 'Postseason' : 'Unknown';

  const getMaxWeeks = (st: number) => (st === 1 || st === 3 ? 4 : 18);

  const handleSeasonTypeChange = (st: number) => {
    const clamped = clampToScope(st);
    setSelectedSeasonType(clamped);
    const max = getMaxWeeks(clamped);
    setAvailableWeeks(Array.from({ length: max }, (_, i) => i + 1));
    if (selectedWeek > max) setSelectedWeek(1);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: 'Copied!', description: `${getSeasonTypeName(selectedSeasonType)} Week ${selectedWeek} link copied` });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Error', description: 'Failed to copy link', variant: 'destructive' });
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${poolName} — ${getSeasonTypeName(selectedSeasonType)} Week ${selectedWeek}`,
          text: 'Join my confidence pool!',
          url: shareUrl,
        });
      } catch (e) {
        if (e instanceof Error && e.name !== 'AbortError') handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`Join ${poolName} — ${getSeasonTypeName(selectedSeasonType)} Week ${selectedWeek}`);
    const body = encodeURIComponent(`Hi!\n\nJoin my confidence pool!\n\n${shareUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            background: 'transparent', border: `1px solid ${border}`,
            borderRadius: 6, color: textMid,
            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          <Share2 style={{ width: 14, height: 14, flexShrink: 0 }} />
          <span>Share</span>
        </button>
      </DialogTrigger>

      <DialogContent style={{ maxWidth: '28rem', background: card, border: `1px solid ${border}` }}>
        <DialogHeader>
          <DialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Share Pool
          </DialogTitle>
          <DialogDescription style={{ ...b, fontSize: '0.8rem', color: textDim }}>
            Share this link with participants to join {poolName}
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.25rem' }}>

          {/* Season Type */}
          <div>
            <p style={labelSt}>Season Type</p>
            <Select value={selectedSeasonType.toString()} onValueChange={(v) => handleSeasonTypeChange(parseInt(v))}>
              <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ background: card, border: `1px solid ${border}`, zIndex: 9999 }}>
                {ALL_SEASON_TYPES.filter(o => scope.includes(o.value)).map(o => (
                  <SelectItem key={o.value} value={o.value.toString()}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.3rem' }}>
              {getSeasonTypeName(selectedSeasonType)} · Weeks 1-{getMaxWeeks(selectedSeasonType)}
            </p>
          </div>

          {/* Week */}
          <div>
            <p style={labelSt}>Week</p>
            <Select value={selectedWeek.toString()} onValueChange={(v) => setSelectedWeek(parseInt(v))}>
              <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ background: card, border: `1px solid ${border}`, zIndex: 9999 }}>
                {availableWeeks.map(w => (
                  <SelectItem key={w} value={w.toString()}>
                    Week {w}{w === currentWeek && selectedSeasonType === currentSeasonType ? ' (Current)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* URL row */}
          <div>
            <p style={labelSt}>Pool Link — {getSeasonTypeName(selectedSeasonType)} Week {selectedWeek}</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input value={shareUrl} readOnly style={{ ...inputSt, flex: 1 }} />
              <button
                onClick={handleCopy}
                style={{ ...btnBase, background: copied ? green : surface, color: copied ? text : textMid, flexShrink: 0 }}
              >
                {copied
                  ? <><Check style={{ width: 13, height: 13 }} />Copied</>
                  : <><Copy style={{ width: 13, height: 13 }} />Copy</>}
              </button>
            </div>
          </div>

          {/* Preview */}
          <button
            onClick={() => window.open(shareUrl, '_blank')}
            style={{ ...btnBase, width: '100%', background: surface, color: textMid }}
          >
            <Calendar style={{ width: 13, height: 13 }} />
            Preview {getSeasonTypeName(selectedSeasonType)} Week {selectedWeek} Picks
          </button>

          {/* Share via */}
          <div>
            <p style={labelSt}>Share via</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button onClick={handleNativeShare} style={{ ...btnBase, background: surface, color: textMid }}>
                <Smartphone style={{ width: 13, height: 13 }} />
                Native Share
              </button>
              <button onClick={handleEmailShare} style={{ ...btnBase, background: surface, color: textMid }}>
                <Mail style={{ width: 13, height: 13 }} />
                Email
              </button>
            </div>
          </div>

          {/* Note */}
          <div style={{ padding: '0.65rem 0.85rem', background: `color-mix(in oklch, ${greenHi} 8%, ${surface})`, border: `1px solid color-mix(in oklch, ${greenHi} 25%, ${border})`, borderRadius: 6 }}>
            <p style={{ ...b, fontSize: '0.78rem', color: textMid }}>
              Takes participants directly to <strong style={{ color: text }}>{getSeasonTypeName(selectedSeasonType)} Week {selectedWeek}</strong> picks for {poolName}.
              {selectedWeek === currentWeek && selectedSeasonType === currentSeasonType ? ' (Current week)' : ''}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
          <button onClick={() => setIsOpen(false)} style={{ ...btnBase, background: 'transparent', color: textMid }}>
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
