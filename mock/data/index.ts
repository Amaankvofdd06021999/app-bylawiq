import type {MockState} from '@/mock/store';
import {IDS} from './ids';
import {clock} from './clock';
import {profiles} from './people';
import {organizations,orgMembers,buildings,firmLinks,linkCodeSeed,members} from './orgs';
import {documents,chunks} from './documents';
import {knowledge,agents,deployments} from './knowledge';
import {bylaws,versions} from './bylaws';
import {noticeSeed} from './notices';
import {disputeSeed} from './disputes';
import {miscSeed} from './misc';
import {chatSeed,messages} from './chats';
import {firmSeed} from './firm-knowledge';
import {legalSeed} from './legal';
import {residentSeed} from './residents';
import {platformSeed} from './platform';
export {IDS};
// The Seaside/Harbour seed: four linked buildings' worth of organizations, members, documents, bylaws,
// notices, disputes, updates and one chat, plus Coastline's firm knowledge, the legal corpus, the resident's
// credits and the platform admin's aggregates. Recent activity, deadlines and "this month" are dated relative to
// `now` (mock/data/clock.ts) so the dashboards read the same whatever the real date is. `mock/store.ts#seed()`
// deep-clones the result per demo session.
export function buildSeed(now:Date):MockState{
 const c=clock(now);
 return {
  profiles,organizations,orgMembers,buildings,members,firmLinks,linkCodes:linkCodeSeed(c),
  documents,chunks,knowledge,agents,deployments,bylaws,versions,...noticeSeed(c),...disputeSeed(c),...miscSeed(c),
  chats:chatSeed(c),messages,
  ...firmSeed(c),legalChunks:legalSeed(c),...residentSeed(c),platform:platformSeed(c),
 };
}
