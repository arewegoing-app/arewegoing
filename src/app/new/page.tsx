import { auth } from '@/lib/auth/auth';
import { EventForm } from './event-form';

export const dynamic = 'force-dynamic';

export default async function NewEventPage() {
  const session = await auth();
  const signedIn = !!session?.user?.id;
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="pt-2 pb-6">
        <div className="u-mono opacity-50">[00] / New event</div>
        <h1
          className="u-display mt-2"
          style={{ fontSize: 'clamp(2.25rem, 8vw, 4.5rem)' }}
        >
          Add a{' '}
          <em className="not-italic u-accent-bg">gig</em>
          <br />
          to the calendar.
        </h1>
        <p className="mt-4 max-w-prose leading-snug">
          Paste a Humanitix / Moshtix / UTR / Eventfinda URL and we&apos;ll autofill the rest. No
          signin required — your event is linked to this browser via cookie so you can revisit and
          invite people.
        </p>
      </div>

      <EventForm signedIn={signedIn} />
    </div>
  );
}
