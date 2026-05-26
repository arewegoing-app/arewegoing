/**
 * Unit tests for the email-forward ingest parsers.
 * Each fixture is loaded from __tests__/fixtures/inbound/ and run through
 * parseTicketEmail. No DB setup required — parser only.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTicketEmail } from '@/lib/ingest/email-forward/parser';
import type { InboundEmail } from '@/lib/ingest/email-forward/parser';

const FIXTURES = join(process.cwd(), '__tests__/fixtures/inbound');

function loadFixture(name: string): InboundEmail {
  const raw = readFileSync(join(FIXTURES, name), 'utf8');
  return JSON.parse(raw) as InboundEmail;
}

import type { ParsedTicket } from '@/lib/ingest/email-forward/parser';

function assertOk(
  result: Awaited<ReturnType<typeof parseTicketEmail>>,
  label: string,
): asserts result is { ok: true; meta: ParsedTicket } {
  if (!result.ok) {
    throw new Error(`${label}: expected ok=true, got reason="${result.reason}"`);
  }
}

async function main() {
  // --- Humanitix ---
  {
    const email = loadFixture('humanitix-order.json');
    const result = await parseTicketEmail(email);
    assertOk(result, 'humanitix');
    assert.ok(result.meta.title.includes('Solid State'), `humanitix title should include "Solid State", got: "${result.meta.title}"`);
    assert.equal(result.meta.source, 'humanitix');
    assert.equal(result.meta.priceLow, 35);
    assert.ok(result.meta.orderNumber?.includes('HTX'), 'humanitix orderNumber should include HTX');
    console.log('OK: humanitix — title:', result.meta.title, '| priceLow:', result.meta.priceLow);
  }

  // --- Moshtix ---
  {
    const email = loadFixture('moshtix-booking.json');
    const result = await parseTicketEmail(email);
    assertOk(result, 'moshtix');
    assert.ok(result.meta.title.includes('Star Time'), `moshtix title should include "Star Time", got: "${result.meta.title}"`);
    assert.equal(result.meta.source, 'moshtix');
    assert.equal(result.meta.priceLow, 30);
    console.log('OK: moshtix — title:', result.meta.title, '| priceLow:', result.meta.priceLow);
  }

  // --- Flicket ---
  {
    const email = loadFixture('flicket-confirm.json');
    const result = await parseTicketEmail(email);
    assertOk(result, 'flicket');
    assert.ok(result.meta.title.includes('BYRON'), `flicket title should include "BYRON", got: "${result.meta.title}"`);
    assert.equal(result.meta.source, 'flicket');
    assert.equal(result.meta.priceLow, 55);
    assert.ok(result.meta.orderNumber?.startsWith('MCW'), 'flicket orderNumber should start with MCW');
    console.log('OK: flicket — title:', result.meta.title, '| priceLow:', result.meta.priceLow);
  }

  // --- Ticketek ---
  {
    const email = loadFixture('ticketek-confirm.json');
    const result = await parseTicketEmail(email);
    assertOk(result, 'ticketek');
    assert.ok(result.meta.title.includes('Fleetwood Mac'), `ticketek title should include "Fleetwood Mac", got: "${result.meta.title}"`);
    assert.equal(result.meta.source, 'ticketek');
    assert.equal(result.meta.priceLow, 89);
    assert.equal(result.meta.venue, 'TSB Arena');
    console.log('OK: ticketek — title:', result.meta.title, '| venue:', result.meta.venue, '| priceLow:', result.meta.priceLow);
  }

  // --- Under the Radar ---
  {
    const email = loadFixture('utr-ticket.json');
    const result = await parseTicketEmail(email);
    assertOk(result, 'undertheradar');
    assert.ok(result.meta.title.includes('Lacuna'), `utr title should include "Lacuna", got: "${result.meta.title}"`);
    assert.equal(result.meta.source, 'undertheradar');
    assert.equal(result.meta.priceLow, 25);
    assert.ok(result.meta.venue?.includes('The Gods'), `utr venue should include "The Gods", got: "${result.meta.venue}"`);
    console.log('OK: undertheradar — title:', result.meta.title, '| venue:', result.meta.venue, '| priceLow:', result.meta.priceLow);
  }

  // --- Ticket Fairy ---
  {
    const email = loadFixture('ticketfairy-order.json');
    const result = await parseTicketEmail(email);
    assertOk(result, 'ticketfairy');
    assert.ok(result.meta.title.includes('Midweek Melters'), `ticketfairy title should include "Midweek Melters", got: "${result.meta.title}"`);
    assert.equal(result.meta.source, 'ticketfairy');
    assert.equal(result.meta.priceLow, 22);
    assert.equal(result.meta.venue, 'Laundry Bar');
    console.log('OK: ticketfairy — title:', result.meta.title, '| venue:', result.meta.venue, '| priceLow:', result.meta.priceLow);
  }

  // --- Unknown sender ---
  {
    const email: InboundEmail = {
      from: 'noreply@unknown-ticketing.com',
      to: 'inbox@gigs.example.com',
      subject: 'Your ticket is confirmed',
      text: 'Congratulations on your purchase.',
      html: '<p>Congratulations on your purchase.</p>',
    };
    const result = await parseTicketEmail(email);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, 'unsupported_sender');
      console.log('OK: unknown sender → reason:', result.reason);
    }
  }

  console.log('\nAll email-forward unit tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
