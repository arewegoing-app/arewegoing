# arewegoing — todo

> Checklist view of `tasks/plan.md`. One line per task. Tick as you go.

## Phase 1 — Foundation
- [ ] **Task 0** — Rewrite `SPEC.md` for arewegoing (kill Gigs framing, drop "no public discovery", fix `pnpm gigs:*` references)
- [ ] **Task 1** — `withRef()` outbound link helper + `outbound.click` log
- [ ] **Task 2** — `currentActor()` + `anon_profiles` table + cookie-set warn log

### Checkpoint
- [ ] `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:e2e` green
- [ ] `SPEC.md` is the doc agents read first

## Phase 2 — Public surfaces
- [ ] **Task 3** — Landing `/` (hero, 3 bullets, 2 CTAs, 390px verified, Lighthouse a11y ≥ 95)
- [ ] **Task 4** — Waitlist signup via `recordFeatureInterest('general.waitlist', email)`

### Checkpoint
- [ ] `/` is the explainer + waitlist; `/calendar` still works; `outbound.click` events observable

## Phase 3 — Groups
- [ ] **Task 5** — `group_events` junction + `/group/[uuid]/calendar` route + OG meta
- [ ] **Task 6** — `shareEventAsGroup()` server action + Web Share + clipboard fallback
- [ ] **Task 7** — Tap public event → add to group (optimistic UI, anon + user both work)

### Checkpoint
- [ ] Share-to-group loop green in Playwright
- [ ] OG preview manually checked on a real phone

## Phase 4 — Polish
- [ ] **Task 8** — No-reload filter/search on `/calendar` (URL params, server-filtered first render, client-filtered after)
- [ ] **Task 9** — Inline card expand (View Transitions or CSS height, no-JS link fallback)
- [ ] **Task 10** — PWA shell (manifest, network-first SW, installable on iOS + Android)

### Checkpoint
- [ ] Lighthouse a11y ≥ 95, perf ≥ 90 on `/` and `/calendar`

## Phase 5 — Identity (last, high risk)
- [ ] **Task 11** — Resend magic link + transactional `mergeAnonIntoUser()` + rollback test

### Checkpoint
- [ ] Seeded fixture: 1 anon w/ reactions + group memberships → sign in → all rows user-owned, 0 orphans

## Deferred (not MVP)
- [ ] `/{venue,artist}/{slug}` filtered routes
- [ ] OAuth providers (Google, Apple, Facebook)
- [ ] Cross-device anon merge
- [ ] Push notifications
- [ ] iCal export
- [ ] Time zone handling
- [ ] Moderation / report flow

## Open before starting
- [ ] Decide: ship in-flight `fix/e2e-add-button-locator-and-hydration` branch first, then Task 0?
- [ ] Confirm group privacy: UUID-in-URL only, or add a pin?
- [ ] Confirm waitlist email cadence (immediate vs batched) — affects Resend cost
