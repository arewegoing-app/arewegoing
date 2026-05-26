import { strict as assert } from 'node:assert';
import { rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

process.env.GIGS_TOKEN_SECRET = 'unit-test-secret';

const DATA_DIR = join(process.cwd(), '.gigs-data');
if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

async function main() {
  const { db, ensureMigrated } = await import('@/lib/db/client');
  await ensureMigrated();
  const schema = await import('@/lib/db/schema');
  const { GET } = await import('@/app/e/[slug]/ics/route');

  const [user] = await db.insert(schema.users).values({ email: 'b@t', name: 'Buyer' }).returning();
  const [event] = await db
    .insert(schema.events)
    .values({
      slug: 'ics-test',
      ownerUserId: user.id,
      title: "Pally's, Rhythm; Ribbons",
      venue: 'Afters.',
      city: 'Wellington',
      startsAt: new Date('2026-05-31T08:00:00.000Z'),
      ticketUrl: 'https://www.undertheradar.co.nz/gig/102582/Pallys---Rhythm-For-Ribbons.utr',
    })
    .returning();

  const res = await GET(new Request(`http://localhost/gigs/e/${event.slug}/ics`), { params: Promise.resolve({ slug: event.slug }) });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/calendar; charset=utf-8');
  const body = await res.text();
  assert.ok(body.startsWith('BEGIN:VCALENDAR'), 'VCALENDAR opener');
  assert.ok(body.includes('BEGIN:VEVENT'), 'has VEVENT');
  assert.ok(body.includes('SUMMARY:Pally\\\'s\\, Rhythm\\; Ribbons') || body.includes("SUMMARY:Pally's\\, Rhythm\\; Ribbons"), 'title escaped + present');
  assert.ok(body.includes('DTSTART:20260531T080000Z'), 'start time in UTC ICS form');
  assert.ok(body.includes('DTEND:20260531T120000Z'), 'end time = start + 4h default duration');
  assert.ok(body.includes('LOCATION:Afters.\\, Wellington'), 'location includes city, comma escaped');
  console.log('OK: VEVENT well-formed with escaped fields and 4h default duration');

  // 404 for unknown slug
  const miss = await GET(new Request('http://localhost/gigs/e/nope/ics'), { params: Promise.resolve({ slug: 'nope' }) });
  assert.equal(miss.status, 404);
  console.log('OK: unknown slug returns 404');

  console.log('All ics unit tests passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
