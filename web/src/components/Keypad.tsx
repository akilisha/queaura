import { display, parse, press, type Key } from '../lib/keypad';
import styles from './Keypad.module.css';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: number) => void;
  disabled?: boolean;
  /** The submit button's words; "Lock in" in a timed round. */
  submitLabel?: string;
}

const KEYS: Key[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'sign', '0', '.'];
const LABELS: Partial<Record<Key, string>> = { sign: '±', '.': '.' };

/** Numeric entry for closest-without-going-over (spec §6.3). No free text in timed modes. */
export function Keypad({ value, onChange, onSubmit, disabled, submitLabel = 'Lock in' }: Props) {
  const number = parse(value);
  return (
    <div class={styles.keypad}>
      <div class={styles.display} aria-live="polite">
        <span class={value ? styles.entry : styles.placeholder}>{value ? display(value) : 'Your guess'}</span>
        <button
          type="button"
          class={styles.back}
          onClick={() => onChange(press(value, 'back'))}
          disabled={disabled || !value}
          aria-label="Delete last digit"
        >
          ⌫
        </button>
      </div>
      <div class={styles.keys}>
        {KEYS.map((key) => (
          <button key={key} type="button" class={styles.key} disabled={disabled} onClick={() => onChange(press(value, key))}>
            {LABELS[key] ?? key}
          </button>
        ))}
      </div>
      <button
        type="button"
        class={styles.submit}
        disabled={disabled || number === null}
        onClick={() => number !== null && onSubmit(number)}
      >
        {submitLabel}
      </button>
    </div>
  );
}

