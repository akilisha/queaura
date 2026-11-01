/**
 * Wire protocol between the game server (server/.../protocol/Codec.kt) and its clients: the web
 * client (player and TV) and the host app. Types only; import with `import type`.
 * Keep in step with Codec.kt.
 */

export type Style = 'closestWithoutGoingOver' | 'multipleChoice' | 'fastestFinger' | 'questionnaire';
export type Scoring = 'none' | 'allOrNothing' | 'timeWeighted';
export type AnswerType = 'numeric' | 'multipleChoice' | 'freeText';

/** Auto: timed rounds. Manual: a questionnaire, each player at their own pace (spec §6.4). */
export type Progression = 'auto' | 'manual';

export type Phase =
  | 'lobby'
  | 'gameStarting'
  | 'roundIntro'
  | 'question'
  | 'timesUp'
  | 'reveal'
  | 'roundScores'
  | 'roundBreak'
  | 'questionnaire'
  | 'finalScores'
  | 'ended';

/** Game events sound can attach to later (spec §10). */
export type CueName = 'questionShown' | 'countdownStarted' | 'lastSeconds' | 'reveal' | 'roundEnd';

// --- A game as the host app sends it to start (spec §4) --------------------------------------

export interface Choice {
  id: string;
  text: string;
}

export interface GameQuestion {
  id: string;
  text: string;
  answerType: AnswerType;
  correctNumber?: number;
  correctChoiceId?: string;
  choices?: Choice[];
  explanation?: string;
}

export interface Durations {
  readingMs?: number;
  answerMs?: number;
  revealMs?: number;
  breakMs?: number;
}

export interface GameRound {
  style: Style;
  questions: GameQuestion[];
  durations?: Durations;
}

export interface GameDefinition {
  id: string;
  title: string;
  scoring: Scoring;
  closeEarly?: boolean;
  progression?: Progression;
  rounds: GameRound[];
}

// --- State -------------------------------------------------------------------------------------

export type AnswerValue = { number: number } | { choice: string } | { text: string };

export interface ScoreEntry {
  id: number;
  name: string;
  emoji: string;
  total: number;
  roundPoints: number;
  /** Points from the most recent question; null before any. */
  lastPoints: number | null;
  online: boolean;
  awake: boolean;
}

export interface Result {
  answered: boolean;
  correct: boolean;
  bust: boolean;
  exact: boolean;
  points: number;
  value: AnswerValue | null;
}

export interface QuestionView {
  /** Increments with every question; answers must echo it. */
  seq: number;
  number: number;
  text: string;
  answerType: AnswerType;
  choices: Choice[];
  readingMs: number;
  answerMs: number;
}

export interface Reveal {
  voided: boolean;
  correctNumber: number | null;
  correctChoiceId: string | null;
  explanation: string | null;
  choiceCounts: Record<string, number>;
  /** Reveal order: closest guesses (valid nearest first, then busts), or fastest finger (correct in arrival order, then the rest). */
  ranking: (Result & { playerId: number })[];
}

/** One questionnaire question as a player sees it. */
export interface QuestionnaireQuestion {
  index: number;
  text: string;
  answerType: AnswerType;
  choices: Choice[];
}

export interface You extends ScoreEntry {
  canAnswer: boolean;
  /** Joined mid-question: may answer from the next one (spec §6.2). */
  waitingForNextQuestion: boolean;
  answer?: AnswerValue;
  result?: Result;
  /** Questionnaire: where this player is; no question once they're done. */
  questionnaire?: { position: number; question?: QuestionnaireQuestion; answer?: AnswerValue };
}

export interface HostView {
  correctNumber?: number | null;
  correctChoiceId?: string | null;
  explanation?: string | null;
  answeredIds: number[];
  /** Questionnaire: each player's position, by player id. */
  progress?: Record<string, number>;
}

export interface GameState {
  t: 'state';
  phase: Phase;
  paused: boolean;
  /** Time left in the current phase when the server sent this; null for untimed phases. */
  remainingMs: number | null;
  durationMs: number | null;
  /** The host stopped the game early. */
  stopped: boolean;
  /** Sorted by total, highest first. */
  scores: ScoreEntry[];
  title?: string;
  scoring?: Scoring;
  round?: { number: number; count: number; style: Style; questionCount: number };
  question?: QuestionView;
  answeredCount?: number;
  eligibleCount?: number;
  reveal?: Reveal;
  progression?: Progression;
  questionnaire?: { count: number; finished: number };
  you?: You;
  host?: HostView;
}

// --- Messages ----------------------------------------------------------------------------------

export type ServerMessage =
  | { t: 'welcome'; role: 'player'; token: string; resumed: boolean; playerId: number }
  | { t: 'welcome'; role: 'tv' | 'host' }
  | { t: 'needJoin' }
  | { t: 'kicked' }
  | { t: 'ended' }
  | { t: 'error'; message: string }
  | { t: 'cue'; name: CueName }
  | { t: 'pong'; c: number }
  | GameState;

export type HostCommand =
  | { cmd: 'start'; game: GameDefinition }
  | { cmd: 'pause' | 'resume' | 'skip' | 'stop' | 'playAnother' | 'endSession' }
  | { cmd: 'kick'; playerId: number };

export type ClientMessage =
  | { t: 'hello'; role: 'player' | 'tv' | 'host'; token?: string | null; hostKey?: string; hidden: boolean }
  | { t: 'join'; name: string; emoji: string }
  | ({ t: 'answer'; seq: number } & AnswerValue)
  | ({ t: 'qAnswer'; index: number } & AnswerValue)
  | { t: 'qGo'; index: number }
  | { t: 'visibility'; hidden: boolean }
  | { t: 'ping'; c: number }
  | ({ t: 'host' } & HostCommand);

/** Close codes the server uses (GameServer.kt): 4000 seat taken by a newer tab, 4001 kicked,
 * 4003 wrong host key. */
export type CloseCode = 4000 | 4001 | 4003;
