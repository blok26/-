export type GamePhase = 'lobby' | 'countdown' | 'drawing' | 'roundResult' | 'gameOver';

export type GameDifficulty = 'easy' | 'medium' | 'mixed';

export interface RoomSettings {
  roundsCount: 4 | 8 | 12;
  roundDurationSec: 45 | 60 | 90;
  difficulty: GameDifficulty;
}

export interface PlayerProfile {
  uid: string;
  name: string;
  avatarColor: string;
  isHost: boolean;
  ready: boolean;
  micEnabled: boolean;
  joinedAt: number;
}

export interface PresenceState {
  online: boolean;
  lastSeen: number;
}

export interface GameState {
  status: GamePhase;
  currentRound: number;
  totalRounds: number;
  drawerUid: string;
  guesserUid: string;
  roundStartedAt: number;
  roundDurationSec: number;
  score: number;
  correctRounds: number;
  secretCategory: string;
  secretLength: number;
  wordCount?: number;
  initialMask?: string;
  revealedMask?: string;
  revealedChar?: string;
  hintRevealed?: boolean;
  roundSecretWord?: string; // Revealed ONLY when round ends
  drawerGuessedCorrectly?: boolean;
  clearVersion: number;
  roundEndedAt?: number;
}

export interface StrokePoint {
  x: number; // 0.0 to 1.0 (normalized)
  y: number; // 0.0 to 1.0 (normalized)
}

export interface StrokeChunk {
  chunkId: string;
  points: StrokePoint[];
}

export interface StrokeMeta {
  strokeId: string;
  color: string;
  size: number;
  isEraser: boolean;
  createdAt: number;
  drawerUid: string;
  deleted?: boolean;
}

export interface FullStroke {
  meta: StrokeMeta;
  points: StrokePoint[];
}

export interface GuessMessage {
  id: string;
  uid: string;
  playerName: string;
  text: string;
  isCorrect: boolean;
  createdAt: number;
}

export type WebRTCCallStatus =
  | 'idle'
  | 'requesting_permissions'
  | 'connecting'
  | 'connected'
  | 'muted'
  | 'disconnected'
  | 'failed'
  | 'unsupported';

export interface GameResults {
  totalScore: number;
  correctCount: number;
  roundsCount: number;
  averageGuessTimeSec: number;
  bestRoundTimeSec: number;
  titleBadge: string;
}
