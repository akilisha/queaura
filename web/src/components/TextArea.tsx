import styles from './TextArea.module.css';

interface Props {
  label: string;
  value: string;
  onInput: (value: string) => void;
  maxLength: number;
}

/** Free-text answers (questionnaires only; spec §6.3: no free text in timed modes). */
export function TextArea({ label, value, onInput, maxLength }: Props) {
  return (
    <label class={styles.field}>
      <span class={styles.label}>{label}</span>
      <textarea
        class={styles.input}
        value={value}
        maxLength={maxLength}
        rows={4}
        onInput={(e) => onInput(e.currentTarget.value)}
      />
      <span class={styles.count} aria-live="polite">
        {value.length} / {maxLength}
      </span>
    </label>
  );
}
