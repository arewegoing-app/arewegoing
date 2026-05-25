export default function GigsLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 py-6" aria-busy="true" aria-live="polite">
      <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 w-full animate-pulse rounded-lg bg-muted/60" />
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
