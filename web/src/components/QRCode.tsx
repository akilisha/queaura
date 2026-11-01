import { useMemo } from 'preact/hooks';
import { encode } from 'uqr';
import styles from './QRCode.module.css';

/** Modules of white margin around the code; scanners need at least 4. */
const QUIET_ZONE = 4;

/** A scannable QR code drawn as one SVG path from uqr's module matrix. */
export function QRCode({ text, label, scale = 'normal' }: { text: string; label: string; scale?: 'normal' | 'small' }) {
  const { size, path } = useMemo(() => {
    const qr = encode(text, { ecc: 'M', border: QUIET_ZONE });
    let d = '';
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return { size: qr.size, path: d };
  }, [text]);

  return (
    <svg class={`${styles.qr} ${scale === 'small' ? styles.small : ''}`} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shape-rendering="crispEdges">
      <rect class={styles.light} width={size} height={size} />
      <path class={styles.dark} d={path} />
    </svg>
  );
}
