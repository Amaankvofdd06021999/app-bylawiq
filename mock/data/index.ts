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
export {IDS};
// The Seaside/Harbour seed: four linked buildings' worth of organizations, members, documents, bylaws,
// notices, disputes, updates and one chat — everything `mock/store.ts#seed()` clones per demo session.
export const SEED:MockState={
 profiles,organizations,orgMembers,buildings,members,firmLinks,linkCodes,
 documents,chunks,knowledge,agents,deployments,bylaws,versions,notices,comments,disputes,events,updates,invitations,
 audit,chats,messages,
};
