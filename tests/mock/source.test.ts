import { describe, it, expect } from 'vitest';
import { seed } from '@/mock/store';
import { IDS } from '@/mock/data';
import { NotFoundError } from '@/lib/errors';
import {
  workspace,
  buildingWorkspace,
  listResource,
  conversation,
  firmLinkStatus,
  firmOrganizations,
  firmReviewInbox,
} from '@/mock/source';
describe('mock source: workspace', () => {
  it('gives each persona the buildings they can access', () => {
    const s = seed();
    expect(
      workspace(s, IDS.users.dana)
        .buildings.map((b) => b.id)
        .sort(),
    ).toEqual([IDS.buildings.harbour, IDS.buildings.marina, IDS.buildings.seaside].sort());
    expect(
      workspace(s, IDS.users.sarah)
        .buildings.map((b) => b.id)
        .sort(),
    ).toEqual([IDS.buildings.harbour, IDS.buildings.marina, IDS.buildings.seaside].sort());
    expect(workspace(s, IDS.users.james).buildings.map((b) => b.id)).toEqual([IDS.buildings.seaside]);
    expect(workspace(s, IDS.users.priya).buildings.map((b) => b.id)).toEqual([IDS.buildings.seaside]);
  });
  it('only lists organizations the user is an active member of', () => {
    const s = seed();
    expect(workspace(s, IDS.users.james).organizations.map((o) => o.id)).toEqual([IDS.orgs.seasideOrg]);
    expect(workspace(s, IDS.users.priya).organizations).toEqual([]);
  });
  it('resolves email from the matching persona', () => {
    const s = seed();
    expect(workspace(s, IDS.users.sarah).email).toBe('sarah.chen@coastlinestrata.example');
  });
});
describe('mock source: buildingWorkspace', () => {
  it("throws NotFoundError for a building outside the caller's access", () => {
    const s = seed();
    expect(() => buildingWorkspace(s, IDS.users.sarah, IDS.buildings.parkside)).toThrow(NotFoundError);
    expect(() => buildingWorkspace(s, IDS.users.priya, IDS.buildings.harbour)).toThrow(NotFoundError);
  });
  it('marks a firm-linked staff member as a linked member, not the on-site manager', () => {
    const s = seed();
    expect(buildingWorkspace(s, IDS.users.sarah, IDS.buildings.seaside).linkedMember).toBe(true);
    expect(buildingWorkspace(s, IDS.users.james, IDS.buildings.seaside).linkedMember).toBe(false);
  });
  it("carries the caller's permissions for that building's role", () => {
    const s = seed();
    const w = buildingWorkspace(s, IDS.users.james, IDS.buildings.seaside);
    expect(w.permissions).toContain('document.draft');
    expect(w.permissions).not.toContain('review.act');
  });
  it('counts only unread updates the caller can read', () => {
    const s = seed();
    expect(buildingWorkspace(s, IDS.users.james, IDS.buildings.seaside).unreadUpdates).toBeGreaterThan(0);
    expect(buildingWorkspace(s, IDS.users.priya, IDS.buildings.seaside).unreadUpdates).toBe(0);
  });
});
describe('mock source: listResource', () => {
  it('hides every firm/staff resource from a resident', () => {
    const s = seed();
    for (const resource of ['notices', 'disputes', 'audit', 'invitations'] as const) {
      expect(listResource(s, IDS.users.priya, resource, IDS.buildings.seaside)).toEqual([]);
    }
  });
  it('shows a resident only owner-visible documents, projected to the real columns', () => {
    const s = seed();
    const docs = listResource(s, IDS.users.priya, 'documents', IDS.buildings.seaside);
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every((d) => 'owner_visible' in d)).toBe(false);
    expect(docs.every((d) => 'title' in d)).toBe(true);
  });
  it('gives the building manager the full member list but only their own row without member.read', () => {
    const s = seed();
    const asManager = listResource(s, IDS.users.james, 'members', IDS.buildings.seaside);
    expect(asManager.length).toBeGreaterThan(1);
    const asResident = listResource(s, IDS.users.priya, 'members', IDS.buildings.seaside);
    expect(asResident.map((m) => m.user_id)).toEqual([IDS.users.priya]);
    expect(asResident.every((m) => !('unit' in m))).toBe(true);
  });
  it('only ever returns a chat to the user who owns it', () => {
    const s = seed();
    expect(listResource(s, IDS.users.james, 'chats', IDS.buildings.seaside).map((c) => c.id)).toEqual([
      IDS.chats.jamesConversation,
    ]);
    expect(listResource(s, IDS.users.priya, 'chats', IDS.buildings.seaside)).toEqual([]);
  });
});
describe('mock source: conversation', () => {
  it('returns the chat and its messages for the owning user', () => {
    const s = seed();
    const { chat, messages } = conversation(s, IDS.users.james, IDS.chats.jamesConversation);
    expect(chat.id).toBe(IDS.chats.jamesConversation);
    expect(messages.length).toBe(2);
  });
  it('throws NotFoundError for anyone else', () => {
    const s = seed();
    expect(() => conversation(s, IDS.users.priya, IDS.chats.jamesConversation)).toThrow(NotFoundError);
  });
});
describe('mock source: firm links', () => {
  it("reports active/invited/none from the caller's own building", () => {
    const s = seed();
    expect(firmLinkStatus(s, IDS.users.james, IDS.buildings.seaside)?.status).toBe('active');
    expect(firmLinkStatus(s, IDS.users.omar, IDS.buildings.parkside)?.status).toBe('invited');
    expect(firmLinkStatus(s, IDS.users.priya, IDS.buildings.seaside)).toBeNull();
  });
  it('lists only the firm orgs the caller can act for', () => {
    const s = seed();
    expect(firmOrganizations(s, IDS.users.sarah).map((o) => o.id)).toEqual([IDS.orgs.coastline]);
    expect(firmOrganizations(s, IDS.users.james)).toEqual([]);
  });
  it("puts pending firm reviews only in a linked reviewer's inbox", () => {
    const s = seed();
    expect(firmReviewInbox(s, IDS.users.sarah).length).toBe(2);
    expect(firmReviewInbox(s, IDS.users.james)).toEqual([]);
  });
});
