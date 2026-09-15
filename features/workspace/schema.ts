import {z} from 'zod';
import {id,role} from '@/lib/schema';
const text=z.string().trim().min(1).max(200);
export const mutationSchema=z.object({buildingId:id,operation:z.enum(['building.create','building.update','building.archive','knowledge.save','knowledge.delete','agent.save','agent.deploy','agent.pause','agent.delete','document.update','document.delete','document.confirm','bylaw.save','bylaw.transition','notice.save','notice.transition','dispute.save','dispute.event','update.state','member.change','member.invite','invite.revoke','org.update','chat.rename','chat.archive']),id:id.optional(),values:z.record(z.string(),z.unknown())});
export const values={
 building:z.object({orgId:id,name:text,plan:z.string().max(30).default(''),address:z.string().max(300).default(''),units:z.coerce.number().int().min(1).max(5000).nullable().default(null)}),
 knowledge:z.object({name:text,description:z.string().max(500).default('')}),
 agent:z.object({name:text,description:z.string().max(500).default(''),instructions:z.string().max(4000).default(''),knowledgeBaseId:z.union([id,z.literal('')]).default(''),includeLegal:z.boolean().default(true),topK:z.coerce.number().int().min(3).max(10).default(8)}),
 document:z.object({title:text,type:text,effectiveDate:z.union([z.iso.date(),z.literal('')]).default(''),filingReference:z.string().max(100).default('')}),
 bylaw:z.object({nodeId:z.union([id,z.literal('')]).default(''),title:text,section:text,body:z.string().min(5).max(30000),rationale:z.string().max(4000).default('')}),
 transition:z.object({status:text,review:z.enum(['counsel','without_review']).nullable().default(null),filing:z.string().max(120).nullable().default(null),effective:z.iso.date().nullable().default(null),for:z.coerce.number().int().min(0).nullable().default(null),against:z.coerce.number().int().min(0).nullable().default(null),abstain:z.coerce.number().int().min(0).nullable().default(null),override:z.string().max(2000).nullable().default(null)}),
 notice:z.object({title:text,body:z.string().min(5).max(40000),kind:z.enum(['s135_notice','hearing_invite','decision_letter','fine_notice','council_report','crt_pack','lawyer_brief','email','other']),disputeId:z.union([id,z.literal('')]).default('')}),
 dispute:z.object({title:text,category:text,unit:z.string().max(30).default('')}),
 event:z.object({disputeId:id,stage:text,occurredAt:z.iso.datetime(),summary:z.string().min(5).max(3000),key:id,confirmed:z.literal(true)}),
 member:z.object({role,remove:z.boolean().default(false)}),
 invite:z.object({email:z.email().toLowerCase().trim(),role,expiresAt:z.iso.datetime().nullable().default(null)}),
 notification:z.object({state:z.enum(['viewed','actioned','dismissed','snoozed']),reason:z.string().max(500).nullable().default(null),until:z.iso.date().nullable().default(null)}),
};
