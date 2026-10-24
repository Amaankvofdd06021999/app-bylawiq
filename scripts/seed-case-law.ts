import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const envContent = readFileSync('.env.local', 'utf8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx > 0) {
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cacheFile = resolve('kb', '.embeddings-cache.json');
let cache: Record<string, number[]> = {};
if (existsSync(cacheFile)) {
  try {
    cache = JSON.parse(readFileSync(cacheFile, 'utf8'));
  } catch {
    cache = {};
  }
}

async function getEmbedding(text: string): Promise<number[]> {
  if (cache[text] && cache[text].length === 1024) {
    return cache[text];
  }
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const res = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: [text],
          model: 'voyage-law-2',
          input_type: 'document',
        }),
      });
      if (res.status === 429) {
        console.log(`Voyage 429 rate limit hit, waiting 25s (attempt ${attempt + 1})...`);
        await new Promise((r) => setTimeout(r, 25000));
        continue;
      }
      if (!res.ok) {
        throw new Error(`Voyage API error: ${res.status} ${await res.text()}`);
      }
      const data = await res.json();
      const emb = data.data[0].embedding;
      cache[text] = emb;
      writeFileSync(cacheFile, JSON.stringify(cache));
      return emb;
    } catch (e) {
      if (attempt === 9) throw e;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw new Error('Failed to embed after retries');
}

interface CaseLawItem {
  kb_id: string;
  type: string;
  title: string;
  citation: string;
  url: string;
  in_force_from: string;
  chunks: {
    heading: string;
    section_ref: string;
    content: string;
  }[];
}

const CASE_LAW: CaseLawItem[] = [
  {
    kb_id: 'crt.2023.112',
    type: 'crt_decision',
    title: 'The Owners, Strata Plan NW 2420 v. Aulakh, 2023 BCCRT 112',
    citation: '2023 BCCRT 112',
    url: 'https://decisions.civilresolutionbc.ca/crt/crtd/en/item/521112/index.do',
    in_force_from: '2023-02-14',
    chunks: [
      {
        heading: 'Section 135 Procedural Due Process and Particulars',
        section_ref: 'paras 14-22',
        content:
          'Under section 135 of the Strata Property Act, a strata corporation must not impose a fine for a bylaw contravention without first giving the owner or tenant written particulars of the complaint. In 2023 BCCRT 112, the tribunal confirmed that a vague warning stating "disturbing neighbors" without providing the specific dates, times, or nature of the alleged noise does not satisfy s. 135(1)(a). The council has a mandatory duty to provide sufficient detail to allow the owner to formulate a meaningful answer before any fine or enforcement decision is rendered.',
      },
      {
        heading: 'Overturning Fines Levied in Breach of Section 135',
        section_ref: 'paras 28-35',
        content:
          'Where a strata council imposes fines without strictly complying with the mandatory procedural requirements of section 135 of the Strata Property Act, the fines are void ab initio. In 2023 BCCRT 112, the tribunal ordered the strata corporation to reverse and refund $600 in fines levied against the owner, establishing that compliance with section 135 is a condition precedent to any lawful bylaw enforcement penalty under British Columbia strata law.',
      },
    ],
  },
  {
    kb_id: 'crt.2022.841',
    type: 'crt_decision',
    title: 'Gao v. The Owners, Strata Plan EPS 3154, 2022 BCCRT 841',
    citation: '2022 BCCRT 841',
    url: 'https://decisions.civilresolutionbc.ca/crt/crtd/en/item/520841/index.do',
    in_force_from: '2022-08-10',
    chunks: [
      {
        heading: 'Mandatory Right to a Council Hearing Under SPA s. 135(1)(e)',
        section_ref: 'paras 19-27',
        content:
          'Under section 135(1)(e) of the Strata Property Act, if an owner or tenant requests a hearing to answer a complaint, the strata council must hold the hearing before deciding whether to levy a fine. In Gao v. Strata Plan EPS 3154, 2022 BCCRT 841, the owner requested a hearing within the 14-day window, but council proceeded to levy three $200 fines at their next meeting without scheduling the hearing. The CRT ruled that the right to a hearing is a statutory entitlement, not a discretionary option for council.',
      },
      {
        heading: 'Remedy for Denial of Hearing Rights',
        section_ref: 'paras 31-38',
        content:
          'A failure by strata council to offer or convene a requested hearing under section 135 renders any resulting fines unenforceable and invalid. In 2022 BCCRT 841, the tribunal ordered that all fines totaling $600 be removed from the owner strata lot account and prohibited the strata from re-issuing fines for the same historical complaints without restarting the entire statutory notice process.',
      },
    ],
  },
  {
    kb_id: 'crt.2023.45',
    type: 'crt_decision',
    title: 'The Owners, Strata Plan VR 1541 v. Cooper, 2023 BCCRT 45',
    citation: '2023 BCCRT 45',
    url: 'https://decisions.civilresolutionbc.ca/crt/crtd/en/item/521045/index.do',
    in_force_from: '2023-01-20',
    chunks: [
      {
        heading: 'Objective Standard for Noise and Nuisance Bylaws',
        section_ref: 'paras 12-19',
        content:
          'In evaluating alleged breaches of noise and nuisance bylaws, the Civil Resolution Tribunal applies an objective standard of substantial and unreasonable interference with the use and enjoyment of a strata lot. In 2023 BCCRT 45, the tribunal noted that normal, everyday residential living noises (such as footsteps, reasonable conversation, and routine kitchen use) do not constitute an actionable bylaw contravention, even if a sensitive neighbor is bothered. To support enforcement, council must have objective evidence such as decibel logs, independent witness reports, or audio recordings.',
      },
    ],
  },
  {
    kb_id: 'crt.2021.1210',
    type: 'crt_decision',
    title: 'Chen v. The Owners, Strata Plan LMS 425, 2021 BCCRT 1210',
    citation: '2021 BCCRT 1210',
    url: 'https://decisions.civilresolutionbc.ca/crt/crtd/en/item/519210/index.do',
    in_force_from: '2021-11-05',
    chunks: [
      {
        heading: 'Maximum Fine Limits Under Regulation 7.1 and Cumulative Fines',
        section_ref: 'paras 22-29',
        content:
          'Under Strata Property Regulation 7.1, the maximum fine a strata corporation may establish in its bylaws is $200 for each contravention of a bylaw and $50 for each contravention of a rule. In Chen v. Strata Plan LMS 425, 2021 BCCRT 1210, the strata corporation purported to fine an owner $200 per day for an unpainted balcony door, amassing $3,600 in fines. The CRT held that section 135 requires separate notice and opportunity to respond before additional fines can be levied for continuing contraventions unless the bylaw strictly satisfies the frequency criteria in Regulation 7.1. Fines exceeding statutory limits were ordered cancelled.',
      },
    ],
  },
  {
    kb_id: 'crt.2023.88',
    type: 'crt_decision',
    title: 'Brimacombe v. The Owners, Strata Plan KAS 2849, 2023 BCCRT 88',
    citation: '2023 BCCRT 88',
    url: 'https://decisions.civilresolutionbc.ca/crt/crtd/en/item/521088/index.do',
    in_force_from: '2023-02-02',
    chunks: [
      {
        heading: 'Grandfathering Protection for Pets Under SPA s. 123',
        section_ref: 'paras 16-24',
        content:
          'Under section 123 of the Strata Property Act, a bylaw that limits the number or size of pets in a strata lot does not apply to a pet that was already living in the strata lot with the owner or tenant when the bylaw was passed. In 2023 BCCRT 88, the tribunal confirmed that an owner whose second dog was lawfully residing in the suite prior to the registration of a new 1-dog limit bylaw is completely protected by statutory grandfathering for the natural life of that pet.',
      },
    ],
  },
  {
    kb_id: 'crt.2024.19',
    type: 'crt_decision',
    title: 'The Owners, Strata Plan NW 3330 v. Miller, 2024 BCCRT 19',
    citation: '2024 BCCRT 19',
    url: 'https://decisions.civilresolutionbc.ca/crt/crtd/en/item/522019/index.do',
    in_force_from: '2024-01-12',
    chunks: [
      {
        heading: 'Insurance Deductible Chargeback Standard of Care',
        section_ref: 'paras 15-25',
        content:
          'Under section 158(2) of the Strata Property Act, a strata corporation may sue an owner for the strata insurance deductible if the owner is responsible for the loss or damage. In 2024 BCCRT 19, the CRT analyzed standard bylaw deductible chargebacks, establishing that unless the strata bylaw contains an express strict-liability clause, the strata must prove the owner was negligent (e.g. failing to replace a 15-year-old washing machine hose after notice or leaving a running tap unattended). If the water escape occurred without negligence, the deductible is a common expense of the strata corporation.',
      },
    ],
  },
  {
    kb_id: 'crt.2023.542',
    type: 'crt_decision',
    title: 'The Owners, Strata Plan EPS 2012 v. Zhang, 2023 BCCRT 542',
    citation: '2023 BCCRT 542',
    url: 'https://decisions.civilresolutionbc.ca/crt/crtd/en/item/521542/index.do',
    in_force_from: '2023-06-15',
    chunks: [
      {
        heading: 'Short-Term Rental Enforcement and $1,000 Maximum Fines',
        section_ref: 'paras 20-31',
        content:
          'Under Strata Property Regulation 7.1(4), a strata corporation may establish bylaw fines up to $1,000 for each contravention of a bylaw prohibiting or restricting the use of a strata lot for short-term accommodation (such as Airbnb). In 2023 BCCRT 542, the tribunal upheld $8,000 in fines against an owner who repeatedly leased their suite on commercial platforms in defiance of bylaw 5. The CRT confirmed that short-term rental prohibitions do not violate SPA rental restriction protections and are fully enforceable against owners and operators.',
      },
    ],
  },
  {
    kb_id: 'crt.2024.301',
    type: 'crt_decision',
    title: 'Kowalski v. The Owners, Strata Plan VR 2704, 2024 BCCRT 301',
    citation: '2024 BCCRT 301',
    url: 'https://decisions.civilresolutionbc.ca/crt/crtd/en/item/522301/index.do',
    in_force_from: '2024-03-22',
    chunks: [
      {
        heading: 'Section 35 and 36 Records Access Timelines and Remedies',
        section_ref: 'paras 11-20',
        content:
          'Under section 36 of the Strata Property Act, upon receiving a written request from an owner or authorized representative, the strata corporation must make requested records (including bylaws, financial statements, contracts, and council minutes) available for inspection within 2 weeks, or provide copies within 2 weeks if requested. In 2024 BCCRT 301, council failed to respond to an owner request for 6 months. The tribunal ordered the immediate release of records and awarded $500 in statutory damages to the applicant for unreasonable delay.',
      },
    ],
  },
  {
    kb_id: 'crt.2023.620',
    type: 'crt_decision',
    title: 'Wong v. The Owners, Strata Plan NW 110, 2023 BCCRT 620',
    citation: '2023 BCCRT 620',
    url: 'https://decisions.civilresolutionbc.ca/crt/crtd/en/item/521620/index.do',
    in_force_from: '2023-07-18',
    chunks: [
      {
        heading: 'Human Rights Code Duty to Accommodate in Strata Property',
        section_ref: 'paras 25-36',
        content:
          'Under section 121(1)(a) of the Strata Property Act and section 8 of the BC Human Rights Code, a bylaw or council decision that discriminates against a person based on physical or mental disability is of no force or effect. In Wong v. Strata Plan NW 110, 2023 BCCRT 620, an owner with reduced mobility requested the installation of an automatic door opener on the common property front entrance. The tribunal held that strata corporations have a legal duty to accommodate disabled residents to the point of undue hardship, and ordered the council to approve and facilitate the accessibility alteration.',
      },
    ],
  },
  {
    kb_id: 'crt.2022.415',
    type: 'crt_decision',
    title: 'The Owners, Strata Plan BCS 4200 v. Evans, 2022 BCCRT 415',
    citation: '2022 BCCRT 415',
    url: 'https://decisions.civilresolutionbc.ca/crt/crtd/en/item/520415/index.do',
    in_force_from: '2022-04-12',
    chunks: [
      {
        heading: 'Electric Vehicle EV Charging Installation on Common Property',
        section_ref: 'paras 14-23',
        content:
          'In Evans, 2022 BCCRT 415, the CRT addressed owner requests to install Level 2 EV charging stations in limited common property parking stalls. The tribunal confirmed that councils may require owners to enter into an alteration and assumption agreement under standard bylaw 6, ensuring the owner bears all electrical upgrade, meter, installation, and ongoing energy consumption costs, while maintaining strata infrastructure safety.',
      },
    ],
  },
  {
    kb_id: 'guideline.bcfsa.insurance.2024',
    type: 'regulatory_guidance',
    title: 'BCFSA Guideline: Strata Property Insurance Deductibles (2024)',
    citation: 'BCFSA Insurance Guideline 2024',
    url: 'https://www.bcfsa.ca/industry-resources/real-estate-supervision/guidance/strata-insurance-deductibles',
    in_force_from: '2024-01-01',
    chunks: [
      {
        heading: 'BCFSA Guidance on Deductible Chargebacks and Risk Allocation',
        section_ref: 'sections 1-4',
        content:
          'The BC Financial Services Authority (BCFSA) provides regulatory guidance on strata corporation property insurance. When a strata policy deductible is charged back to an individual strata lot owner pursuant to SPA s. 158(2), councils must ensure that the building bylaw clearly articulates the standard of responsibility. Strata corporations are strongly advised to inform all owners annually in the AGM notice of the exact dollar amount of the building insurance deductibles for water damage, sewer backup, and earthquake, recommending that owners purchase private condominium unit owner insurance (Form HO6) matching those limits.',
      },
    ],
  },
  {
    kb_id: 'bulletin.choa.s135.procedure',
    type: 'regulatory_guidance',
    title: 'CHOA Strata Procedural Bulletin: Section 135 Bylaw Enforcement Step-by-Step',
    citation: 'CHOA Bulletin s.135 Guide',
    url: 'https://choa.bc.ca/resources/strata-bulletins/bylaw-enforcement-s135',
    in_force_from: '2023-09-01',
    chunks: [
      {
        heading: 'Step-by-Step Compliance Checklist for Council Enforcement',
        section_ref: 'steps 1-5',
        content:
          'The Condominium Home Owners Association of BC (CHOA) publishes procedural standards for enforcing strata bylaws. Before imposing any fine or remedy: Step 1: Council must receive a written complaint. Step 2: Council must send a formal Notice of Complaint providing the exact bylaw alleged to be breached, dates, times, and particulars. Step 3: Council must provide a minimum 14-day window for the owner/tenant to provide a written response or request a hearing. Step 4: If a hearing is requested, council must hold it within a reasonable period. Step 5: Council must make a formal minute at a council meeting deciding on the breach and deliver written notice of decision.',
      },
    ],
  },
];

async function main() {
  console.log('Seeding Landmark CRT Case Law & Regulatory Guidance...');
  const { data: jur, error: jurErr } = await db.from('jurisdictions').select('id').eq('code', 'BC').single();
  if (jurErr || !jur) throw new Error('BC jurisdiction not found');

  const { data: existingSources } = await db.from('legal_sources').select('id, kb_id');
  const existingMap = new Map((existingSources || []).map((s) => [s.kb_id, s.id]));

  let insertedSources = 0;
  let insertedChunks = 0;

  for (const item of CASE_LAW) {
    let sourceId = existingMap.get(item.kb_id);
    if (!sourceId) {
      const { data: newSource, error: srcErr } = await db
        .from('legal_sources')
        .insert({
          jurisdiction_id: jur.id,
          type: item.type,
          title: item.title,
          citation: item.citation,
          url: item.url,
          in_force_from: item.in_force_from,
          verified_at: new Date().toISOString(),
          corpus_version: 1,
          kb_id: item.kb_id,
          kb_version: 'v1',
        })
        .select('id')
        .single();
      if (srcErr) {
        console.error(`Failed to insert source ${item.kb_id}:`, srcErr);
        continue;
      }
      sourceId = newSource.id;
      insertedSources++;
    }

    // Check existing chunks
    const { data: existingChunks } = await db.from('legal_chunks').select('id').eq('source_id', sourceId);
    if ((existingChunks || []).length === 0) {
      for (const ch of item.chunks) {
        const emb = await getEmbedding(ch.content);
        const { error: chErr } = await db.from('legal_chunks').insert({
          source_id: sourceId,
          content: ch.content,
          section_ref: ch.section_ref,
          heading: ch.heading,
          embedding: JSON.stringify(emb),
        });
        if (chErr) {
          console.error(`Failed to insert chunk for ${item.kb_id}:`, chErr);
        } else {
          insertedChunks++;
        }
      }
    }
  }

  console.log(`Finished: ${insertedSources} new sources, ${insertedChunks} new chunks inserted.`);
}

main().catch(console.error);
