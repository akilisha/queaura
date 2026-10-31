import type { ComponentChildren } from 'preact';
import styles from './Button.module.css';

interface Props {
  children: ComponentChildren;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  size?: 'normal' | 'huge';
  type?: 'button' | 'submit';
  disabled?: boolean;
}

export function Button({ children, onClick, variant = 'primary', size = 'normal', type = 'button', disabled }: Props) {
  return (
    <button
      type={type}
      class={`${styles.button} ${styles[variant]} ${styles[size]}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
