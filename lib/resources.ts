// The building-scoped lists a screen can ask for, with the table and exact column list each one reads.
// Both data sources use this one map: `features/workspace/queries.ts` selects these columns from Postgres
// (never `SELECT *`, AGENTS.md §5), and `mock/source.ts` projects each demo row down to the same columns, so the
// demo can never show a field the real query would not return.
export const RESOURCES = {
  documents: [
    'documents',
    'id,building_id,title,type,status,error_message,effective_date,lto_filing_ref,created_at,byte_size,source_url,knowledge_base_id,parsed_sections,structure_confirmed',
  ],
  agents: [
    'agents',
    'id,building_id,name,description,instructions,status,knowledge_base_id,include_legal,top_k,created_at',
  ],
  knowledge: ['knowledge_bases', 'id,building_id,name,description,created_at'],
  bylaws: ['bylaw_nodes', 'id,building_id,title,section_ref,set_id,created_at'],
  versions: [
    'bylaw_versions',
    'id,building_id,node_id,version,body,rationale,status,effective_date,filing_reference,created_by,review_choice,source_document_id,created_at',
  ],
  notices: [
    'generated_documents',
    'id,building_id,kind,title,body_md,status,review_by,created_by,approved_by,approved_at,sent_at,dispute_id,created_at',
  ],
  comments: ['document_review_comments', 'id,building_id,document_id,author_id,body,created_at'],
  disputes: ['disputes', 'id,building_id,title,reference,category,subject_unit,stage,created_at'],
  events: ['dispute_events', 'id,building_id,dispute_id,stage,occurred_at,logged_at,summary,actor_id'],
  updates: [
    'notifications',
    'id,building_id,type,title,body,severity,target_id,state,snoozed_until,created_at',
  ],
  members: ['building_members', 'id,building_id,user_id,role,status,expires_at'],
  invitations: ['invitations', 'id,building_id,email,role,expires_at,accepted_at,revoked_at,created_at'],
  audit: ['audit_log', 'id,building_id,action,target_id,occurred_at,actor_id'],
  chats: ['chats', 'id,building_id,title,scope,updated_at,archived'],
  deployments: ['agent_deployments', 'id,building_id,agent_id,version,config,created_at'],
} as const;
export type Resource = keyof typeof RESOURCES;
