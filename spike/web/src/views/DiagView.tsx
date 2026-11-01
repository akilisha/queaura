import { Card } from '../components/Card';
import { KeyValueList, type Row } from '../components/KeyValueList';
import { Screen } from '../components/Screen';
import { connection } from '../state/store';

const yesNo = (value: boolean) => (value ? 'yes' : 'no');

/** Records the browser engine (for the Vite legacy target) and which features work over plain HTTP. */
function detect(): Row[] {
  const nav = navigator as Navigator & { wakeLock?: unknown; userAgentData?: { brands?: { brand: string; version: string }[] } };
  const chrome = /Chrome\/([\d.]+)/.exec(navigator.userAgent)?.[1] ?? '–';
  const brands = nav.userAgentData?.brands?.map((b) => `${b.brand} ${b.version}`).join(', ') ?? '–';
  let storage = false;
  try {
    localStorage.setItem('queaura.diag', '1');
    localStorage.removeItem('queaura.diag');
    storage = true;
  } catch {
    storage = false;
  }
  return [
    ['User agent', navigator.userAgent],
    ['Chromium version', chrome],
    ['UA brands', brands],
    ['Viewport', `${window.innerWidth} × ${window.innerHeight} @${window.devicePixelRatio}x`],
    ['Secure context', yesNo(window.isSecureContext)],
    ['WebSocket', yesNo('WebSocket' in window)],
    ['localStorage', yesNo(storage)],
    ['Wake Lock API', yesNo('wakeLock' in nav)],
    ['crypto.randomUUID', yesNo(typeof crypto !== 'undefined' && 'randomUUID' in crypto)],
    ['Clipboard API', yesNo('clipboard' in navigator)],
    ['Service worker', yesNo('serviceWorker' in navigator)],
    ['Vibration', yesNo('vibrate' in navigator)],
    ['Fullscreen API', yesNo('requestFullscreen' in document.documentElement)],
    ['CSS custom properties', yesNo(typeof CSS !== 'undefined' && CSS.supports('--x', '0'))],
    ['CSS grid', yesNo(typeof CSS !== 'undefined' && CSS.supports('display', 'grid'))],
  ];
}

export function DiagView() {
  return (
    <Screen title="Browser diagnostics" status={connection.value}>
      <Card title="Record these in RESULTS.md">
        <KeyValueList rows={detect()} />
      </Card>
    </Screen>
  );
}
