import { ensureMigrated } from '@/lib/db/client';
import { listMyGroups, createGroup } from '@/lib/groups/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default async function GroupsPage() {
  await ensureMigrated();

  let myGroups: Awaited<ReturnType<typeof listMyGroups>> = [];
  try {
    myGroups = await listMyGroups();
  } catch {
    // no_identity — buyer hasn't set up any groups yet
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Your groups</h1>
        <p className="text-sm text-muted-foreground">
          Organise your friends into groups to make inviting easier.
        </p>
      </header>

      {myGroups.length === 0 ? (
        <Card>
          <CardContent className="mx-auto max-w-md py-12 text-center">
            <h2 className="text-base font-medium">No groups yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Groups bundle friends together so you can invite a whole crew in one tap. Name
              your first one below.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {myGroups.map((g) => (
            <li key={g.id}>
              <Link
                href={`/gigs/groups/${g.slug}`}
                className="flex items-center justify-between rounded-md border bg-card px-4 py-3 text-sm hover:bg-accent"
              >
                <span className="font-medium">{g.name}</span>
                <span className="text-muted-foreground">
                  {g.memberCount} {g.memberCount === 1 ? 'person' : 'people'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create a group</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd: FormData) => {
              'use server';
              const name = fd.get('name') as string;
              if (!name?.trim()) return;
              await createGroup({ name: name.trim() });
            }}
            className="flex gap-2"
          >
            <input
              name="name"
              placeholder="Group name (e.g. Work mates)"
              required
              className="flex-1 rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700"
            >
              Create
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
