import { uid } from './uid';
// Fixed seed ids referenced by tests and e2e specs. Every id is a distinct, valid UUID (see `uid`).
export const IDS = {
  orgs: {
    coastline: uid('a0000000', 1),
    harbourOrg: uid('a0000000', 2),
    marinaOrg: uid('a0000000', 3),
    seasideOrg: uid('a0000000', 4),
    parksideOrg: uid('a0000000', 5),
  },
  buildings: {
    harbour: uid('b0000000', 1),
    marina: uid('b0000000', 2),
    seaside: uid('b0000000', 3),
    parkside: uid('b0000000', 4),
  },
  users: {
    dana: uid('c0000000', 1),
    sarah: uid('c0000000', 2),
    leeWong: uid('c0000000', 3),
    james: uid('c0000000', 4),
    grace: uid('c0000000', 5),
    ben: uid('c0000000', 6),
    priya: uid('c0000000', 7),
    omar: uid('c0000000', 8),
    nina: uid('c0000000', 9),
    alex: uid('c0000000', 10),
  },
  firmLinks: { harbour: uid('d0000000', 1), marina: uid('d0000000', 2), seaside: uid('d0000000', 3) },
  linkCodes: { parkside: uid('e0000000', 1) },
  notices: {
    seasideDraft: uid('f0000000', 1),
    seasidePendingReview: uid('f0000000', 2),
    seasideChangesRequested: uid('f0000000', 3),
    seasideApproved: uid('f0000000', 4),
    harbourPendingReview: uid('f0000000', 5),
  },
  chats: { jamesConversation: uid('11000000', 1) },
} as const;
