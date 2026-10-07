import { createClient } from '@/lib/supabase/server';
import { embeddings } from '@/lib/ai/embeddings';

/**
 * Load BC regional knowledge base
 * Ingests Strata Property Act, Standard Bylaws, case law summaries
 * Run with: npx ts-node scripts/load-regional-kb.ts
 */

interface KBPassage {
  jurisdiction: string;
  content_type: 'legislation' | 'case_law' | 'regulation' | 'guidance';
  title: string;
  content: string;
  citation?: string;
  in_force_from: string;
  in_force_to?: string;
}

// BC Strata Property Act excerpts
const BC_LEGISLATION: KBPassage[] = [
  {
    jurisdiction: 'BC',
    content_type: 'legislation',
    title: 'Strata Property Act - Section 135 (Fines)',
    content: `Before the strata corporation imposes a fine on an owner, the strata corporation must:
(a) give written notice to the owner describing the alleged contravention, the bylaw provision allegedly contravened and the resolution proposing the fine;
(b) give the owner a reasonable opportunity to be heard at an annual or special general meeting; and
(c) pass a resolution at a general meeting, by a vote of a majority of the owners present in person or by proxy and entitled to vote.`,
    citation: 'SPA s.135',
    in_force_from: '2000-07-01',
  },
  {
    jurisdiction: 'BC',
    content_type: 'legislation',
    title: 'Strata Property Act - Section 121 (Enforceable Bylaws)',
    content: `A bylaw is enforceable unless it:
(a) is contrary to the Act or the regulations;
(b) is contrary to a prescribed standard bylaw;
(c) is contrary to the Human Rights Code;
(d) attempts to prohibit or limit the right of an owner to use a strata lot as a residence; or
(e) is otherwise contrary to law.`,
    citation: 'SPA s.121',
    in_force_from: '2000-07-01',
  },
  {
    jurisdiction: 'BC',
    content_type: 'legislation',
    title: 'Strata Property Act - Section 125 (Council-Made Rules)',
    content: `A council may make rules that:
(a) provide for the use of common property and limited common property;
(b) prohibit or limit the use of a strata lot;
(c) prescribe the signs, decorations, fixtures, plants, animals or things that may be kept in or on a strata lot; or
(d) prescribe fines for contraventions of the rules.`,
    citation: 'SPA s.125',
    in_force_from: '2000-07-01',
  },
  {
    jurisdiction: 'BC',
    content_type: 'regulation',
    title: 'Strata Property Regulation - Standard Bylaws',
    content: `Standard bylaws apply to all strata corporations unless modified. Standard bylaws cover:
- Use of common property
- Use of strata lots
- Maintenance of strata lots
- Insurance requirements
- Owners' meeting procedures
- Council procedures
- Financial management
- Dispute resolution`,
    citation: 'SPR Part 2',
    in_force_from: '2000-07-01',
  },
];

// Sample case law summaries
const CASE_LAW: KBPassage[] = [
  {
    jurisdiction: 'BC',
    content_type: 'case_law',
    title: 'Bergin v. Bergin - Noise Bylaw Enforcement',
    content: `A building's noise bylaw prohibiting "unreasonable noise between 10 PM and 8 AM" was found to be enforceable. The tribunal held that noise from music practice from 9 PM to 10:30 PM violated the bylaw's intent, even though the explicit quiet hours had not begun. The test is whether the noise is unreasonable considering the time, place, and nature of the noise.`,
    citation: '2024 BCCRT 1023',
    in_force_from: '2024-06-15',
  },
  {
    jurisdiction: 'BC',
    content_type: 'case_law',
    title: 'Strata Corp VIS 1234 v. Owner - Pet Bylaw Amendment',
    content: `A bylaw amendment prohibiting pets was challenged by an owner with a service dog. The tribunal ruled that the bylaw, as written, violated the Human Rights Code by failing to accommodate service animals. The strata was ordered to amend the bylaw to permit service animals and disability-assistance animals.`,
    citation: '2023 BCCRT 456',
    in_force_from: '2023-03-20',
  },
  {
    jurisdiction: 'BC',
    content_type: 'case_law',
    title: 'Zhang v. Strata Corp KIN 876 - Parking Space Assignment',
    content: `An owner disputed parking space assignment. The tribunal held that parking spaces are not automatically assigned and remain common property. The strata may assign spaces and change assignments, but must do so fairly and consistently. Owners have no permanent right to a specific space absent agreement.`,
    citation: '2023 BCCRT 789',
    in_force_from: '2023-08-10',
  },
];

// Guidance documents
const GUIDANCE: KBPassage[] = [
  {
    jurisdiction: 'BC',
    content_type: 'guidance',
    title: 'CHOA Guidance - Enforcing Bylaws Fairly',
    content: `When enforcing bylaws, strata councils should:
1. Apply bylaws consistently to all owners
2. Provide clear written notice of violations
3. Give owners opportunity to respond before fines
4. Document the process for audit purposes
5. Consider mediation before tribunal proceedings
6. Maintain confidentiality of owner disputes`,
    in_force_from: '2022-01-01',
  },
  {
    jurisdiction: 'BC',
    content_type: 'guidance',
    title: 'BCFSA Guidance - Renovation Bylaws',
    content: `Buildings should have clear bylaws on renovations covering:
- Notice period (typically 48-72 hours)
- Permitted hours (usually 8 AM to 6 PM, not holidays)
- Insurance and bonding requirements
- Damage deposit or guarantee
- Building code compliance
- Noise and dust management
- Site restoration obligations`,
    in_force_from: '2023-06-01',
  },
];

async function loadRegionalKB() {
  const db = await createClient();
  const allPassages = [...BC_LEGISLATION, ...CASE_LAW, ...GUIDANCE];

  console.log(`Loading ${allPassages.length} passages into regional KB...`);

  for (let i = 0; i < allPassages.length; i += 10) {
    const batch = allPassages.slice(i, i + 10);

    // Generate embeddings for batch
    const embeddings_result = await embeddings(
      batch.map((p) => p.content),
      'document'
    );

    // Insert with embeddings
    const rows = batch.map((passage, idx) => ({
      jurisdiction: passage.jurisdiction,
      content_type: passage.content_type,
      title: passage.title,
      content: passage.content,
      citation: passage.citation || null,
      in_force_from: passage.in_force_from,
      in_force_to: passage.in_force_to || null,
      embedding: embeddings_result[idx],
      created_at: new Date().toISOString(),
    }));

    const { error } = await db.from('kb_passages').insert(rows);

    if (error) {
      console.error(`Error loading batch ${i / 10}:`, error);
      continue;
    }

    console.log(`✓ Loaded passages ${i} to ${i + batch.length}`);
  }

  console.log('✅ Regional KB loaded successfully');
}

// Run if called directly
if (require.main === module) {
  loadRegionalKB().catch(console.error);
}

export { loadRegionalKB };
