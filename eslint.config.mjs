import { defineConfig, globalIgnores } from 'eslint/config';
import next from 'eslint-config-next/core-web-vitals';
import ts from 'eslint-config-next/typescript';
export default defineConfig([...next, ...ts,
 {files:['**/*.{ts,tsx}'],rules:{'@typescript-eslint/no-explicit-any':'error','no-restricted-imports':['error',{patterns:[{group:['**/supabase/admin'],message:'Service role is restricted to authenticated ingestion jobs.'}]}]}},
 {files:['inngest/ingest.ts','inngest/corpus-sync.ts','features/members/invite.ts'],rules:{'no-restricted-imports':'off'}},
 globalIgnores(['.next/**','node_modules/**','test-results/**','playwright-report/**','next-env.d.ts'])]);
