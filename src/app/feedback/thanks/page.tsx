import Link from 'next/link';

export default function FeedbackThanksPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <div className="max-w-sm w-full rounded-xl border border-white/10 bg-white/5 p-8 text-center">
        <div className="text-4xl mb-4">★</div>
        <h1 className="text-xl font-semibold mb-2">Thanks for the feedback</h1>
        <p className="text-sm text-white/60">
          Noted. It helps figure out whether to go back next time.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          Back to gigs
        </Link>
      </div>
    </main>
  );
}
