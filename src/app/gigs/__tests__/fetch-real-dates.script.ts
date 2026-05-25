// One-shot dev script: hit every URL in seed-urls.ts via the live ingest
// pipeline and print whatever metadata comes back. Used to audit and fix the
// hardcoded values in known-events.ts.
//
// Usage:  npx tsx src/app/gigs/__tests__/fetch-real-dates.script.ts

import { ingest } from '../lib/ingest/fetch';
import { seedUrls } from '../lib/discovery/seed-urls';

async function main() {
  const fmt = (s: string | undefined) =>
    s ? new Date(s).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

  for (const url of seedUrls) {
    process.stdout.write(`${url}\n`);
    try {
      const r = await Promise.race([
        ingest(url),
        new Promise<{ ok: false; reason: 'timeout' }>((res) => setTimeout(() => res({ ok: false, reason: 'timeout' }), 10_000)),
      ]);
      if (r.ok) {
        process.stdout.write(`  ✓ ${r.metadata.title}\n`);
        process.stdout.write(`    venue: ${r.metadata.venue ?? '—'} · ${r.metadata.city ?? '—'}\n`);
        process.stdout.write(`    when:  ${fmt(r.metadata.startsAt)}  (raw: ${r.metadata.startsAt ?? 'none'})\n`);
        process.stdout.write(`    price: ${r.metadata.priceLow ?? '—'}\n`);
      } else {
        process.stdout.write(`  ✗ failed: ${r.reason}${'message' in r && r.message ? ` (${r.message})` : ''}\n`);
      }
    } catch (e) {
      process.stdout.write(`  ✗ error: ${e instanceof Error ? e.message : String(e)}\n`);
    }
    process.stdout.write('\n');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
