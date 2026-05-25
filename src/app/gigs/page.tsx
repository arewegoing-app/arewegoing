import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from './lib/auth/auth';
import { db } from './lib/db/client';
import { events } from './lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export default async function GigsHome() {
  const session = await auth();
  if (!session?.user?.id) redirect('/gigs/signin');
  const list = await db.select().from(events).where(eq(events.ownerUserId, session.user.id)).orderBy(desc(events.createdAt));
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your events</h1>
        <Link href="/gigs/new" className="rounded bg-emerald-600 px-4 py-2 text-sm">New event</Link>
      </div>
      {list.length === 0 ? (
        <p className="text-neutral-400">No events yet. Create one to rally your crew.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((e) => (
            <li key={e.id} className="rounded border border-neutral-800 p-4">
              <Link href={`/gigs/e/${e.slug}`} className="font-medium hover:text-emerald-400">{e.title}</Link>
              <div className="text-sm text-neutral-400">
                {e.venue ?? '—'} · {e.startsAt ? new Date(e.startsAt).toLocaleDateString('en-NZ') : 'TBD'}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
