import styles from './PhaseHeader.module.css';

interface Props {
  round: number;
  roundCount: number;
  question?: number;
  questionCount?: number;
}

export function PhaseHeader({ round, roundCount, question, questionCount }: Props) {
  return (
    <p class={styles.header}>
      <span>Round {round} of {roundCount}</span>
      {question !== undefined && <span>Question {question} of {questionCount}</span>}
    </p>
  );
}
