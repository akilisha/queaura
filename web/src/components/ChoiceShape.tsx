/** ▲ ◆ ● ■: every choice has a shape as well as a color, for color-blind players (spec §2.3). */
export function ChoiceShape({ index, class: className }: { index: number; class?: string }) {
  const shape = [
    <path d="M8 2 L15 14 L1 14 Z" />,
    <path d="M8 1 L15 8 L8 15 L1 8 Z" />,
    <circle cx="8" cy="8" r="7" />,
    <rect x="2" y="2" width="12" height="12" />,
  ][index % 4];
  return (
    <svg class={className} viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      {shape}
    </svg>
  );
}
