// Import-related types for Excel/CSV file processing

export interface ImportedPick {
  participantName: string;
  participantEmail?: string;
  gamePicks: Array<{
    gameId: string;
    awayTeam: string;
    homeTeam: string;
    predictedWinner: string;
    confidencePoints: number;
  }>;
  tieBreaker?: number;
}

export interface ImportedGamePick {
  gameId: string;
  awayTeam: string;
  homeTeam: string;
  predictedWinner: string;
  confidencePoints: number;
}

export interface ImportResult {
  success: boolean;
  data?: ImportedPick[];
  error?: string;
  importedCount?: number;
}

export interface FileUploadResult {
  success: boolean;
  data?: ImportedPick[];
  error?: string;
  fileName?: string;
  participantCount?: number;
}

export interface ImportValidationError {
  row: number;
  field: string;
  message: string;
  value?: any;
}

export interface ImportValidationResult {
  isValid: boolean;
  errors: ImportValidationError[];
  warnings: ImportValidationError[];
}

