// Deterministic, RFC-shaped UUIDs (version 4, variant 8) so mock seed data satisfies `lib/schema.ts`'s
// `id=z.uuid()` without a random generator. `prefix` is 8 hex chars naming the entity kind.
export function uid(prefix: string, n: number) {
  return `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
}
