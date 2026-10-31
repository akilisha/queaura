/** Number entry for the closest-guess keypad. Entries are strings until submitted. */

export type Key = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'sign' | 'back';

const MAX_DIGITS = 12;

export function press(entry: string, key: Key): string {
  if (key === 'back') return entry.slice(0, -1) === '-' ? '' : entry.slice(0, -1);
  if (key === 'sign') return entry.startsWith('-') ? entry.slice(1) : `-${entry}`;
  if (key === '.') {
    if (entry.includes('.')) return entry;
    return entry === '' || entry === '-' ? `${entry}0.` : `${entry}.`;
  }
  if (entry.replace(/[-.]/g, '').length >= MAX_DIGITS) return entry;
  // No leading zeros: "0" followed by a digit becomes that digit.
  if (entry === '0') return key;
  if (entry === '-0') return `-${key}`;
  return entry + key;
}

/** An entry as typed, with thousands grouped and a real minus sign; keeps a trailing ".". */
export function display(entry: string): string {
  const negative = entry.startsWith('-');
  const [whole, decimals] = entry.replace('-', '').split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '−' : ''}${grouped}${decimals !== undefined ? `.${decimals}` : ''}`;
}

/** The number an entry stands for, or null if it is not a complete number yet. */
export function parse(entry: string): number | null {
  if (!/^-?\d+(\.\d+)?$/.test(entry)) return null;
  const n = Number(entry);
  return Number.isFinite(n) ? n : null;
}
