import type { AnswerType, Choice, Durations, Progression, Scoring, Style } from '../../../protocol/src';

/** A question in the bank on this device (spec §4). */
export interface BankQuestion {
  id: string;
  text: string;
  answerType: AnswerType;
  correctNumber?: number;
  correctChoiceId?: string;
  choices?: Choice[];
  explanation?: string;
  source: 'manual' | 'ai';
  /** Shipped with the app (the starter bank). */
  builtIn?: boolean;
}

export interface RoundFormat {
  style: Style;
  /** Question ids; null is an empty slot. */
  slots: (string | null)[];
  durations?: Durations;
}

/** A game format: rounds with slots that questions plug into (spec §4). */
export interface GameFormat {
  id: string;
  title: string;
  scoring: Scoring;
  closeEarly?: boolean;
  /** manual = a questionnaire: one round, no clock, no points (spec §6.4). Missing means auto. */
  progression?: Progression;
  rounds: RoundFormat[];
  builtIn?: boolean;
}
