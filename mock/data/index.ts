import type {MockState} from '@/mock/store';
import {IDS} from './ids';
import {profiles} from './people';
import {organizations,orgMembers,buildings,firmLinks,linkCodes,members} from './orgs';
import {documents,chunks} from './documents';
import {knowledge,agents,deployments} from './knowledge';
import {bylaws,versions} from './bylaws';
import {notices,comments} from './notices';
import {disputes,events} from './disputes';
import {updates,invitations,audit} from './misc';
import {chats,messages} from './chats';
import {firmDocs,firmChunks} from './firm-knowledge';
import {legalChunks} from './legal';
import {wallets,ledger,residentDrafts,alerts} from './residents';
import {platform} from './platform';
export {IDS};
// The Seaside/Harbour seed: four linked buildings' worth of organizations, members, documents, bylaws,
// notices, disputes, updates and one chat, plus Coastline's firm knowledge, the legal corpus, the resident's
// credits and the platform admin's aggregates — everything `mock/store.ts#seed()` clones per demo session.
export const SEED:MockState={
 profiles,organizations,orgMembers,buildings,members,firmLinks,linkCodes,
 documents,chunks,knowledge,agents,deployments,bylaws,versions,notices,comments,disputes,events,updates,invitations,
 audit,chats,messages,
 firmDocs,firmChunks,legalChunks,wallets,ledger,residentDrafts,alerts,platform,
};
