# features-v2 — task plan

> One slice per `/loop` iteration. Mobile-first. Verify on 390px viewport in Playwright before claiming done.

## Slice ordering

Slices ordered to land the backbone before the surfaces that depend on it. State-model rebrand (slice 2) and notify-me (slice 3) both depend on slice 1.

### Slice 1 — `feature_interest` table + server action *(in flight)*

- Add `feature_interest` table to `src/lib/db/schema.ts` and `migrations.sql`.
- Columns: `id`, `user_id` (nullable), `anon_id` (nullable), `feature_key`, `email` (nullable), `notify_opt_in` (default 0), `meta jsonb` (nullable), `created_at`.
- Unique index on `(feature_key, user_id, anon_id, email)` so repeated taps don't spam rows.
- New module `src/lib/feature_interest/` with `recordFeatureInterest()` server action (Zod-validated, anon-or-user identity).
- Unit test: feature_interest dedupes on repeat, upserts a fresh email.
- Acceptance: typecheck + lint + unit test green; no UI touched yet.

### Slice 2 — rebrand reactions + add `extras` / `need_ticket`

- Add enum values `extras`, `need_ticket` to `reaction_kind`.
- Add `extras_count integer` to `event_reactions` (nullable, used only for `extras`).
- Update `reactionKindSchema` + `TOKEN_ACTIONS` + `getReactionTallies` to include new kinds.
- Update `reactions-row.tsx`: relabel `pledge_1` / `pledge_2` → "I'll buy 1" / "I'll buy 2"; add "Got extras" + "Need one"; demote `cant` to overflow.
- Mobile pass on the row: ≥44px tap targets, thumb zone, wrap at 390px.
- Playwright spec: tapping "Need one" persists for an anon user across reloads.

### Slice 3 — `NotifyMeButton` + "we'll let you know" screen

- New `src/components/notify-me-button.tsx` calling `recordFeatureInterest`.
- Optional email field (HTML5 type=email, ESL-friendly placeholder).
- Shared `src/app/notify/[featureKey]/page.tsx` confirmation screen.
- Playwright spec: notify-me from a fake feature persists and lands on confirmation.

### Slice 4 — real email-passwordless signin via Resend

- Add Nodemailer/Resend provider to `src/lib/auth/auth.ts` (Auth.js v5 supports an email provider with Resend).
- Magic-link template via existing React Email scaffolding.
- New `mocks-row.tsx` only for the providers we still need keys for (Google / Apple). Mock buttons → notify-me with `signin.<provider>`.

### Slice 5 — mock "connect" shells (Facebook / Songkick / SoundCloud / Spotify)

- New page section on `/` or `/calendar` (TBD inside slice) with the four connect chips.
- Each chip → notify-me with `connect.<service>`. Stays mocked — needs OAuth credentials.

### Slice 6 — real anon "add event" submission

- Extend `src/app/new/page.tsx` to accept submissions when no session exists; persist with `anonOwnerId` (already supported in schema).
- Drop the `redirect('/signin')` guard for unauthenticated callers.
- Anon submissions go straight to the public discovery surface; user gets a shareable link.

### Slice 7 — real pre-drinks / afters host vote

- New table `event_host_votes` (event_id, kind: `predrinks`|`afters`, candidate_label, voter_user_id, voter_anon_id, voted_at).
- On the event detail page: two cards, "Where are we pre-ing?" / "Where are we ending up?" — list candidates, anyone can add a candidate, votes are one-per-actor-per-kind, swappable.
- Show the leader live (RSC re-render).

### Slice 8 — calendar filter + search

- New `src/app/calendar/filter-bar.tsx`: venue dropdown, date range, price band, free-text.
- Server-side filtering via `searchParams` (already a dynamic page).

### Slice 9 — animated card expand

- LayoutGroup on the calendar list; clicking a card transitions to the event detail page.
- Falls back to a normal `<Link>` on no-JS.

### Slice 10 — real notify-me-of-new-features prompt

- Cookie-gated banner / sheet, max once per 7 days per anon/user.
- "Notify me when new things ship" → `recordFeatureInterest('general.new_features', email, notifyOptIn=true)`. No mock layer.

## Driving the loop

Per iteration:

1. Pick the lowest-numbered slice not yet shipped.
2. Run the relevant skill (`incremental-implementation` + `frontend-ui-engineering` if UI; `test-driven-development` for the failing test first).
3. Verify on 390px Playwright viewport.
4. Conventional Commits, no `Co-Authored-By`.
5. PR → `main`. `code-review-and-quality`. If CI green AND review okay → squash-merge → delete branch.
6. Auto-deploy: fast-forward `deploy/production` from `main`, wait for CI green, trigger Vercel prod deploy, poll READY, smoke-test 390px on prod.
7. Report shipped / next / blocked.

Stop the loop when slices 1–10 are landed AND stretch items are documented but not built — OR a guardrail trips and needs human approval.

## Guardrails

- Never auto-merge if review left `REQUEST_CHANGES`, if any required check is failing, or if the PR touches `drizzle/migrations/`, `package.json` (deps), or auth code.
- Never auto-deploy on a commit that didn't come through the auto-merge path.
- One deploy in flight at a time; queue, don't stack.
- Max one production deploy per 10 minutes.

## Open at start of loop

- Confirm Vercel is wired to deploy `main` automatically or via `deploy/production`. If neither, the auto-deploy step requires manual setup before slice 1 lands.
