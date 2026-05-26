import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { EventForm } from './event-form';

export default async function NewEventPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">New event</h1>
      <EventForm />
    </div>
  );
}
