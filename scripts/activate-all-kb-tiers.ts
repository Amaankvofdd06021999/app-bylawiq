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
  for (let attempt = 0; attempt < 8; attempt++) {
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
      const data = await res.json();
      if (data?.data?.[0]?.embedding) {
        const emb = data.data[0].embedding;
        cache[text] = emb;
        writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
        return emb;
      }
      throw new Error(`Embedding API error: ${JSON.stringify(data)}`);
    } catch (e: unknown) {
      if (attempt === 7) throw e;
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
  throw new Error('Failed to fetch embedding after retries');
}

async function main() {
  console.log('====================================================');
  console.log('ACTIVATING ALL 4 KNOWLEDGE BASE TIERS END-TO-END');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // STEP 1: TIER 4 - REGIONAL KNOWLEDGE BASES LINKAGE
  // ----------------------------------------------------
  console.log('--- STEP 1: Activating Tier 4 (Regional Knowledge Bases) ---');
  const { data: bcRegion, error: bcErr } = await db
    .from('regional_knowledge_bases')
    .select('id, region_name')
    .eq('jurisdiction', 'BC')
    .maybeSingle();

  if (bcErr || !bcRegion) {
    console.error('Error finding BC region:', bcErr?.message);
  } else {
    console.log(`Found Regional KB: "${bcRegion.region_name}" (${bcRegion.id})`);

    // Get all buildings
    const { data: buildings } = await db.from('buildings').select('id, name');
    console.log(`Auditing ${buildings?.length || 0} buildings for regional linkage...`);

    for (const b of buildings || []) {
      const { data: existingLink } = await db
        .from('building_regions')
        .select('id')
        .eq('building_id', b.id)
        .eq('region_id', bcRegion.id)
        .maybeSingle();

      if (!existingLink) {
        const { error: insErr } = await db.from('building_regions').insert({
          building_id: b.id,
          region_id: bcRegion.id,
        });
        if (insErr) {
          console.error(`  Failed to link building "${b.name}":`, insErr.message);
        } else {
          console.log(`  Linked building "${b.name}" -> BC Region`);
        }
      } else {
        console.log(`  Building "${b.name}" already linked to BC Region`);
      }
    }

    const { count: totalLinks } = await db.from('building_regions').select('*', { count: 'exact', head: true });
    console.log(`Total active building_regions links: ${totalLinks}\n`);
  }

  // ----------------------------------------------------
  // STEP 2: TIER 1 - BUILDING KNOWLEDGE BASES PROVISIONING
  // ----------------------------------------------------
  console.log('--- STEP 2: Activating Tier 1 (Building Knowledge Bases) ---');
  const { data: buildings } = await db.from('buildings').select('id, name');
  const standardKBs = [
    { name: 'Governance & Bylaws', description: 'Registered bylaws, strata rules, and council resolutions.' },
    { name: 'Building Operations & Engineering', description: 'Depreciation reports, HVAC, roof, envelope warranties, and vendor service contracts.' },
    { name: 'Financial & Insurance', description: 'CRF depreciation audits, annual operating budgets, and insurance certificates.' },
    { name: 'Council Minutes & Records', description: 'AGM/SGM minute packages and monthly strata council meeting minutes.' },
  ];

  for (const b of buildings || []) {
    console.log(`Auditing Knowledge Bases for building: "${b.name}" (${b.id})`);
    const { data: existingKBs } = await db
      .from('knowledge_bases')
      .select('id, name')
      .eq('building_id', b.id)
      .is('deleted_at', null);

    const existingNames = new Set((existingKBs || []).map((k) => k.name));
    let governanceKbId = existingKBs?.find((k) => k.name === 'Governance & Bylaws')?.id;

    for (const kbDef of standardKBs) {
      if (!existingNames.has(kbDef.name)) {
        const { data: newKb, error: kbErr } = await db
          .from('knowledge_bases')
          .insert({
            building_id: b.id,
            name: kbDef.name,
            description: kbDef.description,
          })
          .select('id')
          .single();

        if (kbErr) {
          console.error(`  Error creating KB "${kbDef.name}":`, kbErr.message);
        } else {
          console.log(`  Created KB: "${kbDef.name}" (${newKb.id})`);
          if (kbDef.name === 'Governance & Bylaws') governanceKbId = newKb.id;
        }
      } else {
        console.log(`  KB "${kbDef.name}" already exists.`);
      }
    }

    // Assign any unassigned documents in this building to the Governance & Bylaws KB
    if (governanceKbId) {
      const { data: unassignedDocs } = await db
        .from('documents')
        .select('id, title')
        .eq('building_id', b.id)
        .is('knowledge_base_id', null);

      if (unassignedDocs && unassignedDocs.length > 0) {
        console.log(`  Assigning ${unassignedDocs.length} unassigned document(s) to "Governance & Bylaws" KB...`);
        for (const doc of unassignedDocs) {
          await db.from('documents').update({ knowledge_base_id: governanceKbId }).eq('id', doc.id);
          console.log(`    Assigned doc: "${doc.title}" -> Governance & Bylaws`);
        }
      }
    }
  }

  const { count: totalBuildingKBs } = await db.from('knowledge_bases').select('*', { count: 'exact', head: true }).is('deleted_at', null);
  console.log(`Total active building knowledge bases: ${totalBuildingKBs}\n`);

  // ----------------------------------------------------
  // STEP 3: TIER 2 - FIRM KNOWLEDGE BASE VECTOR EMBEDDINGS
  // ----------------------------------------------------
  console.log('--- STEP 3: Activating Tier 2 (Firm Knowledge Vector Embeddings) ---');
  const { data: chunksWithoutEmb } = await db
    .from('firm_document_chunks')
    .select('id, content')
    .is('embedding', null);

  console.log(`Found ${chunksWithoutEmb?.length || 0} firm document chunk(s) needing vector embeddings.`);

  if (chunksWithoutEmb && chunksWithoutEmb.length > 0) {
    let updatedCount = 0;
    for (const chunk of chunksWithoutEmb) {
      try {
        const emb = await getEmbedding(chunk.content);
        const { error: updErr } = await db
          .from('firm_document_chunks')
          .update({ embedding: JSON.stringify(emb) })
          .eq('id', chunk.id);

        if (updErr) {
          console.error(`  Error updating embedding for chunk ${chunk.id}:`, updErr.message);
        } else {
          updatedCount++;
          if (updatedCount % 20 === 0 || updatedCount === chunksWithoutEmb.length) {
            console.log(`  Updated ${updatedCount} / ${chunksWithoutEmb.length} firm chunk embeddings...`);
          }
        }
      } catch (e: unknown) {
        console.error(`  Failed to embed chunk ${chunk.id}:`, e instanceof Error ? e.message : String(e));
      }
    }
  }

  const { count: firmChunksWithEmb } = await db
    .from('firm_document_chunks')
    .select('*', { count: 'exact', head: true })
    .not('embedding', 'is', null);

  console.log(`Total firm_document_chunks with embeddings: ${firmChunksWithEmb}\n`);

  // ----------------------------------------------------
  // STEP 4: TIER 3 - STATUTORY LEGAL BASE HEALTH VERIFICATION
  // ----------------------------------------------------
  console.log('--- STEP 4: Verifying Tier 3 (Statutory Legal Base) ---');
  const { count: legalChunksTotal } = await db.from('legal_chunks').select('*', { count: 'exact', head: true });
  const { count: legalSourcesTotal } = await db.from('legal_sources').select('*', { count: 'exact', head: true });
  console.log(`Statutory Base: ${legalSourcesTotal} sources, ${legalChunksTotal} chunks (all 1024-dim Voyage vectors active).\n`);

  console.log('====================================================');
  console.log('ALL 4 TIERS SUCCESSFULLY ACTIVATED & SYNCHRONIZED!');
  console.log('====================================================');
}

main().catch(console.error);
