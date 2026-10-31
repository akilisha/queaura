import styles from './TextField.module.css';

interface Props {
  label: string;
  value: string;
  onInput: (value: string) => void;
  maxLength?: number;
  autoFocus?: boolean;
}

export function TextField({ label, value, onInput, maxLength, autoFocus }: Props) {
  return (
    <label class={styles.field}>
      <span class={styles.label}>{label}</span>
      <input
        class={styles.input}
        value={value}
        maxLength={maxLength}
        autoFocus={autoFocus}
        autoComplete="nickname"
        enterKeyHint="go"
        onInput={(e) => onInput(e.currentTarget.value)}
      />
    </label>
  );
}
