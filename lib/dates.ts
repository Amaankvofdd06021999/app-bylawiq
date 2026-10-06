// "Sep 27, 2026" from an ISO date or timestamp. Reads the first ten characters rather than going through `Date`,
// so the server and the browser render the same day whatever their time zone. "—" when missing or malformed.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function shortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return y && m && d && m <= 12 ? `${MONTHS[m - 1]} ${d}, ${y}` : '—';
}
