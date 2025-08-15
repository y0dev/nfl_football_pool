export interface TemplateVariables {
  participantName?: string;
  poolName: string;
  poolUrl: string;
  currentWeek: number;
  season: number;
  adminName: string;
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
    customSubject: 'Message from Pool Administrator',
    customMessage: 'This is a custom message from the pool administrator.'
  };
}
