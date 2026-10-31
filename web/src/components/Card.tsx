import type { ComponentChildren } from 'preact';
import styles from './Card.module.css';

interface Props {
  title?: string;
  children: ComponentChildren;
  /** Take the remaining height of a fitted layout and clip, instead of growing the page. */
  fill?: boolean;
}

export function Card({ title, children, fill }: Props) {
  return (
    <section class={`${styles.card} ${fill ? styles.fill : ''}`}>
      {title && <h2 class={styles.title}>{title}</h2>}
      {children}
    </section>
  );
}
