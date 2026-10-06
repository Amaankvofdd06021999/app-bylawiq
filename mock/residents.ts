import { z } from 'zod';
import type { Row } from '@/lib/schema';
import { AppError, ForbiddenError, NotFoundError, errorMessage } from '@/lib/errors';
import type {
  CitedPassage,
  CreditEntry,
  DraftResult,
  Explainer,
  Prices,
  ResidentData,
  ResidentDraftView,
} from '@/features/residents/types';
import { newId, type LedgerReason, type MockState, type ResidentDraft } from './store';
import { canResidentAsk, membership, roleIn, visibleDocuments } from './rules';
import { FREE_QUESTIONS } from './mutations/chat';
import { now, run, type Result } from './mutations/shared';
// Resident (paying owner) tools, demo only. TODO(legal): drafting help for owners needs legal sign-off before it
// exists outside the demo. Everything here is deterministic templating — no model runs — and every tool reads
// only what a resident may: the building's owner-visible documents (`visibleDocuments`) and the Act/Regulation
// passages of the legal corpus. The firm layer is never read here, and neither is any other building.
export const PRICES: Prices = {
  question: 1,
  draftNotice: 5,
  letterReply: 3,
  pack: { credits: 100, price: 20 },
};
const isResident = (s: MockState, userId: string, buildingId: string) =>
  roleIn(s, userId, buildingId) === 'owner_resident';
/** Where a resident's `/home` goes: their own resident home (every resident of that building has one). */
export function hasResidentHome(s: MockState, userId: string, buildingId: string): boolean {
  return isResident(s, userId, buildingId);
}
/** Paid tools (Ask, explainers, drafting) need the demo-only `chat.resident` and the platform's resident AI flag. */
const toolsOn = (s: MockState, userId: string, buildingId: string) =>
  isResident(s, userId, buildingId) && canResidentAsk(s, userId, buildingId);

// --- Topics: the words a passage, a question or a letter uses for each subject (from the seeded bylaws). ---
type Topic = { id: string; label: string; words: string[] };
const TOPICS: Topic[] = [
  {
    id: 'noise',
    label: 'Noise and quiet hours',
    words: ['noise', 'noisy', 'quiet', 'loud', 'renovation', 'construction', 'music', 'party'],
  },
  { id: 'pets', label: 'Pets', words: ['pet', 'pets', 'dog', 'dogs', 'cat', 'cats', 'animal', 'animals'] },
  {
    id: 'parking',
    label: 'Parking',
    words: ['park', 'parking', 'stall', 'stalls', 'vehicle', 'vehicles', 'car', 'visitor', 'ev', 'charging'],
  },
  {
    id: 'rentals',
    label: 'Renting your unit',
    words: ['rent', 'rental', 'rentals', 'rented', 'lease', 'tenant', 'tenants', 'short-term'],
  },
  {
    id: 'moving',
    label: 'Moving in and out',
    words: ['move-in', 'move in', 'move out', 'move-out', 'moving', 'deposit'],
  },
  { id: 'fines', label: 'Fines', words: ['fine', 'fines', 'fined', 'contravention', 'warning', 'penalty'] },
  { id: 'elevator', label: 'Booking the elevator', words: ['elevator'] },
];
const FINES = TOPICS.find((t) => t.id === 'fines')!;
const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
const has = (text: string, word: string) => new RegExp('\\b' + escape(word) + '\\b', 'i').test(text);
const hits = (text: string, t: Topic) => t.words.filter((w) => has(text, w)).length;
const topicsIn = (text: string) => TOPICS.filter((t) => hits(text, t) > 0);
/** The topic a passage is mostly about: the one whose words it uses most (ties keep list order). */
function mainTopic(text: string): Topic | null {
  let best: Topic | null = null,
    n = 0;
  for (const t of TOPICS) {
    const h = hits(text, t);
    if (h > n) {
      best = t;
      n = h;
    }
  }
  return best;
}

// --- Passages a resident may cite. ---
type Passage = CitedPassage & { docType: string; key: string };
function ownerPassages(s: MockState, userId: string, buildingId: string): Passage[] {
  // Owner-visible only, twice over: `visibleDocuments` already limits a resident to these (the `docs_read` policy).
  const docs = visibleDocuments(s, userId, buildingId).filter((d) => d.owner_visible === true);
  return s.chunks
    .filter((c) => c.buildingId === buildingId)
    .flatMap((c, i) => {
      const d = docs.find((x) => x.id === c.documentId);
      return d
        ? [
            {
              kind: 'building' as const,
              title: String(d.title),
              sectionRef: c.sectionRef,
              content: c.content,
              citation: null,
              docType: String(d.type),
              key: c.documentId + ':' + (c.sectionRef ?? i),
            },
          ]
        : [];
    });
}
// Act and Regulation passages only: the corpus's CRT decisions are fictional samples, never quoted in a letter.
const legal = (s: MockState, section: string) =>
  s.legalChunks.find((c) => c.source !== 'crt' && c.sectionRef === section);
const cite = (p: {
  title: string;
  sectionRef: string | null;
  content: string;
  citation: string | null;
  kind: 'building' | 'legal';
}): CitedPassage => ({
  kind: p.kind,
  title: p.title,
  sectionRef: p.sectionRef,
  content: p.content,
  citation: p.citation,
});
const legalCite = (s: MockState, section: string): CitedPassage[] => {
  const c = legal(s, section);
  return c
    ? [{ kind: 'legal', title: c.title, sectionRef: c.sectionRef, content: c.content, citation: c.citation }]
    : [];
};
/** "Bylaw 3.1", "Rule R.6", or "Move-in package … section M.1". */
const sectionName = (p: Passage) =>
  p.docType === 'bylaws'
    ? 'Bylaw ' + p.sectionRef
    : p.docType === 'rules'
      ? 'Rule ' + p.sectionRef
      : p.title + (p.sectionRef ? ', section ' + p.sectionRef : '');
/** The owner passages that best cover the text's topics: most topics covered, then most topic words used. */
function relevant(passages: Passage[], text: string, max = 2): Passage[] {
  const topics = topicsIn(text);
  if (!topics.length) return [];
  return passages
    .map((p) => {
      const covered = topics.filter((t) => hits(p.content, t) > 0);
      return { p, n: covered.length * 100 + covered.reduce((n, t) => n + hits(p.content, t), 0) };
    })
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((x) => x.p);
}

// --- Explainers: a plain-language reading of each owner-visible bylaw and rule section. ---
const REWRITES: [RegExp, string][] = [
  [/\bA strata lot may be rented\b/g, 'You may rent out your unit'],
  [/\bA strata lot may keep\b/g, 'You may keep'],
  [/\bAn owner or tenant may\b/g, 'You may'],
  [/\bis not permitted\b/g, 'isn’t allowed'],
  [/\bare not permitted\b/g, 'aren’t allowed'],
  [/\bis payable to the strata\b/g, 'must be paid to the strata'],
  [/\bstrata lots\b/g, 'units'],
  [/\bstrata lot\b/g, 'unit'],
  [/\bcontravention\b/g, 'breach'],
  [/\bResidents and visitors must\b/g, 'Everyone in the building must'],
];
const sentences = (text: string) =>
  text
    .split(/(?<=[.;])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
const plain = (text: string) =>
  sentences(text).map((x) => REWRITES.reduce((t, [re, to]) => t.replace(re, to), x));
const FACT =
  /\$\d[\d,]*|\b\d{1,2}:\d{2}\s?[ap]m\b|\b(?:\d+|one|two|three|four|six|twelve)\s+(?:consecutive\s+)?(?:hours?|days?|months?|lb|kg|pets?)\b|\d+%/gi;
const facts = (text: string) => [...new Set([...text.matchAll(FACT)].map((m) => m[0]))];
function explainers(passages: Passage[]): Explainer[] {
  return passages
    .filter((p) => (p.docType === 'bylaws' || p.docType === 'rules') && p.sectionRef)
    .map((p) => ({
      id: p.key,
      label: mainTopic(p.content)?.label ?? 'Section ' + p.sectionRef,
      sectionRef: String(p.sectionRef),
      sectionName: sectionName(p),
      summary: plain(p.content),
      facts: facts(p.content),
      source: cite(p),
    }));
}

// --- Credits. ---
function walletOf(s: MockState, userId: string, buildingId: string) {
  let w = s.wallets.find((x) => x.userId === userId && x.buildingId === buildingId);
  if (!w) {
    w = { userId, buildingId, credits: 0, freeQuestionsUsed: 0 };
    s.wallets.push(w);
  }
  return w;
}
/** Charges `amount` credits for a paid tool. Free questions never pay for drafting. Returns false (changing
 * nothing) when the balance doesn't cover it. */
function spend(
  s: MockState,
  userId: string,
  buildingId: string,
  amount: number,
  reason: LedgerReason,
): boolean {
  const w = walletOf(s, userId, buildingId);
  if (w.credits < amount) return false;
  w.credits -= amount;
  s.ledger.push({ id: newId(), userId, buildingId, delta: -amount, reason, at: now() });
  return true;
}
/** Demo checkout: adds a 100-credit pack. No card and no real charge — the sale is only counted in the
 * platform admin's aggregates (this month's resident credit sales for the building). */
export function buyCredits(s: MockState, userId: string, raw: unknown): Result<{ credits: number }> {
  return run(() => {
    const { buildingId } = z.object({ buildingId: z.uuid() }).parse(raw);
    if (!isResident(s, userId, buildingId)) throw new ForbiddenError();
    const w = walletOf(s, userId, buildingId);
    w.credits += PRICES.pack.credits;
    s.ledger.push({
      id: newId(),
      userId,
      buildingId,
      delta: PRICES.pack.credits,
      reason: 'purchase',
      at: now(),
    });
    const month = now().slice(0, 7);
    const building = s.buildings.find((b) => b.id === buildingId);
    const usage = s.platform.usage.find((x) => x.building_id === buildingId && x.month === month);
    if (usage) usage.resident_credit_sales = Number(usage.resident_credit_sales) + PRICES.pack.price;
    else
      s.platform.usage.push({
        id: newId(),
        building_id: buildingId,
        org_id: building?.org_id,
        month,
        questions: 0,
        no_grounding: 0,
        est_cost_usd: 0,
        resident_credit_sales: PRICES.pack.price,
      });
    return { credits: w.credits };
  });
}

// --- Drafting tools. ---
const noticeInput = z.object({
  kind: z.literal('notice_to_council'),
  buildingId: z.uuid(),
  topic: z.string().trim().min(3).max(120),
  happened: z.string().trim().min(10).max(2000),
  request: z.string().trim().min(5).max(1000),
});
const replyInput = z.object({
  kind: z.literal('letter_reply'),
  buildingId: z.uuid(),
  letter: z.string().trim().min(20).max(8000),
  response: z.string().trim().max(2000).default(''),
});
const draftInput = z.discriminatedUnion('kind', [noticeInput, replyInput]);
const NO_MATCH =
  'We couldn’t match this to a bylaw or rule in your building’s owner documents, so no draft was written and no credits were used. Try naming the topic, such as noise, pets, parking or moving.';
const quote = (p: Passage) => `${sectionName(p)} says: “${p.content}”`;
function signOff(s: MockState, userId: string, buildingId: string): string {
  const name = s.profiles.find((p) => p.id === userId)?.display_name ?? '';
  const unit = membership(s, userId, buildingId)?.unit;
  return [name, unit ? 'Unit ' + String(unit) : null].filter(Boolean).join('\n');
}
function noticeDraft(
  s: MockState,
  userId: string,
  v: z.infer<typeof noticeInput>,
  passages: Passage[],
): Omit<ResidentDraft, 'id' | 'userId' | 'buildingId' | 'created_at'> {
  const law = legalCite(s, '26');
  const body = [
    'Dear members of council,',
    `I am writing about ${v.topic.replace(/^./, (c) => c.toLowerCase())}.`,
    v.happened,
    ...passages.map(quote),
    ...(law.length
      ? ['Under section 26 of the Strata Property Act, council is responsible for enforcing the bylaws.']
      : []),
    v.request,
    'Please let me know how council will follow up.',
    'Thank you,\n' + signOff(s, userId, v.buildingId),
  ].join('\n\n');
  return {
    kind: 'notice_to_council',
    title: 'Notice to council · ' + v.topic,
    body,
    sources: [...passages.map(cite), ...law],
    meaning: [],
  };
}
const FINE_WORDS = /\b(?:fine|fines|fined|complaint|contravention|hearing|penalty)\b/i;
const DEADLINE = /\bwithin\s+\d+\s+(?:business\s+)?days\b/i;
/** Dollar amounts in the passages, where the sentence names one of the letter's (non-fine) topics. */
function bylawAmounts(passages: Passage[], topics: Topic[]): { p: Passage; value: number }[] {
  return passages.flatMap((p) =>
    sentences(p.content)
      .filter((x) => topics.some((t) => t !== FINES && hits(x, t) > 0))
      .flatMap((x) =>
        [...x.matchAll(/\$(\d[\d,]*)/g)].map((m) => ({ p, value: Number(m[1].replace(/,/g, '')) })),
      ),
  );
}
function replyDraft(
  s: MockState,
  userId: string,
  v: z.infer<typeof replyInput>,
  passages: Passage[],
): Omit<ResidentDraft, 'id' | 'userId' | 'buildingId' | 'created_at'> {
  const topics = topicsIn(v.letter);
  const label = mainTopic(v.letter)?.label ?? 'Your building';
  const fineish = FINE_WORDS.test(v.letter);
  const s135 = fineish ? legalCite(s, '135') : [];
  const letterAmounts = [...v.letter.matchAll(/\$(\d[\d,]*)/g)].map((m) => Number(m[1].replace(/,/g, '')));
  const clash = letterAmounts.flatMap((a) =>
    bylawAmounts(passages, topics)
      .filter((b) => b.value !== a)
      .map((b) => ({ a, b })),
  )[0];
  const deadline = v.letter.match(DEADLINE)?.[0];
  const meaning = [
    ...passages.map(
      (p) =>
        `${sectionName(p)} covers ${(mainTopic(p.content)?.label ?? label).toLowerCase()}. It says: “${p.content}”`,
    ),
    ...(s135.length
      ? [
          'Before any fine, the strata must give you the complaint in writing and a reasonable chance to answer, including a hearing if you ask for one (Strata Property Act, s. 135).',
        ]
      : []),
    ...(clash
      ? [
          `The letter mentions $${clash.a}, but ${sectionName(clash.b.p)} mentions $${clash.b.value} for this. Ask the strata to confirm which bylaw the amount comes from.`,
        ]
      : []),
    ...(deadline
      ? [`The letter asks for a reply ${deadline.toLowerCase()}. Send your reply before then.`]
      : []),
  ];
  const body = [
    'Dear members of council,',
    'Thank you for your letter. I have read it together with our bylaws.',
    ...passages.map(quote),
    ...(s135.length
      ? [
          'Before council decides on any fine, please send me the particulars of the complaint in writing and give me a reasonable opportunity to answer, including a hearing if I request one, as section 135 of the Strata Property Act requires.',
        ]
      : []),
    ...(clash
      ? [
          `Please also confirm which bylaw the $${clash.a} amount comes from, as ${sectionName(clash.b.p)} mentions $${clash.b.value}.`,
        ]
      : []),
    v.response || 'My response: [add your side of what happened]',
    'Sincerely,\n' + signOff(s, userId, v.buildingId),
  ].join('\n\n');
  return {
    kind: 'letter_reply',
    title: 'Reply to a strata letter · ' + label,
    body,
    sources: [...passages.map(cite), ...s135],
    meaning,
  };
}
/** Drafts a notice to council (5 credits) or a reply to a strata letter (3 credits) from the resident's
 * owner-visible bylaws and the Act, saves it privately to their "My drafts", and charges for it. Refused — with
 * nothing saved or charged — outside the resident's building, while resident AI is off, when no owner-visible
 * passage matches (no unsourced draft, AGENTS.md §5), or when credits run short (`paywall`). */
export function residentDraft(s: MockState, userId: string, raw: unknown): DraftResult {
  try {
    const v = draftInput.parse(raw);
    if (!toolsOn(s, userId, v.buildingId)) throw new ForbiddenError();
    const text = v.kind === 'notice_to_council' ? [v.topic, v.happened, v.request].join(' ') : v.letter;
    const passages = relevant(ownerPassages(s, userId, v.buildingId), text);
    if (!passages.length) throw new AppError('no_grounding', NO_MATCH);
    const price = v.kind === 'notice_to_council' ? PRICES.draftNotice : PRICES.letterReply;
    if (
      !spend(s, userId, v.buildingId, price, v.kind === 'notice_to_council' ? 'draft_notice' : 'letter_reply')
    )
      return {
        ok: false,
        paywall: true,
        credits: walletOf(s, userId, v.buildingId).credits,
        error: `This needs ${price} credits. Buy credits to continue — nothing was charged.`,
      };
    const draft: ResidentDraft = {
      id: newId(),
      userId,
      buildingId: v.buildingId,
      created_at: now(),
      ...(v.kind === 'notice_to_council'
        ? noticeDraft(s, userId, v, passages)
        : replyDraft(s, userId, v, passages)),
    };
    s.residentDrafts.push(draft);
    return { ok: true, draft: draftView(draft), credits: walletOf(s, userId, v.buildingId).credits };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
const passageSchema = z.object({
  kind: z.enum(['building', 'legal']),
  title: z.string(),
  sectionRef: z.string().nullable(),
  content: z.string(),
  citation: z.string().nullable(),
});
function draftView(d: ResidentDraft): ResidentDraftView {
  return {
    id: d.id,
    kind: d.kind,
    title: d.title,
    body: d.body,
    meaning: d.meaning ?? [],
    createdAt: d.created_at,
    sources: d.sources.flatMap((x) => {
      const p = passageSchema.safeParse(x);
      return p.success ? [p.data] : [];
    }),
  };
}

// --- The resident's screens. ---
const LEDGER_LABEL: Record<LedgerReason, string> = {
  purchase: 'Bought credits',
  question: 'Question',
  free_question: 'Free question',
  draft_notice: 'Notice to council',
  letter_reply: 'Reply to a strata letter',
};
/** Everything the resident screens show, for one resident on their own building. Another building, or anyone who
 * isn't a resident there, is a NotFoundError — the same answer as a building outside their access. */
export function residentData(s: MockState, userId: string, buildingId: string): ResidentData {
  const building = s.buildings.find((b) => b.id === buildingId);
  if (!building || !isResident(s, userId, buildingId)) throw new NotFoundError();
  const name = s.profiles.find((p) => p.id === userId)?.display_name ?? '';
  const w = s.wallets.find((x) => x.userId === userId && x.buildingId === buildingId) ?? {
    credits: 0,
    freeQuestionsUsed: 0,
  };
  const passages = ownerPassages(s, userId, buildingId);
  const history: CreditEntry[] = s.ledger
    .filter((e) => e.userId === userId && e.buildingId === buildingId)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((e) => ({
      id: e.id,
      at: e.at,
      delta: e.delta,
      label: e.reason === 'purchase' ? `Bought ${e.delta} credits` : LEDGER_LABEL[e.reason],
    }));
  const docs: Row[] = visibleDocuments(s, userId, buildingId)
    .filter((d) => d.owner_visible === true)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return {
    firstName: name.split(' ')[0] || 'there',
    name,
    unit:
      membership(s, userId, buildingId)?.unit != null
        ? String(membership(s, userId, buildingId)?.unit)
        : null,
    building: { id: building.id, name: building.name },
    aiOn: canResidentAsk(s, userId, buildingId),
    wallet: {
      credits: w.credits,
      freeLeft: Math.max(0, FREE_QUESTIONS - w.freeQuestionsUsed),
      freeTotal: FREE_QUESTIONS,
    },
    prices: PRICES,
    alerts: s.alerts
      .filter((a) => a.buildingId === buildingId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((a) => ({ id: a.id, title: a.title, body: a.body, at: a.created_at })),
    documents: docs.map((d) => ({
      id: String(d.id),
      title: String(d.title),
      type: String(d.type),
      at: String(d.created_at),
    })),
    history,
    drafts: s.residentDrafts
      .filter((d) => d.userId === userId && d.buildingId === buildingId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(draftView),
    // Explainers are a resident AI feature: paused with the platform flag, like Ask and drafting.
    explainers: canResidentAsk(s, userId, buildingId) ? explainers(passages) : [],
  };
}
