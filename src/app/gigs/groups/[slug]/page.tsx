import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, ensureMigrated } from '@/app/gigs/lib/db/client';
import { groups, recipients } from '@/app/gigs/lib/db/schema';
import {
  addRecipientToGroup,
  listGroupMembers,
  removeFromGroup,
} from '@/app/gigs/lib/groups/actions';
import { addRecipient } from '@/app/gigs/lib/events/actions';
import { checkEventOwner } from '@/app/gigs/lib/auth/owner';
import { auth } from '@/app/gigs/lib/auth/auth';
import { readAnonId } from '@/app/gigs/lib/anon/identity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/app/gigs/components/avatar';

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await ensureMigrated();
  const { slug } = await params;

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.slug, slug))
    .limit(1);

  if (!group) notFound();

  // Verify ownership.
  const session = await auth();
  const anonId = await readAnonId();
  const isOwner =
    (session?.user?.id && group.ownerUserId === session.user.id) ||
    (anonId && group.anonOwnerId === anonId);

  if (!isOwner) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          This group belongs to someone else.
        </CardContent>
      </Card>
    );
  }

  const memberRows = await listGroupMembers(group.id);

  // Address book — all recipients owned by this buyer, not yet in the group.
  const ownerUserId = group.ownerUserId;
  const ownerAnonId = group.anonOwnerId;
  const allRecipients = ownerUserId
    ? await db.select().from(recipients).where(eq(recipients.ownerUserId, ownerUserId))
    : ownerAnonId
      ? await db.select().from(recipients).where(eq(recipients.anonOwnerId, ownerAnonId))
      : [];

  const memberIds = new Set(memberRows.map((r) => r.recipient.id));
  const notInGroup = allRecipients.filter((r) => !memberIds.has(r.id));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
        <p className="text-sm text-muted-foreground">
          {memberRows.length} {memberRows.length === 1 ? 'person' : 'people'}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
        </CardHeader>
        <CardContent>
          {memberRows.length === 0 ? (
            <div className="mx-auto max-w-md py-8 text-center">
              <p className="text-sm font-medium">0 friends in this group yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {notInGroup.length > 0
                  ? 'Pick someone from your address book below, or add a new person.'
                  : 'Add your first friend using the form below.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-md border">
              {memberRows.map(({ recipient: r }) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 px-4 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Avatar name={r.displayName} size="sm" />
                    <span>
                      {r.displayName}{' '}
                      <span className="text-muted-foreground">({r.email})</span>
                    </span>
                  </span>
                  <form
                    action={async () => {
                      'use server';
                      await removeFromGroup({ groupId: group.id, recipientId: r.id });
                    }}
                  >
                    <button
                      type="submit"
                      className="text-xs text-destructive hover:underline"
                    >
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {notInGroup.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add from your address book</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {notInGroup.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-sm">
                  <form
                    action={async () => {
                      'use server';
                      await addRecipientToGroup({ groupId: group.id, recipientId: r.id });
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
                    >
                      Add
                    </button>
                  </form>
                  <span>
                    {r.displayName}{' '}
                    <span className="text-muted-foreground">({r.email})</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a new person</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd: FormData) => {
              'use server';
              // addRecipient handles default-group wiring; here we also add to THIS group.
              await addRecipient(fd);
              // Re-query to get the newly created recipient by email, then add to this group.
              const email = (fd.get('email') as string | null)?.toLowerCase();
              if (email) {
                const ownerFilter = ownerUserId
                  ? eq(recipients.ownerUserId, ownerUserId)
                  : eq(recipients.anonOwnerId, ownerAnonId!);
                const [rec] = await db
                  .select()
                  .from(recipients)
                  .where(
                    eq(recipients.email, email),
                  )
                  .limit(1);
                if (rec) {
                  await addRecipientToGroup({ groupId: group.id, recipientId: rec.id });
                }
              }
            }}
            className="flex gap-2"
          >
            <input
              name="displayName"
              placeholder="Name"
              required
              className="flex-1 rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
            />
            <input
              name="email"
              type="email"
              placeholder="email@example.com"
              required
              className="flex-1 rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded bg-neutral-800 px-3 text-sm hover:bg-neutral-700"
            >
              Add
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
