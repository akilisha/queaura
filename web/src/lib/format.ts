/** Formats a number for display: thousands separators, up to 4 decimals, no trailing zeros. */
export function formatNumber(n: number): string {
  const [whole, fraction] = Math.abs(n).toFixed(4).replace(/\.?0+$/, '').split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '−' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
}

export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}
