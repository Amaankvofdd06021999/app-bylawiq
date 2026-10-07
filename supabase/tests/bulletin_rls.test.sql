-- RLS tests for bulletin_posts table
-- Tests verify that users from Building A cannot access Building B's data

BEGIN;
SELECT plan(18);

-- Setup: Create test users and buildings
INSERT INTO auth.users (id, email) VALUES
  ('user-a-manager'::uuid, 'manager-a@test.local'),
  ('user-b-manager'::uuid, 'manager-b@test.local'),
  ('user-a-resident'::uuid, 'resident-a@test.local'),
  ('user-b-resident'::uuid, 'resident-b@test.local');

INSERT INTO public.buildings (id, name, address, city)
VALUES
  ('building-a'::uuid, 'Building A', '123 Main St', 'Vancouver'),
  ('building-b'::uuid, 'Building B', '456 Oak Ave', 'Vancouver');

INSERT INTO public.building_members (user_id, building_id, role)
VALUES
  ('user-a-manager'::uuid, 'building-a'::uuid, 'building_manager'),
  ('user-b-manager'::uuid, 'building-b'::uuid, 'building_manager'),
  ('user-a-resident'::uuid, 'building-a'::uuid, 'owner_resident'),
  ('user-b-resident'::uuid, 'building-b'::uuid, 'owner_resident');

-- Setup: Create test posts
INSERT INTO public.bulletin_posts (id, building_id, title, body, author_id)
VALUES
  ('post-a-1'::uuid, 'building-a'::uuid, 'Post A1', 'Body A1', 'user-a-manager'::uuid),
  ('post-a-2'::uuid, 'building-a'::uuid, 'Post A2', 'Body A2', 'user-a-resident'::uuid),
  ('post-b-1'::uuid, 'building-b'::uuid, 'Post B1', 'Body B1', 'user-b-manager'::uuid),
  ('post-b-2'::uuid, 'building-b'::uuid, 'Post B2', 'Body B2', 'user-b-resident'::uuid);

-- Test 1: Manager from Building A can read own building posts
SET SESSION "request.jwt.claims" TO json_build_object('sub', 'user-a-manager'::text);
SELECT is(
  (SELECT COUNT(*) FROM public.bulletin_posts),
  2::bigint,
  'Manager from Building A can read exactly 2 posts (own building only)'
);

-- Test 2: Manager from Building A cannot read Building B posts
SELECT is(
  (SELECT COUNT(*) FROM public.bulletin_posts WHERE building_id = 'building-b'::uuid),
  0::bigint,
  'Manager from Building A cannot read Building B posts'
);

-- Test 3: Resident from Building A can read own building posts
SET SESSION "request.jwt.claims" TO json_build_object('sub', 'user-a-resident'::text);
SELECT is(
  (SELECT COUNT(*) FROM public.bulletin_posts),
  2::bigint,
  'Resident from Building A can read exactly 2 posts (own building only)'
);

-- Test 4: Resident from Building B cannot read Building A posts
SET SESSION "request.jwt.claims" TO json_build_object('sub', 'user-b-resident'::text);
SELECT is(
  (SELECT COUNT(*) FROM public.bulletin_posts WHERE building_id = 'building-a'::uuid),
  0::bigint,
  'Resident from Building B cannot read Building A posts'
);

-- Test 5: Manager can insert post in own building
SET SESSION "request.jwt.claims" TO json_build_object('sub', 'user-a-manager'::text);
INSERT INTO public.bulletin_posts (id, building_id, title, body, author_id)
VALUES ('post-a-3'::uuid, 'building-a'::uuid, 'Post A3', 'Body A3', 'user-a-manager'::uuid);

SELECT is(
  (SELECT COUNT(*) FROM public.bulletin_posts WHERE author_id = 'user-a-manager'::uuid),
  2::bigint,
  'Manager can successfully insert post in own building'
);

-- Test 6: Manager cannot insert post in other building
SET SESSION "request.jwt.claims" TO json_build_object('sub', 'user-a-manager'::text);
-- This should fail due to RLS policy
-- Expected: 0 rows inserted

-- Test 7: Resident cannot insert post (even in own building)
SET SESSION "request.jwt.claims" TO json_build_object('sub', 'user-a-resident'::text);
-- This should fail due to RLS policy requiring non-resident role
-- Expected: 0 rows inserted

-- Test 8: Manager can update own post
SET SESSION "request.jwt.claims" TO json_build_object('sub', 'user-a-manager'::text);
UPDATE public.bulletin_posts SET title = 'Updated Title' WHERE id = 'post-a-1'::uuid;

SELECT is(
  (SELECT title FROM public.bulletin_posts WHERE id = 'post-a-1'::uuid),
  'Updated Title'::text,
  'Manager can update own post'
);

-- Test 9: Manager can update other staff posts
SET SESSION "request.jwt.claims" TO json_build_object('sub', 'user-a-manager'::uuid);
UPDATE public.bulletin_posts SET title = 'Manager Updated' WHERE id = 'post-a-2'::uuid;

SELECT is(
  (SELECT title FROM public.bulletin_posts WHERE id = 'post-a-2'::uuid),
  'Manager Updated'::text,
  'Manager can update posts from other authors in same building'
);

-- Test 10: Resident cannot update post (even own post)
SET SESSION "request.jwt.claims" TO json_build_object('sub', 'user-a-resident'::uuid);
-- This should fail due to RLS policy preventing resident updates
-- Expected: 0 rows updated

-- Test 11: Manager cannot update post from other building
SET SESSION "request.jwt.claims" TO json_build_object('sub', 'user-a-manager'::uuid);
UPDATE public.bulletin_posts SET title = 'Hack Attempt' WHERE id = 'post-b-1'::uuid;

SELECT is(
  (SELECT title FROM public.bulletin_posts WHERE id = 'post-b-1'::uuid),
  'Post B1'::text,
  'Manager from Building A cannot update Building B posts'
);

-- Test 12: Manager can delete own post
SET SESSION "request.jwt.claims" TO json_build_object('sub', 'user-a-manager'::uuid);
DELETE FROM public.bulletin_posts WHERE id = 'post-a-3'::uuid;

SELECT is(
  (SELECT deleted_at FROM public.bulletin_posts WHERE id = 'post-a-3'::uuid IS NOT NULL),
  true,
  'Manager can soft-delete own post'
);

-- Test 13: Manager can delete other staff posts
SET SESSION "request.jwt.claims" TO json_build_object('sub', 'user-a-manager'::uuid);
DELETE FROM public.bulletin_posts WHERE id = 'post-a-2'::uuid;

SELECT is(
  (SELECT deleted_at FROM public.bulletin_posts WHERE id = 'post-a-2'::uuid IS NOT NULL),
  true,
  'Manager can soft-delete posts from other authors'
);

-- Test 14: Manager cannot delete post from other building
SET SESSION "request.jwt.claims" TO json_build_object('sub', 'user-a-manager'::uuid);
DELETE FROM public.bulletin_posts WHERE id = 'post-b-1'::uuid;

SELECT is(
  (SELECT deleted_at FROM public.bulletin_posts WHERE id = 'post-b-1'::uuid IS NULL),
  true,
  'Manager from Building A cannot delete Building B posts'
);

-- Test 15: Soft-deleted posts not readable
SET SESSION "request.jwt.claims" TO json_build_object('sub', 'user-a-manager'::uuid);
SELECT is(
  (SELECT COUNT(*) FROM public.bulletin_posts WHERE deleted_at IS NULL),
  1::bigint,
  'Soft-deleted posts are excluded from queries'
);

-- Test 16: Unauthenticated user cannot read posts
RESET "request.jwt.claims";
-- This should return 0 rows due to RLS
SELECT is(
  (SELECT COUNT(*) FROM public.bulletin_posts),
  0::bigint,
  'Unauthenticated user cannot read any posts'
);

-- Test 17: Non-member user cannot read posts
SET SESSION "request.jwt.claims" TO json_build_object('sub', 'user-c-nonmember'::text);
-- This should return 0 rows
SELECT is(
  (SELECT COUNT(*) FROM public.bulletin_posts),
  0::bigint,
  'Non-member user cannot read posts from any building'
);

-- Test 18: Verify indexes exist for performance
SELECT has_index(
  'public',
  'bulletin_posts',
  'idx_bulletin_posts_building_id',
  'Index on building_id exists for fast building-scoped queries'
);

-- Cleanup
DELETE FROM public.bulletin_posts;
DELETE FROM public.building_members;
DELETE FROM public.buildings;
DELETE FROM auth.users;

SELECT * FROM finish();
ROLLBACK;
