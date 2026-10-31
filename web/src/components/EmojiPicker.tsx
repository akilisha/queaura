import styles from './EmojiPicker.module.css';

interface Props {
  options: string[];
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ options, value, onChange }: Props) {
  return (
    <div class={styles.grid} role="radiogroup" aria-label="Pick an emoji">
      {options.map((emoji) => (
        <button
          key={emoji}
          type="button"
          role="radio"
          aria-checked={emoji === value}
          class={`${styles.cell} ${emoji === value ? styles.selected : ''}`}
          onClick={() => onChange(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
