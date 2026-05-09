'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Users, Trophy, CheckCircle2, Calendar, Target, ArrowLeft, RefreshCw, LogOut } from 'lucide-react';
import { loadUsers } from '@/actions/loadUsers';
import { createPageUrl, debugLog, getTeamAbbreviation } from '@/lib/utils';
import { getUpcomingWeek } from '@/actions/loadCurrentWeek';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';

// Design tokens
const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const amber   = 'oklch(72% 0.16 60)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface PlayoffTeam {
  id: string;
  pool_id: string;
  season: number;
  team_name: string;
  team_abbreviation: string | null;
  conference: string | null;
  seed: number | null;
}

interface Participant {
  id: string;
  name: string;
}

interface SubmissionStatus {
  participant_id: string;
  participant_name: string;
  submitted: boolean;
  submission_count: number;
  total_teams: number;
}

interface ConfidencePointData {
  id: string;
  participant_id: string;
  pool_id: string;
  season: number;
  team_name: string;
  confidence_points: number;
  participants?: {
    name: string;
  };
}

function PlayoffsPageContent() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.id as string;
  const { toast } = useToast();
  const { signOut } = useAuth();

  const [poolName, setPoolName] = useState<string>('');
  const [poolSeason, setPoolSeason] = useState<number>(2025);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('');
  const [playoffTeams, setPlayoffTeams] = useState<PlayoffTeam[]>([]);
  const [sortedPlayoffTeams, setSortedPlayoffTeams] = useState<PlayoffTeam[]>([]);
  const [confidencePoints, setConfidencePoints] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus[]>([]);
  const [allSubmitted, setAllSubmitted] = useState(false);
  const [allConfidencePoints, setAllConfidencePoints] = useState<ConfidencePointData[] | null>(null);
  const [hasSubmission, setHasSubmission] = useState(false);
  const [isCompleteSubmission, setIsCompleteSubmission] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [allParticipantsForDisplay, setAllParticipantsForDisplay] = useState<Participant[]>([]);

  useEffect(() => {
    loadData();
  }, [poolId]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      const poolResponse = await fetch(`/api/pools/${poolId}`);
      const poolData = await poolResponse.json();

      let seasonToUse = poolSeason;
      if (poolData.success) {
        setPoolName(poolData.pool.name);
        seasonToUse = poolData.pool.season;
        setPoolSeason(seasonToUse);
      }

      const users = await loadUsers(poolId);
      setParticipants(users || []);
      setAllParticipantsForDisplay(users || []);

      const teamsResponse = await fetch(`/api/playoffs/${poolId}/teams?season=${seasonToUse}`);
      const teamsData = await teamsResponse.json();

      if (teamsData.success) {
        const teams = teamsData.teams || [];
        setPlayoffTeams(teams);

        const conferences = ['AFC', 'NFC'];
        const sorted: PlayoffTeam[] = [];

        conferences.forEach(conference => {
          const conferenceTeams = teams.filter((t: PlayoffTeam) => (t.conference || '').toUpperCase() === conference);

          for (let seed = 1; seed <= 7; seed++) {
            const existingTeam = conferenceTeams.find((t: PlayoffTeam) => t.seed === seed);
            if (existingTeam) {
              sorted.push(existingTeam);
            } else {
              sorted.push({
                id: `placeholder-${conference}-${seed}`,
                pool_id: poolId,
                season: seasonToUse,
                team_name: '',
                team_abbreviation: null,
                conference: conference,
                seed: seed
              });
            }
          }
        });

        setSortedPlayoffTeams(sorted);
      }

      await loadSubmissionStatus();

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load playoff data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadSubmissionStatus = async () => {
    try {
      const response = await fetch(`/api/playoffs/${poolId}/confidence-points?season=${poolSeason || 2025}`);
      const data = await response.json();

      if (data.success) {
        debugLog('PLAYOFFS: loadSubmissionStatus', data);
        setSubmissionStatus(data.submissions || []);
        setAllSubmitted(data.allSubmitted || false);
        setAllConfidencePoints(data.allConfidencePoints || null);

        const submittedParticipantIds = new Set(
          (data.submissions || [])
            .filter((s: SubmissionStatus) => s.submitted)
            .map((s: SubmissionStatus) => s.participant_id)
        );

        const allUsers = await loadUsers(poolId);
        debugLog('PLAYOFFS: allUsers', allUsers);
        setAllParticipantsForDisplay(allUsers || []);
        const availableUsers = (allUsers || []).filter(
          user => !submittedParticipantIds.has(user.id)
        );
        setParticipants(availableUsers);
      }
    } catch (error) {
      console.error('Error loading submission status:', error);
    }
  };

  const handleParticipantChange = async (participantId: string) => {
    setSelectedParticipantId(participantId);
    setConfidencePoints({});

    if (!participantId) {
      setHasSubmission(false);
      setIsCompleteSubmission(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/playoffs/${poolId}/confidence-points?season=${poolSeason}&participantId=${participantId}`
      );
      const data = await response.json();

      if (data.success) {
        debugLog('PLAYOFFS: handleParticipantChange', data);
        setHasSubmission(data.hasSubmission || false);
        setIsCompleteSubmission(data.isCompleteSubmission || false);
        if (data.confidencePoints && data.confidencePoints.length > 0) {
          const pointsMap: Record<string, number> = {};
          data.confidencePoints.forEach((cp: ConfidencePointData) => {
            pointsMap[cp.team_name] = cp.confidence_points;
          });
          setConfidencePoints(pointsMap);
        }
      }
    } catch (error) {
      console.error('Error loading participant confidence points:', error);
    }
  };

  const handleConfidencePointChange = (teamName: string, value: string) => {
    if (value === 'CLEAR') {
      setConfidencePoints(prev => {
        const updated = { ...prev };
        delete updated[teamName];
        return updated;
      });
      return;
    }

    const numValue = parseInt(value);
    if (isNaN(numValue) || numValue < 1) {
      setConfidencePoints(prev => {
        const updated = { ...prev };
        delete updated[teamName];
        return updated;
      });
      return;
    }

    setConfidencePoints(prev => ({
      ...prev,
      [teamName]: numValue
    }));
  };

  const getAvailableConfidencePoints = (currentTeamName: string): number[] => {
    const actualTeams = sortedPlayoffTeams.filter(t => t.team_name && t.team_name.trim() !== '');
    const usedPoints = Object.entries(confidencePoints)
      .filter(([teamName]) => teamName !== currentTeamName && teamName.trim() !== '')
      .map(([, points]) => points);

    const maxPoints = actualTeams.length;
    return Array.from({ length: maxPoints }, (_, i) => i + 1)
      .filter(points => !usedPoints.includes(points));
  };

  const validateConfidencePoints = (): string | null => {
    const actualTeams = sortedPlayoffTeams.filter(t => t.team_name && t.team_name.trim() !== '');
    const values = Object.values(confidencePoints);
    const uniqueValues = new Set(values);

    if (values.length !== actualTeams.length) {
      return 'Please assign confidence points to all teams';
    }

    if (uniqueValues.size !== values.length) {
      return 'Confidence points must be unique';
    }

    const sortedValues = [...values].sort((a, b) => a - b);
    const expectedValues = Array.from({ length: actualTeams.length }, (_, i) => i + 1);

    if (JSON.stringify(sortedValues) !== JSON.stringify(expectedValues)) {
      return 'Confidence points must be sequential (1, 2, 3, etc.)';
    }

    return null;
  };

  const generateRandomConfidencePoints = () => {
    if (!selectedParticipantId) {
      toast({
        title: 'Error',
        description: 'Please select a participant first',
        variant: 'destructive',
      });
      return;
    }

    const actualTeams = sortedPlayoffTeams.filter(t => t.team_name && t.team_name.trim() !== '');
    const teamCount = actualTeams.length;

    const points = Array.from({ length: teamCount }, (_, i) => i + 1);
    for (let i = points.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [points[i], points[j]] = [points[j], points[i]];
    }

    const randomPoints: Record<string, number> = {};
    actualTeams.forEach((team, index) => {
      randomPoints[team.team_name] = points[index];
    });

    setConfidencePoints(randomPoints);
    toast({
      title: 'Random Points Generated',
      description: `Random confidence points assigned to all ${teamCount} teams`,
    });
  };

  const handleSubmit = async () => {
    if (!selectedParticipantId) {
      toast({
        title: 'Error',
        description: 'Please select a participant',
        variant: 'destructive',
      });
      return;
    }

    if (!debugMode) {
      const validationError = validateConfidencePoints();
      if (validationError) {
        toast({
          title: 'Validation Error',
          description: validationError,
          variant: 'destructive',
        });
        return;
      }
    }

    if (isCompleteSubmission && !debugMode) {
      toast({
        title: 'Error',
        description: 'You have already submitted all confidence points for playoffs. Complete submissions cannot be changed.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const actualTeams = sortedPlayoffTeams.filter(t => t.team_name && t.team_name.trim() !== '');
      const submissionData = actualTeams.map(team => ({
        participant_id: selectedParticipantId,
        team_name: team.team_name,
        confidence_points: confidencePoints[team.team_name]
      }));

      const response = await fetch(`/api/playoffs/${poolId}/confidence-points`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participant_id: selectedParticipantId,
          season: poolSeason,
          confidence_points: submissionData
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Playoff confidence points submitted successfully',
        });

        const submittedParticipantId = selectedParticipantId;
        setSelectedParticipantId('');
        setConfidencePoints({});
        setHasSubmission(false);
        setIsCompleteSubmission(false);

        await loadSubmissionStatus();

        router.push(`/pool/${poolId}/picks?week=1&seasonType=3`);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to submit confidence points',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error submitting confidence points:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit confidence points',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submissionPercentage = submissionStatus.length > 0
    ? Math.round((submissionStatus.filter(s => s.submitted).length / submissionStatus.length) * 100)
    : 0;

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>Loading playoff data…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'oklch(13% 0.025 255 / 0.95)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${border}`,
      }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={() => router.back()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.35rem 0.6rem',
                  background: 'transparent', color: textMid,
                  border: `1px solid ${border}`, borderRadius: 5,
                  ...bc, fontWeight: 600, fontSize: '0.72rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft style={{ width: 12, height: 12 }} /> Back
              </button>
              <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
                Sunday Huddle
              </span>
            </div>
            <button
              onClick={() => signOut()}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.35rem 0.7rem',
                background: 'transparent', color: textMid,
                border: `1px solid ${border}`, borderRadius: 5,
                ...bc, fontWeight: 600, fontSize: '0.72rem',
                letterSpacing: '0.07em', textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              <LogOut style={{ width: 11, height: 11 }} /> Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        background: bg,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`,
        padding: 'clamp(2rem, 4vw, 3rem) 0',
      }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
            Postseason
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            {poolName} — Playoff <span style={{ color: gold }}>Confidence Points</span>
          </h1>
          <p style={{ ...b, fontSize: '0.9rem', color: textMid, marginTop: '0.75rem' }}>
            Season {poolSeason}
          </p>
        </div>
      </section>

      {/* ── green rule ── */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── CONTENT ── */}
      <section style={{ background: bg, padding: '2.5rem 0', minHeight: '50vh' }}>
        <div className="lp-inner" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Navigation button */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            <button
              onClick={async () => {
                try {
                  const upcomingWeek = await getUpcomingWeek();
                  router.push(`/pool/${poolId}/picks?week=${upcomingWeek.week}&seasonType=${upcomingWeek.seasonType}`);
                } catch (error) {
                  console.error('Error getting current week:', error);
                  router.push(`/pool/${poolId}/picks?week=1&seasonType=2`);
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 0.9rem',
                background: 'transparent', color: textMid,
                border: `1px solid ${border}`, borderRadius: 6,
                ...bc, fontWeight: 700, fontSize: '0.75rem',
                letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              <Calendar style={{ width: 13, height: 13 }} />
              Go to Current Week
            </button>
          </div>

          {/* Submission Status */}
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <Users style={{ width: 16, height: 16, color: greenHi }} />
              <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
                Submission Status
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <p style={{ ...bc, fontWeight: 900, fontSize: '2.25rem', color: greenHi, lineHeight: 1, flexShrink: 0 }}>{submissionPercentage}%</p>
              <div style={{ flex: 1 }}>
                <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '0.4rem' }}>
                  {submissionStatus.filter(s => s.submitted).length} of {submissionStatus.length} participants submitted
                </p>
                <div style={{ width: '100%', background: surface, borderRadius: 999, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${submissionPercentage}%`, background: green, height: '100%', borderRadius: 999, transition: 'width 0.3s ease' }} />
                </div>
              </div>
            </div>
          </div>

          {/* All Submissions View */}
          {allSubmitted && allConfidencePoints && (
            <div style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${gold}`, borderRadius: 10, padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <Trophy style={{ width: 16, height: 16, color: gold }} />
                <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.08em', color: gold, textTransform: 'uppercase' }}>
                  All Playoff Confidence Points
                </p>
              </div>
              <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1.25rem' }}>
                Everyone has submitted their confidence points
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {(() => {
                  const participantMap = new Map<string, { id: string; name: string }>();

                  submissionStatus.forEach(status => {
                    if (!participantMap.has(status.participant_id)) {
                      participantMap.set(status.participant_id, {
                        id: status.participant_id,
                        name: status.participant_name
                      });
                    }
                  });

                  allConfidencePoints.forEach(cp => {
                    if (!participantMap.has(cp.participant_id)) {
                      const participantName = (cp.participants as any)?.name || 'Unknown';
                      participantMap.set(cp.participant_id, {
                        id: cp.participant_id,
                        name: participantName
                      });
                    }
                  });

                  if (participantMap.size === 0 && allParticipantsForDisplay.length > 0) {
                    allParticipantsForDisplay.forEach(p => {
                      participantMap.set(p.id, p);
                    });
                  }

                  const participantsList = Array.from(participantMap.values());
                  const afcTeams = sortedPlayoffTeams.filter(
                    team => team.team_name && team.team_name.trim() !== '' && team.conference?.toUpperCase() === 'AFC'
                  );
                  const nfcTeams = sortedPlayoffTeams.filter(
                    team => team.team_name && team.team_name.trim() !== '' && team.conference?.toUpperCase() === 'NFC'
                  );

                  const confTableStyle = {
                    width: '100%',
                    borderCollapse: 'collapse' as const,
                    fontSize: '0.82rem',
                  };

                  const renderConferenceTable = (confTeams: PlayoffTeam[], confLabel: string, confColor: string) => (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.5rem', borderBottom: `2px solid ${confColor}`, marginBottom: '0.75rem' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: confColor, flexShrink: 0 }} />
                        <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: confColor, letterSpacing: '0.05em' }}>{confLabel}</p>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={confTableStyle}>
                          <thead>
                            <tr style={{ background: surface, borderBottom: `1px solid ${border}` }}>
                              <th style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.06em', color: textMid, textTransform: 'uppercase', textAlign: 'left', padding: '0.5rem 0.75rem', position: 'sticky', left: 0, background: surface, zIndex: 10, minWidth: 120, borderRight: `1px solid ${border}` }}>
                                Participant
                              </th>
                              {confTeams.map(team => (
                                <th key={team.id} style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.06em', color: textMid, textTransform: 'uppercase', textAlign: 'center', padding: '0.5rem 0.5rem', minWidth: 90 }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                    <span>{getTeamAbbreviation(team.team_name)}</span>
                                    {team.seed && (
                                      <span style={{ ...bc, fontWeight: 700, fontSize: '0.58rem', padding: '0.1rem 0.35rem', borderRadius: 3, background: 'oklch(26% 0.03 255)', color: textDim, border: `1px solid ${border}` }}>
                                        {confLabel} #{team.seed}
                                      </span>
                                    )}
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {participantsList.map((participant, index) => {
                              const participantPoints = allConfidencePoints.filter(
                                cp => cp.participant_id === participant.id
                              );
                              const pointsMap: Record<string, number> = {};
                              participantPoints.forEach(cp => {
                                pointsMap[cp.team_name] = cp.confidence_points;
                              });

                              const rowBg = index % 2 === 0 ? card : surface;
                              return (
                                <tr key={participant.id} style={{ borderBottom: `1px solid ${border}`, background: rowBg }}>
                                  <td style={{ ...b, fontWeight: 600, fontSize: '0.8rem', color: text, padding: '0.5rem 0.75rem', position: 'sticky', left: 0, background: rowBg, zIndex: 5, borderRight: `1px solid ${border}`, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {participant.name}
                                  </td>
                                  {confTeams.map(team => {
                                    const points = pointsMap[team.team_name];
                                    return (
                                      <td key={team.id} style={{ textAlign: 'center', padding: '0.5rem' }}>
                                        <span style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', color: points ? greenHi : textDim }}>
                                          {points || '-'}
                                        </span>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );

                  const afcAccentColor = 'oklch(55% 0.18 25)';
                  const nfcAccentColor = 'oklch(55% 0.16 240)';

                  return (
                    <>
                      {renderConferenceTable(afcTeams, 'AFC', afcAccentColor)}
                      {renderConferenceTable(nfcTeams, 'NFC', nfcAccentColor)}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Submission Form */}
          {!allSubmitted && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
              <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Submit Playoff Confidence Points
              </p>
              <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1.25rem' }}>
                Assign confidence points (1–{sortedPlayoffTeams.filter(t => t.team_name && t.team_name.trim() !== '').length}) to each playoff team. Points cannot be changed after submission. Each number can only be used once.
              </p>

              {/* Participant Selection */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                  Select Participant
                </label>
                <select
                  id="participant"
                  value={selectedParticipantId}
                  onChange={(e) => handleParticipantChange(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, color: text, ...b, fontSize: '0.875rem', appearance: 'none', cursor: 'pointer' }}
                >
                  <option value="">Select a participant…</option>
                  {participants.map(participant => (
                    <option key={participant.id} value={participant.id}>
                      {participant.name}
                    </option>
                  ))}
                </select>
                {hasSubmission && selectedParticipantId && (
                  <p style={{ ...b, fontSize: '0.78rem', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: isCompleteSubmission ? greenHi : amber }}>
                    <CheckCircle2 style={{ width: 13, height: 13 }} />
                    {isCompleteSubmission
                      ? `${participants.find(p => p.id === selectedParticipantId)?.name || 'This participant'} has already submitted all confidence points`
                      : `${participants.find(p => p.id === selectedParticipantId)?.name || 'This participant'} has a partial submission. You can complete or update it.`
                    }
                  </p>
                )}
              </div>

              {/* Confidence Points Input */}
              {selectedParticipantId && !isCompleteSubmission && sortedPlayoffTeams.length > 0 && (
                <>
                  <div className="admin-2col-grid" style={{ marginBottom: '1.25rem' }}>
                    {/* AFC Conference */}
                    <div>
                      <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: 'oklch(55% 0.18 25)', letterSpacing: '0.05em', marginBottom: '0.85rem', paddingBottom: '0.5rem', borderBottom: `2px solid oklch(55% 0.18 25)` }}>
                        AFC
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                        {sortedPlayoffTeams
                          .filter(team => team.conference?.toUpperCase() === 'AFC')
                          .map(team => {
                            const isPlaceholder = !team.team_name || team.team_name.trim() === '';
                            const availablePoints = isPlaceholder ? [] : getAvailableConfidencePoints(team.team_name);
                            const currentValue = confidencePoints[team.team_name];

                            return (
                              <div key={team.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0', borderBottom: `1px solid ${border}` }}>
                                <div style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', color: textDim, width: 24, textAlign: 'center', flexShrink: 0 }}>
                                  {team.seed || '-'}
                                </div>
                                <div style={{ flex: 1, ...b, fontSize: '0.875rem', color: isPlaceholder ? textDim : text, fontStyle: isPlaceholder ? 'italic' : 'normal' }}>
                                  {isPlaceholder ? "Seed hasn't been determined yet" : team.team_name}
                                </div>
                                <div style={{ width: 110, flexShrink: 0 }}>
                                  {isPlaceholder ? (
                                    <p style={{ ...b, fontSize: '0.78rem', color: textDim, fontStyle: 'italic' }}>N/A</p>
                                  ) : (
                                    <Select
                                      value={currentValue?.toString() || ''}
                                      onValueChange={(value) => handleConfidencePointChange(team.team_name, value)}
                                    >
                                      <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text, ...b, fontSize: '0.8rem', height: 32 }}>
                                        <SelectValue placeholder="Points" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {currentValue && (
                                          <SelectItem value="CLEAR" style={{ color: 'oklch(60% 0.18 25)' }}>
                                            Clear
                                          </SelectItem>
                                        )}
                                        {availablePoints.length > 0 ? (
                                          availablePoints.map(points => (
                                            <SelectItem key={points} value={points.toString()}>
                                              {points} point{points !== 1 ? 's' : ''}
                                            </SelectItem>
                                          ))
                                        ) : (
                                          <SelectItem value="NONE" disabled>
                                            No points available
                                          </SelectItem>
                                        )}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* NFC Conference */}
                    <div>
                      <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: 'oklch(55% 0.16 240)', letterSpacing: '0.05em', marginBottom: '0.85rem', paddingBottom: '0.5rem', borderBottom: `2px solid oklch(55% 0.16 240)` }}>
                        NFC
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                        {sortedPlayoffTeams
                          .filter(team => team.conference?.toUpperCase() === 'NFC')
                          .map(team => {
                            const isPlaceholder = !team.team_name || team.team_name.trim() === '';
                            const availablePoints = isPlaceholder ? [] : getAvailableConfidencePoints(team.team_name);
                            const currentValue = confidencePoints[team.team_name];

                            return (
                              <div key={team.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0', borderBottom: `1px solid ${border}` }}>
                                <div style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', color: textDim, width: 24, textAlign: 'center', flexShrink: 0 }}>
                                  {team.seed || '-'}
                                </div>
                                <div style={{ flex: 1, ...b, fontSize: '0.875rem', color: isPlaceholder ? textDim : text, fontStyle: isPlaceholder ? 'italic' : 'normal' }}>
                                  {isPlaceholder ? "Seed hasn't been determined yet" : team.team_name}
                                </div>
                                <div style={{ width: 110, flexShrink: 0 }}>
                                  {isPlaceholder ? (
                                    <p style={{ ...b, fontSize: '0.78rem', color: textDim, fontStyle: 'italic' }}>N/A</p>
                                  ) : (
                                    <Select
                                      value={currentValue?.toString() || ''}
                                      onValueChange={(value) => handleConfidencePointChange(team.team_name, value)}
                                    >
                                      <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text, ...b, fontSize: '0.8rem', height: 32 }}>
                                        <SelectValue placeholder="Points" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {currentValue && (
                                          <SelectItem value="CLEAR" style={{ color: 'oklch(60% 0.18 25)' }}>
                                            Clear
                                          </SelectItem>
                                        )}
                                        {availablePoints.length > 0 ? (
                                          availablePoints.map(points => (
                                            <SelectItem key={points} value={points.toString()}>
                                              {points} point{points !== 1 ? 's' : ''}
                                            </SelectItem>
                                          ))
                                        ) : (
                                          <SelectItem value="NONE" disabled>
                                            No points available
                                          </SelectItem>
                                        )}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>

                  {/* Debug Mode — dev only */}
                  {process.env.NODE_ENV === 'development' && (
                    <div style={{ marginTop: '1rem', padding: '0.85rem 1rem', background: 'oklch(20% 0.04 72 / 0.3)', border: `1px solid oklch(72% 0.16 60 / 0.25)`, borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <Checkbox
                          id="debug-mode"
                          checked={debugMode}
                          onCheckedChange={(checked) => setDebugMode(checked === true)}
                        />
                        <Label
                          htmlFor="debug-mode"
                          style={{ ...b, fontSize: '0.8rem', color: amber, cursor: 'pointer' }}
                        >
                          Debug Mode: Submit to DB and navigate to playoff picks page
                        </Label>
                      </div>
                      <button
                        onClick={generateRandomConfidencePoints}
                        style={{
                          width: '100%', padding: '0.5rem',
                          background: 'oklch(65% 0.12 290 / 0.15)',
                          border: `1px solid oklch(65% 0.12 290 / 0.35)`,
                          borderRadius: 6, color: 'oklch(65% 0.12 290)',
                          ...bc, fontWeight: 700, fontSize: '0.75rem',
                          letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
                        }}
                      >
                        Generate Random Confidence Points
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    style={{
                      width: '100%', marginTop: '1.25rem', padding: '0.7rem',
                      background: isSubmitting ? textDim : green, color: text,
                      border: 'none', borderRadius: 6,
                      ...bc, fontWeight: 800, fontSize: '0.82rem',
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isSubmitting ? 'Submitting…' : 'Submit Confidence Points'}
                  </button>
                </>
              )}

              {selectedParticipantId && isCompleteSubmission && (
                <div style={{ padding: '1rem', background: 'oklch(46% 0.14 155 / 0.12)', border: `1px solid oklch(46% 0.14 155 / 0.3)`, borderRadius: 8 }}>
                  <p style={{ ...b, fontSize: '0.875rem', color: greenHi }}>
                    You have already submitted your playoff confidence points. They cannot be changed after submission.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </section>
    </div>
  );
}

export default function PlayoffsPage() {
  return (
    <AuthProvider>
      <PlayoffsPageContent />
    </AuthProvider>
  );
}
