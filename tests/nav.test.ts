import { describe, it, expect } from 'vitest';
import { visibleNav } from '@/components/shell';
// Render-free coverage for the nav filtering (spec §3.5): a permission list hides the items that need a
// permission the caller lacks, same as `Shell` does for its sidebar and phone tab bar.
describe('visibleNav', () => {
  it('shows every item when no permissions list is given (the overview, no building)', () => {
    const slugs = visibleNav(undefined).map(([slug]) => slug);
    expect(slugs).toEqual([
      'ask',
      'bylaws',
      'documents',
      'notices',
      'disputes',
      'updates',
      'agents',
      'knowledge',
      'members',
      'settings',
    ]);
  });
  it('shows only documents and settings for a resident (building.read, vault.read)', () => {
    const slugs = visibleNav(['building.read', 'vault.read']).map(([slug]) => slug);
    expect(slugs).toEqual(['documents', 'settings']);
  });
  it('adds Ask for a demo resident with paid Ask (chat.resident), and nothing else staff-only', () => {
    const slugs = visibleNav(['building.read', 'vault.read', 'chat.resident']).map(([slug]) => slug);
    expect(slugs).toEqual(['ask', 'documents', 'settings']);
  });
  it('adds Knowledge for demo firm staff who read firm knowledge without agent.manage (an assistant)', () => {
    const assistant = ['building.read', 'vault.read', 'chat.use', 'dispute.read', 'member.read'];
    expect(visibleNav(assistant).map(([slug]) => slug)).not.toContain('knowledge');
    expect(visibleNav(assistant, true).map(([slug]) => slug)).toContain('knowledge');
  });
  it('includes notices, members and agents for a building manager', () => {
    const slugs = visibleNav([
      'building.read',
      'vault.read',
      'vault.upload',
      'vault.delete',
      'chat.use',
      'bylaw.edit',
      'bylaw.adopt',
      'document.draft',
      'document.approve',
      'document.send',
      'dispute.read',
      'dispute.create',
      'dispute.update',
      'member.read',
      'member.invite',
      'member.update_role',
      'member.remove',
      'audit.read',
      'agent.manage',
      'agent.deploy',
      'building.link_firm',
    ]).map(([slug]) => slug);
    expect(slugs).toContain('notices');
    expect(slugs).toContain('members');
    expect(slugs).toContain('agents');
  });
});
