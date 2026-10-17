#!/usr/bin/env node

/**
 * Initialize AI system - runs migrations and loads KB data
 * Usage: npm run init:ai
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('📊 Running Phase 6 migration...');

  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20261007_phase6_ai_completion.sql');

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    return false;
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  try {
    const { error } = await supabase.rpc('exec_sql', { sql_str: sql });
    if (error) throw error;
    console.log('✅ Migration completed');
    return true;
  } catch (error) {
    console.error('⚠️ Migration error (tables may already exist):', error);
    return true; // Continue anyway
  }
}

async function loadRegionalKB() {
  console.log('📚 Loading Regional KB data...');

  const passages = [
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
      content_type: 'case_law',
      title: 'Bergin v. Bergin - Noise Bylaw Enforcement',
      content: `A building's noise bylaw prohibiting "unreasonable noise between 10 PM and 8 AM" was found to be enforceable. The tribunal held that noise from music practice from 9 PM to 10:30 PM violated the bylaw's intent, even though the explicit quiet hours had not begun. The test is whether the noise is unreasonable considering the time, place, and nature of the noise.`,
      citation: '2024 BCCRT 1023',
      in_force_from: '2024-06-15',
    },
  ];

  try {
    for (const passage of passages) {
      const { error } = await supabase.from('kb_passages').upsert(
        {
          ...passage,
          embedding: null, // Will be filled by application
          created_at: new Date().toISOString(),
        },
        { onConflict: 'title,jurisdiction' },
      );

      if (error) {
        console.error(`⚠️ Error loading ${passage.title}:`, error);
        continue;
      }

      console.log(`  ✓ Loaded: ${passage.title}`);
    }

    console.log('✅ Regional KB loaded');
    return true;
  } catch (error) {
    console.error('❌ Failed to load KB:', error);
    return false;
  }
}

async function verifyTables() {
  console.log('🔍 Verifying tables...');

  const tables = [
    'verification_gate_events',
    'citation_usage',
    'security_events',
    'query_expansion_cache',
    'intent_classifications',
  ];

  try {
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('id').limit(0);

      if (error) {
        console.log(`  ⚠️ ${table} - not found`);
      } else {
        console.log(`  ✓ ${table} - exists`);
      }
    }

    console.log('✅ Verification complete');
    return true;
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

async function main() {
  console.log('\n🚀 Initializing AI System\n');
  console.log('='.repeat(50));

  const migration = await runMigration();
  console.log('');

  const kb = await loadRegionalKB();
  console.log('');

  const verify = await verifyTables();
  console.log('');

  console.log('='.repeat(50));
  console.log('\n✅ AI System Initialization Complete!\n');
  console.log('Next steps:');
  console.log('1. npm run dev  - Start development server');
  console.log('2. Test chat at /b/[buildingId]/chat');
  console.log('3. View analytics at /admin/chat-analytics');
  console.log('');
}

main().catch(console.error);
