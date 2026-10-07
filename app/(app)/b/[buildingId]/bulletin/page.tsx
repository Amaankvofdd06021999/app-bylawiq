import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { BulletinFeed } from '@/features/bulletin/components/bulletin-feed';
import { CreatePostForm } from '@/features/bulletin/components/create-post-form';
import { getBulletinFeed } from '@/features/bulletin/bulletin-queries';

interface Props {
  params: Promise<{ buildingId: string }>;
}

export default async function BulletinPage({ params }: Props) {
  const { buildingId } = await params;
  const user = await requireUser();

  const db = await createClient();

  // Get building info
  const { data: building } = await db
    .from('buildings')
    .select('id, name')
    .eq('id', buildingId)
    .single();

  if (!building) {
    redirect('/');
  }

  // Check user membership
  const { data: member } = await db
    .from('building_members')
    .select('role')
    .eq('building_id', buildingId)
    .eq('user_id', user.id)
    .single();

  if (!member) {
    redirect('/');
  }

  const isStaff = member.role !== 'owner_resident';

  // Get bulletin posts
  const posts = await getBulletinFeed({
    buildingId,
    limit: 100,
    offset: 0,
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Building Bulletin</h1>
        <p className="subtitle">{building.name}</p>
      </div>

      <div className="page-content">
        {isStaff && (
          <section className="create-section">
            <h2>Create New Post</h2>
            <CreatePostForm buildingId={buildingId} />
          </section>
        )}

        <section className="feed-section">
          <h2>Recent Posts</h2>
          <BulletinFeed posts={posts} isStaff={isStaff} />
        </section>
      </div>

      <style jsx>{`
        .page-container {
          max-width: 900px;
          margin: 0 auto;
          padding: 2rem 1rem;
        }

        .page-header {
          margin-bottom: 2rem;
        }

        .page-header h1 {
          margin: 0 0 0.5rem 0;
          font-size: 2rem;
          font-weight: 700;
          color: #1f2937;
        }

        .subtitle {
          margin: 0;
          color: #666;
          font-size: 0.95rem;
        }

        .page-content {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .create-section {
          background: #f9fafb;
          padding: 1.5rem;
          border-radius: 8px;
        }

        .create-section h2 {
          margin: 0 0 1rem 0;
          font-size: 1.25rem;
          color: #1f2937;
        }

        .feed-section h2 {
          margin: 0 0 1.5rem 0;
          font-size: 1.25rem;
          color: #1f2937;
        }

        @media (max-width: 640px) {
          .page-container {
            padding: 1rem;
          }

          .page-header h1 {
            font-size: 1.5rem;
          }

          .create-section {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
