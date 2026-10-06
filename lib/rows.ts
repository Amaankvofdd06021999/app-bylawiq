import type { Row } from './schema';
/** A row field as display text: strings as-is, numbers stringified, anything else (or missing) the fallback. */
export const str = (row: Row, key: string, fallback = '') =>
  typeof row[key] === 'string'
    ? (row[key] as string)
    : typeof row[key] === 'number'
      ? String(row[key])
      : fallback;
