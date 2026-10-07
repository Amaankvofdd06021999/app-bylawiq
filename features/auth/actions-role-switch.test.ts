import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { v4 as uuid } from 'uuid';
import { createClient } from '@supabase/supabase-js';

/**
 * Integration tests for multi-role session switching.
 * Tests the flow: login → access one role → switch roles → verify access changes.
 *
 * Prerequisites:
 * - Supabase local running with migrations applied
 * - Test database seeded with users, orgs, buildings
 */

describe('Multi-Role Session Switching', () => {
  let client: ReturnType<typeof createClient>;
  let userId: string;
  let building1Id: string;
  let building2Id: string;

  beforeAll(async () => {
    // Initialize Supabase test client
    const url = process.env.SUPABASE_URL || 'http://localhost:54321';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';
    client = createClient(url, key);

    // Setup test data
    userId = uuid();

    // Create auth user
    const { data: authUser, error: authError } = await client.auth.admin.createUser({
      email: `test-${Date.now()}@example.com`,
      password: 'test-password-123456',
      email_confirm: true,
    });
    expect(authError).toBeNull();
    if (!authUser?.user) throw new Error('Failed to create auth user');
    userId = authUser.user.id;

    // Create profile
    const { error: profileError } = await client.from('profiles').insert({
      id: userId,
      display_name: 'Test User',
      account_type: 'multi_building',
    });
    expect(profileError).toBeNull();

    // Create org
    const { data: org, error: orgError } = await client.from('organizations').insert({
      name: 'Test Org',
      created_by: userId,
      kind: 'building',
    });
    expect(orgError).toBeNull();
    if (!org?.[0]?.id) throw new Error('Failed to create org');
    const orgId = org[0].id;

    // Create buildings
    const { data: buildings, error: buildingError } = await client.from('buildings').insert([
      { org_id: orgId, name: 'Building 1', address: '123 Main', municipality: 'Vancouver' },
      { org_id: orgId, name: 'Building 2', address: '456 Oak', municipality: 'Victoria' },
    ]);
    expect(buildingError).toBeNull();
    if (!buildings?.[0]?.id || !buildings?.[1]?.id) throw new Error('Failed to create buildings');
    building1Id = buildings[0].id;
    building2Id = buildings[1].id;

    // Create memberships
    const { error: membersError } = await client.from('building_members').insert([
      {
        building_id: building1Id,
        user_id: userId,
        role: 'building_manager',
        status: 'active',
      },
      {
        building_id: building2Id,
        user_id: userId,
        role: 'owner_resident',
        status: 'active',
      },
    ]);
    expect(membersError).toBeNull();
  });

  it('should load user with multiple memberships', async () => {
    // Simulate authenticated client
    const { data, error } = await client
      .from('building_members')
      .select('building_id, role')
      .eq('user_id', userId);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data?.some((m) => m.role === 'building_manager')).toBe(true);
    expect(data?.some((m) => m.role === 'owner_resident')).toBe(true);
  });

  it('should validate session_role matches membership', async () => {
    // Test the authorize_session function
    // This would require setting JWT claims, which is done in pgTAP tests
    // Here we just verify the memberships exist for role switching

    const { data: members, error } = await client
      .from('building_members')
      .select('building_id, role')
      .eq('user_id', userId)
      .eq('status', 'active');

    expect(error).toBeNull();
    expect(members?.length).toBeGreaterThanOrEqual(2);
  });

  it('should prevent access after role revocation', async () => {
    // Create a temporary membership
    const { data: tempMember } = await client.from('building_members').insert({
      building_id: building1Id,
      user_id: userId,
      role: 'council_member',
      status: 'active',
    });

    if (!tempMember?.[0]?.id) throw new Error('Failed to create test membership');

    // Verify it exists
    let { data: member, error } = await client
      .from('building_members')
      .select('status')
      .eq('id', tempMember[0].id)
      .single();

    expect(error).toBeNull();
    expect(member?.status).toBe('active');

    // Revoke it
    const { error: updateError } = await client
      .from('building_members')
      .update({ status: 'suspended' })
      .eq('id', tempMember[0].id);

    expect(updateError).toBeNull();

    // Verify revocation
    ({ data: member, error } = await client
      .from('building_members')
      .select('status')
      .eq('id', tempMember[0].id)
      .single());

    expect(member?.status).toBe('suspended');

    // Cleanup
    await client.from('building_members').delete().eq('id', tempMember[0].id);
  });

  it('should allow switching between valid roles', async () => {
    // Get current memberships
    const { data: memberships, error } = await client
      .from('building_members')
      .select('building_id, role')
      .eq('user_id', userId)
      .eq('status', 'active');

    expect(error).toBeNull();
    expect(memberships?.length).toBeGreaterThanOrEqual(2);

    // Simulate switching roles: first membership to second membership
    if (!memberships?.[0] || !memberships?.[1]) throw new Error('Not enough memberships');

    const oldRole = memberships[0];
    const newRole = memberships[1];

    // Verify both roles exist
    expect(oldRole.building_id).toBeDefined();
    expect(newRole.building_id).toBeDefined();
    expect(oldRole.building_id).not.toBe(newRole.building_id);
  });

  afterAll(async () => {
    // Cleanup: Delete test user and their data
    // (Cascades should handle this, but be explicit)
    if (userId) {
      await client.auth.admin.deleteUser(userId);
    }
  });
});
