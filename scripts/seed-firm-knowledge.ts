import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function docKind(type: string): 'template' | 'policy' | 'precedent' | 'research' | 'guide' {
  if (type === 'template') return 'template';
  if (type === 'policy') return 'policy';
  if (type === 'precedent') return 'precedent';
  if (type === 'research') return 'research';
  return 'guide';
}

async function seed() {
  console.log('--- SEEDING FIRM KNOWLEDGE ---');
  
  // Find all firm organizations
  const { data: firms, error: fErr } = await db
    .from('organizations')
    .select('id, name')
    .eq('kind', 'firm');

  if (fErr || !firms || firms.length === 0) {
    console.error('No firm organizations found to seed:', fErr?.message);
    return;
  }

  const corpusPath = resolve('kb', 'dist', 'corpus.jsonl');
  if (!existsSync(corpusPath)) {
    throw new Error('kb/dist/corpus.jsonl not found');
  }

  const lines = readFileSync(corpusPath, 'utf8').split('\n').filter(Boolean);
  const items = lines.map((l) => JSON.parse(l)).filter((i) => i.layer === 'firm');

  console.log(`Found ${firms.length} firm(s) and ${items.length} firm knowledge items.`);

  for (const firm of firms) {
    console.log(`\nSeeding knowledge for firm: ${firm.name} (${firm.id})...`);
    
    // Get an owner/admin of this firm for created_by
    const { data: member } = await db
      .from('org_members')
      .select('user_id')
      .eq('org_id', firm.id)
      .in('role', ['org_owner', 'org_admin', 'portfolio_manager'])
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    const authorId = member?.user_id || '70e74c7d-8d65-4916-8736-cdfcf9d90ed7'; // fallback

    for (const item of items) {
      const fullText = item.chunks.map((c: { content: string }) => c.content).join('\n\n');
      const hash = createHash('sha256').update(fullText).digest('hex');

      // Check if document already exists for this firm
      const { data: existingDoc } = await db
        .from('firm_documents')
        .select('id')
        .eq('firm_id', firm.id)
        .eq('content_hash', hash)
        .maybeSingle();

      let docId: string;
      if (existingDoc) {
        docId = existingDoc.id;
        console.log(`  Existing doc: ${item.title}`);
      } else {
        const { data: newDoc, error: dErr } = await db
          .from('firm_documents')
          .insert({
            firm_id: firm.id,
            title: item.title,
            doc_kind: docKind(item.type),
            content_hash: hash,
            created_by: authorId,
            published_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (dErr || !newDoc) {
          console.error(`  Error inserting firm_document ${item.title}:`, dErr?.message);
          continue;
        }
        docId = newDoc.id;

        // Clear existing chunks if any
        await db.from('firm_document_chunks').delete().eq('document_id', docId);

        // Insert chunks
        const chunks = item.chunks.map((c: { content: string }, idx: number) => ({
          document_id: docId,
          firm_id: firm.id,
          chunk_index: idx,
          content: c.content,
        }));

        const { error: cErr } = await db.from('firm_document_chunks').insert(chunks);
        if (cErr) {
          console.error(`  Error inserting chunks for ${item.title}:`, cErr?.message);
        } else {
          console.log(`  Inserted: ${item.title} (${chunks.length} chunks)`);
        }
      }
    }
  }

  // Final count verification
  const { count: totalDocs } = await db.from('firm_documents').select('*', { count: 'exact', head: true });
  const { count: totalChunks } = await db.from('firm_document_chunks').select('*', { count: 'exact', head: true });
  console.log(`\nDONE! Total firm_documents: ${totalDocs}, Total firm_document_chunks: ${totalChunks}`);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
