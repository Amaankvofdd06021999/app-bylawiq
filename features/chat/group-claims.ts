import type { GroundedAnswer, Source } from '@/lib/ai/citations';
// Pure: shared by the chat UI (a client component) and its tests, so it imports neither 'server-only' nor
// 'client-only'.
export type Claim = GroundedAnswer['answer'][number];
export type ClaimGroup = { key: string; kind: Source['kind'] | 'other'; heading: string; claims: Claim[] };
type NamedBuilding = { id: string; name: string };
const possessive = (name: string) => name + (name.endsWith('s') ? '’' : '’s');
export const OTHER_BUILDING = 'Another building’s documents';
/** The group a source belongs to: one per building (by `buildingId`), the law, one per firm, or 'other'. */
function keyOf(s: Source | undefined): string {
  return !s
    ? 'other'
    : s.kind === 'building'
      ? 'building:' + (s.buildingId ?? 'unknown')
      : s.kind === 'firm'
        ? 'firm:' + (s.firmName ?? '')
        : 'legal';
}
/** A firm source's name: `firmName` when the source carries it, else the part of its citation before the
 * first " · " ("Coastline Strata Management · Policies · internal practice"). */
export function firmNameOf(s: Source): string {
  return s.firmName || s.citation?.split(' · ')[0]?.trim() || 'Your firm';
}
/** A building's display name, or null when the building isn't one this page knows — never the active building's
 * name for a different building (AGENTS.md §0). */
export function buildingNameOf(id: string | null, buildings: readonly NamedBuilding[]): string | null {
  return id ? (buildings.find((b) => b.id === id)?.name ?? null) : null;
}
/** Groups answer claims under one heading per building (by each cited source's `buildingId`), then the law, then
 * the firm's internal practice, then "Other sources". A claim goes by its first cited source, except that a claim
 * citing more than one building's documents goes under "Other sources", so no building's heading ever holds
 * another building's text. The active building comes first, then other known buildings alphabetically, then
 * buildings this page can't name ("Another building’s documents", never the active building's name). */
export function groupClaims(
  claims: readonly Claim[],
  sources: readonly Source[],
  buildings: readonly NamedBuilding[],
  activeBuildingId: string,
): ClaimGroup[] {
  const find = (id: number) => sources.find((s) => s.id === id);
  const groupOf = (c: Claim): string => {
    const cited = c.evidence.map((e) => find(e.source));
    if (new Set(cited.filter((s) => s?.kind === 'building').map(keyOf)).size > 1) return 'other';
    return keyOf(cited[0]);
  };
  const groups = new Map<string, ClaimGroup>();
  for (const c of claims) {
    const key = groupOf(c);
    let g = groups.get(key);
    if (!g) {
      const first = find(c.evidence[0]?.source ?? 0);
      if (key === 'other') g = { key, kind: 'other', heading: 'Other sources', claims: [] };
      else if (key === 'legal') g = { key, kind: 'legal', heading: 'What the law says', claims: [] };
      else if (key.startsWith('firm:'))
        g = {
          key,
          kind: 'firm',
          heading:
            'How ' +
            (first ? firmNameOf(first) : 'your firm') +
            ' handles this (internal practice — not law or bylaw)',
          claims: [],
        };
      else {
        const name = buildingNameOf(first?.buildingId ?? null, buildings);
        g = {
          key,
          kind: 'building',
          heading: name ? 'What ' + possessive(name) + ' bylaws and documents say' : OTHER_BUILDING,
          claims: [],
        };
      }
      groups.set(key, g);
    }
    g.claims.push(c);
  }
  const rank = (g: ClaimGroup) =>
    g.kind === 'building'
      ? g.key === 'building:' + activeBuildingId
        ? 0
        : g.heading === OTHER_BUILDING
          ? 2
          : 1
      : g.kind === 'legal'
        ? 3
        : g.kind === 'firm'
          ? 4
          : 5;
  return [...groups.values()].sort(
    (a, b) => rank(a) - rank(b) || (rank(a) === 1 ? a.heading.localeCompare(b.heading) : 0),
  );
}
