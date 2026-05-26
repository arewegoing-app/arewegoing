// /gigs IS the calendar — the main surface for everyone (buyer + recipients).
// The buyer's "events I'm organizing" view lives at /organizing.
// Eventually we'll add /g/[group-slug]/calendar when the user has 2+ groups;
// until then, `/gigs` resolves to the default group's calendar implicitly.

export { default } from './calendar/page';
