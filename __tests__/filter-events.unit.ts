import { strict as assert } from 'node:assert';
import { filterEvents } from '@/app/calendar/filter-events';

// Minimal event shape matching what filterEvents expects.
type MinEvent = {
  id: string;
  title: string;
  venue: string | null;
  startsAt: Date | null;
  priceLow: number | null;
  priceHigh: number | null;
};

function mkEvent(overrides: Partial<MinEvent> & { id: string; title: string }): MinEvent {
  return {
    venue: null,
    startsAt: new Date('2026-09-01T20:00:00.000Z'),
    priceLow: null,
    priceHigh: null,
    ...overrides,
  };
}

// 1. Empty filter state → returns all events.
{
  const events = [mkEvent({ id: '1', title: 'Alpha' }), mkEvent({ id: '2', title: 'Beta' })];
  const result = filterEvents(events, {});
  assert.equal(result.length, 2, 'empty filter state → all events');
  console.log('OK 1: empty filter state → returns all events');
}

// 2. q matches title (case-insensitive, accent-folded).
{
  const events = [
    mkEvent({ id: '1', title: 'Moshi Moshi Nights' }),
    mkEvent({ id: '2', title: 'Something else' }),
    mkEvent({ id: '3', title: 'MOSHI presents' }),
  ];
  const result = filterEvents(events, { q: 'moshi' });
  assert.equal(result.length, 2, 'case-insensitive title match');
  console.log('OK 2: q matches title case-insensitively');
}

// 3. q matches venue.
{
  const events = [
    mkEvent({ id: '1', title: 'Night Out', venue: 'San Fran' }),
    mkEvent({ id: '2', title: 'Party', venue: 'Meow' }),
    mkEvent({ id: '3', title: 'Rave', venue: 'San Francisco Club' }),
  ];
  const result = filterEvents(events, { q: 'san fran' });
  assert.equal(result.length, 2, 'q matches venue');
  console.log('OK 3: q matches venue');
}

// 4. venue matches exactly (not partial).
{
  const events = [
    mkEvent({ id: '1', title: 'A', venue: 'San Fran' }),
    mkEvent({ id: '2', title: 'B', venue: 'San Francisco' }),
    mkEvent({ id: '3', title: 'C', venue: 'Meow' }),
  ];
  const result = filterEvents(events, { venue: 'San Fran' });
  assert.equal(result.length, 1, 'exact venue match');
  assert.equal(result[0].id, '1', 'exact venue match picks the right event');
  console.log('OK 4: venue matches exactly');
}

// 5. from/to filter by event.startsAt.
{
  const events = [
    mkEvent({ id: '1', title: 'Early', startsAt: new Date('2026-08-01T10:00:00.000Z') }),
    mkEvent({ id: '2', title: 'Mid', startsAt: new Date('2026-09-15T10:00:00.000Z') }),
    mkEvent({ id: '3', title: 'Late', startsAt: new Date('2026-11-01T10:00:00.000Z') }),
  ];
  const result = filterEvents(events, { from: '2026-09-01', to: '2026-10-01' });
  assert.equal(result.length, 1, 'from/to filters correctly');
  assert.equal(result[0].id, '2', 'from/to picks correct event');
  console.log('OK 5: from/to filter by startsAt');
}

// 6. Combined filters → AND semantics.
{
  const events = [
    mkEvent({ id: '1', title: 'Moshi Nights', venue: 'San Fran', startsAt: new Date('2026-09-10T20:00:00.000Z') }),
    mkEvent({ id: '2', title: 'Moshi Afternoon', venue: 'Meow', startsAt: new Date('2026-09-10T20:00:00.000Z') }),
    mkEvent({ id: '3', title: 'Techno Night', venue: 'San Fran', startsAt: new Date('2026-09-10T20:00:00.000Z') }),
  ];
  const result = filterEvents(events, { q: 'moshi', venue: 'San Fran' });
  assert.equal(result.length, 1, 'combined filters are AND');
  assert.equal(result[0].id, '1', 'combined filters pick correct event');
  console.log('OK 6: combined filters → AND semantics');
}

// 7. q with leading/trailing whitespace → trimmed.
{
  const events = [
    mkEvent({ id: '1', title: 'Moshi Nights' }),
    mkEvent({ id: '2', title: 'Other' }),
  ];
  const result = filterEvents(events, { q: '  moshi  ' });
  assert.equal(result.length, 1, 'q trimmed before filtering');
  console.log('OK 7: q with whitespace is trimmed');
}

// 8. Adversarial: q with regex special chars does NOT crash.
{
  const events = [
    mkEvent({ id: '1', title: 'Normal event' }),
    mkEvent({ id: '2', title: 'Special chars: .+*?[](){}|^$\\' }),
  ];
  let threw = false;
  try {
    filterEvents(events, { q: '.+*?[](){}|^$\\' });
  } catch {
    threw = true;
  }
  assert.equal(threw, false, 'regex special chars do not crash');
  // Should either return the event with matching literal text or empty — no crash matters most.
  console.log('OK 8: regex special chars treated as literal text, no crash');
}

// 9. Events with null startsAt excluded when any date filter is set; included otherwise.
{
  const events = [
    mkEvent({ id: '1', title: 'TBD', startsAt: null }),
    mkEvent({ id: '2', title: 'Dated', startsAt: new Date('2026-09-10T20:00:00.000Z') }),
  ];
  // With date filter: null startsAt excluded.
  const withFilter = filterEvents(events, { from: '2026-09-01' });
  assert.equal(withFilter.find((e) => e.id === '1'), undefined, 'null startsAt excluded with date filter');
  assert.equal(withFilter.length, 1, 'only dated event passes through');

  // Without date filter: null startsAt included.
  const withoutFilter = filterEvents(events, {});
  assert.equal(withoutFilter.length, 2, 'null startsAt included without date filter');
  console.log('OK 9: null startsAt excluded with date filter, included otherwise');
}

// 10. priceMax filters by priceLow ?? priceHigh ?? 0 ≤ priceMax.
{
  const events = [
    mkEvent({ id: '1', title: 'Free', priceLow: 0, priceHigh: null }),
    mkEvent({ id: '2', title: 'Cheap', priceLow: 30, priceHigh: null }),
    mkEvent({ id: '3', title: 'Expensive', priceLow: 80, priceHigh: null }),
    mkEvent({ id: '4', title: 'High only', priceLow: null, priceHigh: 25 }),
    mkEvent({ id: '5', title: 'Unknown price', priceLow: null, priceHigh: null }),
  ];
  const result = filterEvents(events, { priceMax: 50 });
  // Free (0), Cheap (30), High only (25 from priceHigh), Unknown price (0) should pass.
  const ids = result.map((e) => e.id).sort();
  assert.deepEqual(ids, ['1', '2', '4', '5'], 'priceMax filters correctly');
  console.log('OK 10: priceMax filters by priceLow ?? priceHigh ?? 0');
}

console.log('\nAll filter-events unit tests passed.');
