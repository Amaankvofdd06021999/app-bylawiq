import type { Row } from '@/lib/schema';
import { IDS } from './ids';
import { uid } from './uid';
// One knowledge base and one deployed agent per building (resources.knowledge / resources.agents /
// resources.deployments), enough for the Knowledge and Agents screens without real ingestion or a model call.
function buildingAi(
  buildingId: string,
  creatorId: string,
  prefix: string,
): { knowledge: Row[]; agents: Row[]; deployments: Row[] } {
  const kb: Row = {
    id: uid(prefix, 1),
    building_id: buildingId,
    name: 'Building bylaws & rules',
    description: 'Registered bylaws, amendments and the rules that apply to shared spaces.',
    created_at: '2026-05-11T09:00:00Z',
  };
  const agent: Row = {
    id: uid(prefix, 2),
    building_id: buildingId,
    name: 'Bylaw intelligence',
    description: 'Find clear answers in the current registered bylaws and supporting sources.',
    instructions: 'Help council members and the building manager understand the building’s provisions.',
    status: 'deployed',
    knowledge_base_id: kb.id,
    include_legal: true,
    top_k: 8,
    created_by: creatorId,
    created_at: '2026-05-12T09:00:00Z',
  };
  const deployment: Row = {
    id: uid(prefix, 3),
    building_id: buildingId,
    agent_id: agent.id,
    version: 1,
    config: {
      name: agent.name,
      instructions: agent.instructions,
      knowledge_base_id: kb.id,
      include_legal: true,
      top_k: 8,
    },
    deployed_by: creatorId,
    created_at: '2026-05-12T09:05:00Z',
  };
  return { knowledge: [kb], agents: [agent], deployments: [deployment] };
}
const harbour = buildingAi(IDS.buildings.harbour, IDS.users.sarah, '21000001');
const marina = buildingAi(IDS.buildings.marina, IDS.users.sarah, '21000002');
const seaside = buildingAi(IDS.buildings.seaside, IDS.users.james, '21000003');
const parkside = buildingAi(IDS.buildings.parkside, IDS.users.omar, '21000004');
export const knowledge: Row[] = [
  ...harbour.knowledge,
  ...marina.knowledge,
  ...seaside.knowledge,
  ...parkside.knowledge,
];
export const agents: Row[] = [...harbour.agents, ...marina.agents, ...seaside.agents, ...parkside.agents];
export const deployments: Row[] = [
  ...harbour.deployments,
  ...marina.deployments,
  ...seaside.deployments,
  ...parkside.deployments,
];
