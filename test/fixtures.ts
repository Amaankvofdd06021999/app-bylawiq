/**
 * Test fixtures and factories for bulletin tests
 * Provides reusable test data and setup/teardown helpers
 */

import { createClient } from '@/lib/supabase/server';

export interface TestUser {
  id: string;
  email: string;
  role: string;
}

export interface TestBuilding {
  id: string;
  name: string;
}

export interface TestPost {
  id: string;
  buildingId: string;
  title: string;
  body: string;
  authorId: string;
  pinned: boolean;
}

/**
 * Factory functions to create test users
 */
export const createTestUsers = () => ({
  managerA: {
    id: 'user-manager-a-uuid-xxxx-xxxx',
    email: 'manager-a@test.local',
    role: 'building_manager',
  } as TestUser,
  managerB: {
    id: 'user-manager-b-uuid-xxxx-xxxx',
    email: 'manager-b@test.local',
    role: 'building_manager',
  } as TestUser,
  residentA: {
    id: 'user-resident-a-uuid-xxxx-xxxx',
    email: 'resident-a@test.local',
    role: 'owner_resident',
  } as TestUser,
  residentB: {
    id: 'user-resident-b-uuid-xxxx-xxxx',
    email: 'resident-b@test.local',
    role: 'owner_resident',
  } as TestUser,
});

/**
 * Factory functions to create test buildings
 */
export const createTestBuildings = () => ({
  buildingA: {
    id: 'building-a-uuid-xxxx-xxxx',
    name: 'Test Building A',
  } as TestBuilding,
  buildingB: {
    id: 'building-b-uuid-xxxx-xxxx',
    name: 'Test Building B',
  } as TestBuilding,
});

/**
 * Factory functions to create test posts
 */
export const createTestPosts = () => ({
  postA1: {
    id: 'post-a-1-uuid-xxxx-xxxx',
    buildingId: 'building-a-uuid-xxxx-xxxx',
    title: 'Announcement: Building Maintenance',
    body: 'The building will undergo maintenance on Saturday.',
    authorId: 'user-manager-a-uuid-xxxx-xxxx',
    pinned: true,
  } as TestPost,
  postA2: {
    id: 'post-a-2-uuid-xxxx-xxxx',
    buildingId: 'building-a-uuid-xxxx-xxxx',
    title: 'Welcome New Residents',
    body: 'Welcome to our community. Please review the bylaws.',
    authorId: 'user-resident-a-uuid-xxxx-xxxx',
    pinned: false,
  } as TestPost,
  postB1: {
    id: 'post-b-1-uuid-xxxx-xxxx',
    buildingId: 'building-b-uuid-xxxx-xxxx',
    title: 'AGM Scheduled',
    body: 'Annual General Meeting on next month.',
    authorId: 'user-manager-b-uuid-xxxx-xxxx',
    pinned: true,
  } as TestPost,
});

/**
 * Setup helper: Create test data in database
 */
export async function setupTestData() {
  const db = await createClient();
  const users = createTestUsers();
  const buildings = createTestBuildings();
  const posts = createTestPosts();

  try {
    // Insert users
    await db.auth.admin.createUser({
      email: users.managerA.email,
      email_confirm: true,
      user_metadata: {},
    });

    // Insert buildings
    const { error: buildingError } = await db
      .from('buildings')
      .insert([buildings.buildingA, buildings.buildingB]);

    if (buildingError) throw buildingError;

    // Insert building members
    const { error: memberError } = await db
      .from('building_members')
      .insert([
        {
          user_id: users.managerA.id,
          building_id: buildings.buildingA.id,
          role: users.managerA.role,
        },
        {
          user_id: users.managerB.id,
          building_id: buildings.buildingB.id,
          role: users.managerB.role,
        },
        {
          user_id: users.residentA.id,
          building_id: buildings.buildingA.id,
          role: users.residentA.role,
        },
        {
          user_id: users.residentB.id,
          building_id: buildings.buildingB.id,
          role: users.residentB.role,
        },
      ]);

    if (memberError) throw memberError;

    // Insert posts
    const { error: postError } = await db
      .from('bulletin_posts')
      .insert([posts.postA1, posts.postA2, posts.postB1]);

    if (postError) throw postError;

    return { users, buildings, posts };
  } catch (error) {
    console.error('Failed to setup test data:', error);
    throw error;
  }
}

/**
 * Teardown helper: Clean up test data
 */
export async function teardownTestData() {
  const db = await createClient();

  try {
    // Delete posts
    await db.from('bulletin_posts').delete().match({});

    // Delete building members
    await db.from('building_members').delete().match({});

    // Delete buildings
    await db.from('buildings').delete().match({});

    // Note: Auth users cleanup handled by test framework
  } catch (error) {
    console.error('Failed to teardown test data:', error);
    throw error;
  }
}

/**
 * Helper: Get posts visible to a specific user
 * Simulates RLS by filtering by building membership
 */
export async function getVisiblePosts(userId: string) {
  const db = await createClient();

  const { data, error } = await db
    .from('bulletin_posts')
    .select(`
      id,
      building_id,
      title,
      body,
      author_id,
      pinned,
      deleted_at,
      created_at,
      updated_at
    `)
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (error) throw error;
  return data || [];
}

/**
 * Helper: Assert user can see specific post
 */
export async function assertCanSeePost(userId: string, postId: string) {
  const posts = await getVisiblePosts(userId);
  const canSee = posts.some((p: any) => p.id === postId);
  if (!canSee) {
    throw new Error(
      `User ${userId} cannot see post ${postId} (RLS violation or post deleted)`
    );
  }
}

/**
 * Helper: Assert user cannot see specific post
 */
export async function assertCannotSeePost(userId: string, postId: string) {
  const posts = await getVisiblePosts(userId);
  const canSee = posts.some((p: any) => p.id === postId);
  if (canSee) {
    throw new Error(`User ${userId} can see post ${postId} (RLS failed)`);
  }
}

/**
 * Helper: Set JWT claims for RLS testing
 * In integration tests, this simulates the authenticated user
 */
export function setUserContext(userId: string) {
  // In real tests, this would set the JWT token
  // For Supabase, use the auth session
  return {
    userId,
    context: { sub: userId },
  };
}

/**
 * Helper: Create test auth token
 */
export function createTestToken(userId: string, expiresIn: number = 3600) {
  // This would normally use JWT signing
  // For Supabase, use the session system
  return {
    access_token: `test-token-${userId}`,
    expires_in: expiresIn,
  };
}
