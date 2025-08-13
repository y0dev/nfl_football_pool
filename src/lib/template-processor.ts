export interface TemplateVariables {
  participantName?: string;
  poolName: string;
  poolUrl: string;
  currentWeek: number;
  season: number;
  adminName: string;
  deadline?: string;
  gameCount?: number;
  timeRemaining?: string;
  pointsEarned?: number;
  correctPicks?: number;
  totalPicks?: number;
  currentRank?: number;
  topPerformers?: string;
  overallStandings?: string;
  nextWeek?: number;
  updateMessage?: string;
  currentStandings?: string;
  finalResults?: string;
  seasonHighlights?: string;
  customSubject?: string;
  customMessage?: string;
}

export function processTemplate(template: string, variables: TemplateVariables): string {
  let processed = template;
  
  // Replace all variables in the template
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    if (value !== undefined && value !== null) {
      processed = processed.replace(new RegExp(placeholder, 'g'), String(value));
    }
  });
  
  return processed;
}

export function generatePoolUrl(poolId: string, week?: number): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  if (week) {
    return `${baseUrl}/participant?pool=${poolId}&week=${week}`;
  }
  return `${baseUrl}/participant?pool=${poolId}`;
}

export function getDefaultVariables(poolName: string, poolId: string, currentWeek: number, adminName: string): TemplateVariables {
  return {
    poolName,
    poolUrl: generatePoolUrl(poolId, currentWeek),
    currentWeek,
    season: 2024, // This could be made dynamic
    adminName,
    deadline: 'Sunday 1:00 PM ET', // This could be made dynamic
    gameCount: 16, // This could be made dynamic
    timeRemaining: '2 hours', // This could be made dynamic
    pointsEarned: 0, // This would be calculated
    correctPicks: 0, // This would be calculated
    totalPicks: 16, // This would be calculated
    currentRank: 0, // This would be calculated
    topPerformers: 'To be determined', // This would be calculated
    overallStandings: 'To be determined', // This would be calculated
    nextWeek: currentWeek + 1,
    updateMessage: 'Please check the pool for updates.',
    currentStandings: 'To be determined', // This would be calculated
    finalResults: 'To be determined', // This would be calculated
    seasonHighlights: 'To be determined', // This would be calculated
    customSubject: 'Message from Pool Administrator',
    customMessage: 'This is a custom message from the pool administrator.'
  };
}
