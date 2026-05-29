import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, ensureMigrated } from '@/lib/db/client';
import { groups } from '@/lib/db/schema';

type Props = {
  children: React.ReactNode;
  params: Promise<{ uuid: string }>;
};

export const dynamic = 'force-dynamic';

/**
 * Gate every /group/[uuid]/* route on a real group row. Doing this in the
 * layout (not the page) means notFound() fires before the page-level
 * loading.tsx triggers a Suspense boundary, so the HTTP response stays 404.
 */
export default async function GroupLayout({ children, params }: Props) {
  const { uuid } = await params;
  await ensureMigrated();
  const [group] = await db.select().from(groups).where(eq(groups.id, uuid)).limit(1);
  if (!group) notFound();
  return <>{children}</>;
}
