#!/usr/bin/env node

/**
 * Verify all integrations compile and have correct signatures
 * Usage: npx ts-node scripts/verify-integrations.ts
 */

import * as fs from 'fs';

interface CheckResult {
  name: string;
  passed: boolean;
  errors: string[];
}

const results: CheckResult[] = [];

function check(name: string, test: () => void) {
  try {
    test();
    results.push({ name, passed: true, errors: [] });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.push({
      name,
      passed: false,
      errors: [String(error)],
    });
    console.log(`❌ ${name}: ${error}`);
  }
}

function fileExists(path: string): boolean {
  return fs.existsSync(path);
}

function fileContains(filePath: string, text: string): boolean {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes(text);
}

console.log('🔍 Verifying all integrations...\n');

// Check 1: stream.ts imports exist
check('stream.ts has query expansion import', () => {
  if (
    !fileContains(
      'features/chat/stream.ts',
      "import { expandQuery, classifyIntent } from './query-expansion'",
    )
  )
    throw new Error('Missing query expansion import');
});

check('stream.ts has verification gate import', () => {
  if (!fileContains('features/chat/stream.ts', 'import { verifyResidentResponse, auditResidentQA'))
    throw new Error('Missing verification gate import');
});

check('stream.ts calls expandQuery', () => {
  if (!fileContains('features/chat/stream.ts', 'await expandQuery(user, question'))
    throw new Error('expandQuery not called in stream.ts');
});

check('stream.ts calls classifyIntent', () => {
  if (!fileContains('features/chat/stream.ts', 'await classifyIntent(question)'))
    throw new Error('classifyIntent not called in stream.ts');
});

check('stream.ts calls verifyResidentResponse', () => {
  if (!fileContains('features/chat/stream.ts', 'await verifyResidentResponse({'))
    throw new Error('verifyResidentResponse not called in stream.ts');
});

check('stream.ts calls auditResidentQA', () => {
  if (!fileContains('features/chat/stream.ts', 'await auditResidentQA({'))
    throw new Error('auditResidentQA not called in stream.ts');
});

// Check 3: Route pages exist
check('Building chat route exists', () => {
  if (!fileExists('app/(app)/b/[buildingId]/chat/page.tsx')) throw new Error('File not found');
});

check('Portfolio chat route exists', () => {
  if (!fileExists('app/(app)/portfolio/chat/page.tsx')) throw new Error('File not found');
});

check('Firm chat route exists', () => {
  if (!fileExists('app/(app)/firm/chat/page.tsx')) throw new Error('File not found');
});

check('Admin analytics route exists', () => {
  if (!fileExists('app/(app)/admin/chat-analytics/page.tsx')) throw new Error('File not found');
});

// Check 4: Components exist
check('MultiRoleChat component exists', () => {
  if (!fileExists('features/chat/components/multi-role-chat.tsx')) throw new Error('File not found');
});

check('Analytics dashboard component exists', () => {
  if (!fileExists('features/chat/components/chat-analytics-dashboard.tsx')) throw new Error('File not found');
});

// Check 5: Scripts exist
check('Initialize AI script exists', () => {
  if (!fileExists('scripts/initialize-ai-system.ts')) throw new Error('File not found');
});

check('Regional KB loader script exists', () => {
  if (!fileExists('scripts/load-regional-kb.ts')) throw new Error('File not found');
});

// Check 6: Migration file exists
check('Phase 6 migration exists', () => {
  if (!fileExists('supabase/migrations/20261007_phase6_ai_completion.sql')) throw new Error('File not found');
});

// Check 7: E2E tests exist
check('Chat RAG tests exist', () => {
  if (!fileExists('e2e/chat-rag.spec.ts')) throw new Error('File not found');
});

// Check 8: Citations analytics exports
check('Citations analytics exports functions', () => {
  const content = fs.readFileSync('features/chat/citations-analytics.ts', 'utf-8');
  const exports = [
    'export function parseCitations',
    'export function validateCitations',
    'export async function trackCitationUsage',
    'export async function getCitationMetrics',
    'export async function getBuildingChatAnalytics',
    'export async function getFirmChatAnalytics',
    'export async function getPlatformChatAnalytics',
  ];

  for (const exp of exports) {
    if (!content.includes(exp)) throw new Error(`Missing export: ${exp}`);
  }
});

// Check 9: Query expansion exports
check('Query expansion exports functions', () => {
  const content = fs.readFileSync('features/chat/query-expansion.ts', 'utf-8');
  if (!content.includes('export async function expandQuery')) throw new Error('Missing expandQuery export');
  if (!content.includes('export async function classifyIntent'))
    throw new Error('Missing classifyIntent export');
});

// Check 10: Verification gate exports
check('Verification gate exports functions', () => {
  const content = fs.readFileSync('features/chat/resident-verification-gate.ts', 'utf-8');
  if (!content.includes('export async function verifyResidentResponse'))
    throw new Error('Missing verifyResidentResponse export');
  if (!content.includes('export async function auditResidentQA'))
    throw new Error('Missing auditResidentQA export');
});

// Summary
console.log('\n' + '='.repeat(50));
const passed = results.filter((r) => r.passed).length;
const total = results.length;
console.log(`\n✅ Passed: ${passed}/${total}`);

if (passed < total) {
  console.log('\n❌ Failed checks:');
  results
    .filter((r) => !r.passed)
    .forEach((r) => {
      console.log(`  - ${r.name}`);
      r.errors.forEach((e) => console.log(`    ${e}`));
    });
  process.exit(1);
} else {
  console.log('\n🎉 All integrations verified!');
  console.log('\nNext steps:');
  console.log('1. npm run init:ai  — Initialize database');
  console.log('2. npm run build    — Build for production');
  console.log('3. npm run test:e2e — Run E2E tests');
  process.exit(0);
}
