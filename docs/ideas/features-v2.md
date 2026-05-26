# features-v2

> Mocked-but-clickable features so we learn which actions users actually want. Focus problem: 4–8 friends, NZ/AU, weekend DJ events, tickets drop mid-month and sell out in minutes.

## Problem Statement

How might we let a small friend group converge on weekend ticket drops fast enough to act — without forcing anyone into a signup, an app store, or a new social graph — while learning which features they actually want before we build them?

## Recommended Direction

Ship the cheap real features properly (calendar export, share, filter, search) and build clickable shells for the rest. Every mocked shell logs intent into one shared `feature_interest` table and parks the user on a "we'll let you know" screen. Optional email capture.

Optimise for: thumb-zone, 390px viewport, no signup wall, joyful micro-animations, ESL-friendly copy.

## State Model (decision)

Existing reactions: `interested`, `down`, `cant`, `pledge_1`, `pledge_2`, `have_ticket`.

**Keep `pledge` distinct from `extras`.** Pledge is demand-side ("I'll cover N tickets through the group buyer"); extras is supply-side ("I bought N spares, who needs one?"). Collapsing them loses the cash-fronting beat that's already wired into the Gigs flow.

Final set (mapped to the existing enum where possible, additive where not):

| Label (UI) | Enum value | Meaning |
| --- | --- | --- |
| Interested | `interested` | Soft signal, "keep me posted" |
| I'm down | `down` | Want to go if the group goes |
| I'll buy 1 / I'll buy 2 | `pledge_1` / `pledge_2` | Commit to buy N through the buyer (demand) |
| Got mine | `have_ticket` | Bought solo, locked in |
| Got extras (N) | `extras` *(new)* | Bought spare(s), N available (supply) |
| Need one | `need_ticket` *(new)* | Looking for a spare |
| Can't | `cant` | Demoted: hidden from primary row, lives in an overflow menu |

Schema: add `extras` and `need_ticket` to `reaction_kind`. Add an `extras_count integer` column on `event_reactions` (only used when `kind = 'extras'`, default null).

## Feature Buckets

### Ship real (no waitlist, no mock)

Most of these already exist in the codebase. The "ship real" list below is what's actually still TODO.

- Animated event card: tap → expand to detail, smooth on mobile (LayoutGroup or shared element).
- Filter row on calendar: venue, date range, genre, price band, free-text search.
- `extras (N)` / `need_ticket` affordances on the card (state model above).
- Mobile-first 390px viewport pass on calendar + event detail.
- Notify-me chip (reusable component, used by mocked features).

Already in repo, do not re-build:
- Calendar export (.ics + Google Calendar URL) — `src/app/e/[slug]/ics/route.ts`.
- Share button + WhatsApp deeplink + copy-link — `src/app/e/[slug]/share-buttons.tsx`.

### Built for real (was mocked, promoted)

User correction (2026-05-26): if it's easy to build real, build real. The features below now ship as working systems, not waitlist shells. They still write to `feature_interest` as a usage signal alongside their real persistence.

- **Add event (user-submitted)** — real route already lives at `src/app/new/page.tsx`; extend to accept an anonymous submission so the user doesn't have to sign in first. Persists to `events` with `anonOwnerId`.
- **Sign in (email passwordless via Resend)** — Resend is already a dep; add an email magic-link provider to Auth.js. Skip Google/Apple/Facebook OAuth — those still need provider keys and stay mocked.
- **Vote pre-drinks host / afters host** — small DB table per event, one row per host candidate, anon-or-user votes. Tally on the event detail page.
- **Notify-me-of-new-features** — real opt-in stored in `feature_interest` (key: `general.new_features`). No mock needed.

### Mock + waitlist (clickable shells)

Every shell calls `recordFeatureInterest({featureKey, email?, notifyOptIn})` and renders a "we'll let you know" screen. Kept mocked because the real version needs third-party OAuth credentials and an account we don't have yet.

- Sign in with Google / Apple (OAuth provider keys not provisioned).
- Connect Facebook (Graph API + app review).
- Connect Songkick / SoundCloud / Spotify (their APIs + keys).

### Stretch (document, do not build)

- WhatsApp bot path (no-signup flow).
- Colour-coding event cards by friend group.
- Pre-drinks / afters host decision flow (real, not mocked).

### Drop (out of scope)

- Festivals and planned-months-ahead events.
- Full social graph.
- Real payment / ticket reselling.

## Key Assumptions to Validate

- [ ] Friends will tap a clickable shell and feel rewarded by "we'll let you know" — not bait-and-switched. Test via funnel: shell → email opt-in rate.
- [ ] Extras vs pledge as separate signals reads as obvious to a first-time user. Test via 1–2 friends on a 390px viewport.
- [ ] Calendar export + share is enough "real" to make the mocks feel honest rather than empty. Test by counting return visits.
- [ ] Anonymous cookie identity is enough to drive the funnel — most users will not claim their account until later. Test by ratio of anon → claimed actions.

## MVP Scope

- New table `feature_interest`.
- New server action `recordFeatureInterest`.
- New reaction kinds (`extras`, `need_ticket`) + `extras_count`.
- Reusable `NotifyMeButton` + "we'll let you know" screen.
- Clickable shells: sign in, Facebook connect, Songkick/SoundCloud connect, add event, pre-drinks host, afters host.
- Filter + search on calendar.
- Animated card expand.

## Not Doing (and Why)

- Festivals / months-ahead planning — wrong problem; group's pressure is mid-month flash drops.
- Real OAuth wiring for the sign-in mocks — defer until intent volume justifies it.
- Removing `pledge` — it's already wired into the buyer flow and conflating it with `extras` would erase the cash-fronting risk model.
- Native app / push notifications — web app is fine for the test, email is enough for "we'll let you know".
- Real ticket resale rails — too much surface area for an intent-learning slice.

## Open Questions

- Should `cant` stay reachable at all in the calendar UI, or move entirely to the event detail page?
- What's the right cadence for the notify-me-of-new-features prompt? (Once per session? Once per visit-streak?)
- Do we backfill old `pledge_1`/`pledge_2` labels to the new "I'll buy N" wording, or only relabel forward?

---

Skill workflow: `idea-refine` → `spec-driven-development` → `planning-and-task-breakdown` → `incremental-implementation` per slice. Plan lives at `tasks/features-v2-plan.md`.
