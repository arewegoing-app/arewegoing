# arewegoing — rename + extend plan

> Living plan for the arewegoing.app rename + public-surface extension. Supersedes any conflict with `SPEC.md` (which still reads as the old "Gigs" spec — see Task 0). Folds in the existing `tasks/features-v2-plan.md` rather than replacing it: slices 1-3 there map to Phase 2 here.

## Critique (read before planning further work)

1. **SPEC.md is stale.** Says "Gigs", Wellington-only, "no public discovery feed". README and PROPOSAL say arewegoing, coop, public surface is the point. Two contradicting specs = every future session burns tokens choosing the right one. Highest-leverage fix = Task 0.
2. **The vision dump is 11 ideas competing for MVP.** Cut to the differentiator: anon group coordination on top of public events. Slug pages, OAuth providers, cross-group merge — Phase 5+.
3. **"AI tests it cheaply" is partly a trap.** Cheap: unit + Playwright. Not cheap: identity-merge logic, product-feel calls, vague-spec fills. Architecture drift still costs what it costs.
4. **Two products risk colliding.** Public discovery = Songkick-lite. Group coordination = the real differentiator. Anchor: public calendar exists to feed groups, not as the product.
5. **PWA / mobile-first / accessible is a constraint, not a slice.** Goes in every Verification step.
6. **`?ref=arewegoing` is one helper, not a slice.**

## Architecture decisions

| Decision | Rationale |
|---|---|
| **Rename + extend, not pivot.** | Schema already half-renamed (`anon_owner_id` on events, `extras` reaction kind, `feature_interest`). Gigs primitive survives as "group calendar event". |
| **Anon cookie UUID = canonical identity until upgrade.** | Already exists in `src/lib/anon/`. Magic-link claim merges anon → user (Phase 4). |
| **Group = link-only access via UUID.** | No join codes for MVP. Anyone with the link can join. Revisit if abuse appears. |
| **Public events feed groups; events are not group-scoped.** | Event row is global. `group_events` junction tracks which groups picked it up. |
| **Filters are client-side + URL params.** | URL-as-state means shareable filtered links. No server route round-trip for typing. |
| **Card expand = inline DOM, not new tab.** | Outbound ticket click still tracked via `?ref=arewegoing` helper. Both signals captured. |
| **Email-magic-link only for v1 sign-in.** | OAuth providers (Google, Apple) stay mocked behind `NotifyMeButton` per features-v2 slice 4. |

## Dependency graph

```
Task 0: SPEC rewrite ──────────────────────────────────────────────┐
                                                                    │
Task 1: Outbound link helper (?ref=arewegoing) ─────────────┐       │
                                                            ▼       ▼
Task 2: Anon identity hardening ────────────► Task 3: Landing /
                  │                                         │
                  ├──► Task 4: Waitlist (feature_interest) ─┤
                  │                                         │
                  ▼                                         ▼
Task 5: Group model + /group/[uuid]/calendar  ──► Task 6: Share-to-group flow
                  │
                  ▼
Task 7: Group-event interaction (add public → group)
                  │
                  ▼
Task 8: No-reload filter/search on /calendar
                  │
                  ▼
Task 9: Inline card expand
                  │
                  ▼
Task 10: PWA shell (manifest + service worker)
                  │
                  ▼
Task 11: Magic-link sign-in + anon-to-user merge   ←── highest risk, last
```

---

## Phase 1 — Foundation

### Task 0: Rewrite SPEC.md for arewegoing

**Description:** Replace "Gigs" spec with arewegoing public+group spec. Anchor every future agent session.

**Acceptance criteria:**
- [ ] SPEC.md opens with arewegoing identity, not Gigs.
- [ ] Module table includes `anon`, `feature_interest`, `groups` ownership.
- [ ] Public discovery is a first-class surface, not deferred.
- [ ] "Never do" list updated: drop "no public discovery feed". Keep "no SMS", "no recipient accounts" only if still true.
- [ ] References to `pnpm gigs:*` commands match `package.json` reality (no `gigs:` namespace exists).

**Verification:**
- [ ] `grep -r "Gigs " SPEC.md` returns 0.
- [ ] `grep "no public discovery" SPEC.md` returns 0.
- [ ] Human read-through (you).

**Dependencies:** None.

**Files touched:** `SPEC.md`.

**Estimated scope:** S.

### Task 1: Outbound link helper with `?ref=arewegoing`

**Description:** Single helper that wraps outbound ticket links with `?ref=arewegoing` query param. Logs the click.

**Acceptance criteria:**
- [ ] `src/lib/outbound/with-ref.ts` exports `withRef(url: string): string`.
- [ ] Strips existing `ref` param before appending (idempotent).
- [ ] Used wherever the calendar/event detail renders a ticket link.
- [ ] Click logger fires once per click via `/api/log` (`outbound.click` event, includes event id + destination host).

**Verification:**
- [ ] Unit test: `withRef('https://x.com')` → `https://x.com/?ref=arewegoing`; `withRef('https://x.com/?ref=other')` → `https://x.com/?ref=arewegoing`.
- [ ] Unit test: malformed URL returns the input unchanged.
- [ ] Playwright: click ticket link on `/calendar` → network log shows `outbound.click`.

**Dependencies:** None.

**Files touched:** `src/lib/outbound/with-ref.ts`, `src/lib/outbound/with-ref.unit.ts`, `src/app/calendar/page.tsx`, `src/app/e/[slug]/page.tsx`, `src/app/api/log/route.ts`.

**Estimated scope:** S.

### Task 2: Anon identity hardening

**Description:** Anon module already exists. Audit it. Make sure: cookie set works in every Next 16 render context, anon id is readable from server actions, and a single helper `currentActor()` returns `{ kind: 'user' | 'anon', id, displayName?, emoji? }`.

**Acceptance criteria:**
- [ ] `src/lib/anon/current-actor.ts` exports `currentActor()` used by every reaction/comment/group server action.
- [ ] Anon row created in `anon_profiles` table (id, emoji, nickname, created_at) on first cookie set if missing.
- [ ] No code path silently swallows the cookie set failure — log at warn level.

**Verification:**
- [ ] Unit test: `currentActor()` with no cookie → mints + returns anon.
- [ ] Unit test: `currentActor()` with session → returns user shape.
- [ ] Playwright: react to event as anon, hard refresh, reaction persists.

**Dependencies:** Task 0.

**Files touched:** `src/lib/anon/*.ts`, `src/lib/db/schema.ts` (add `anon_profiles`), `migrations.sql`.

**Estimated scope:** M.

### Checkpoint: Foundation
- [ ] `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:e2e` all green.
- [ ] SPEC.md is the document the next agent reads first.

---

## Phase 2 — Public surfaces

### Task 3: Landing `/`

**Description:** Replace current `/` with a real landing page: who, what, why, single CTA to waitlist or to `/calendar`.

**Acceptance criteria:**
- [ ] Hero, three-bullet "what it does", screenshot or animated calendar preview, two CTAs (waitlist email + "see what's on").
- [ ] Mobile-first; verified at 390px.
- [ ] Uses STYLE_GUIDE voice — no puffery, no banned words.
- [ ] Server component; no client JS for hero.

**Verification:**
- [ ] Playwright at 390px: above-the-fold contains CTA + tagline; no horizontal scroll.
- [ ] Lighthouse local: a11y ≥ 95, perf ≥ 90.

**Dependencies:** Task 0.

**Files touched:** `src/app/page.tsx`, possibly `src/components/landing/*`.

**Estimated scope:** M.

### Task 4: Waitlist signup (reuses `feature_interest`)

**Description:** Wire the landing-page email field to `recordFeatureInterest('general.waitlist', email, notifyOptIn=true)`.

**Acceptance criteria:**
- [ ] Submitting empty email → inline validation message, no row.
- [ ] Submitting valid email → row in `feature_interest` with feature_key='general.waitlist', notify_opt_in=1.
- [ ] Dedupe: same email twice = single row.
- [ ] Confirmation copy: "we'll let you know" matches features-v2 slice 3 shape.

**Verification:**
- [ ] Playwright: submit twice, check `/api/admin/feature-interest` (if exists) or DB query returns one row.
- [ ] Unit test on the server action covers dedupe.

**Dependencies:** Task 3, existing `recordFeatureInterest` from features-v2 slice 1.

**Files touched:** `src/components/landing/waitlist-form.tsx`, reuses `src/lib/feature_interest/*`.

**Estimated scope:** S.

### Checkpoint: Public surfaces
- [ ] `/` is the explainer + waitlist.
- [ ] `/calendar` still works (unchanged).
- [ ] `/api/log` shows `outbound.click` events from prod-shaped data.

---

## Phase 3 — Groups (the differentiator)

### Task 5: Group model + `/group/[uuid]/calendar` route

**Description:** Existing `groups` table already exists. Audit. Add a `group_events` junction so a group can pick up public events without duplicating event rows. New route renders a group calendar.

**Acceptance criteria:**
- [ ] `group_events (group_id, event_id, added_by_actor_id, added_at)` exists, unique on `(group_id, event_id)`.
- [ ] `/group/[uuid]/calendar` server component: pinned group events on top, public events below.
- [ ] Group identity not required to view — UUID-in-URL is the access token.
- [ ] OG meta tags filled in for share previews (title, image of pinned event, description).

**Verification:**
- [ ] Playwright at 390px: seeded group renders, pinned event visible, public events list below.
- [ ] `curl -I /group/<id>/calendar` returns OG meta tags in HTML.
- [ ] Bad UUID → 404, not 500.

**Dependencies:** Task 2.

**Files touched:** `src/lib/groups/*`, `src/app/group/[uuid]/calendar/page.tsx`, schema + migration.

**Estimated scope:** M.

### Task 6: Share-to-group flow

**Description:** Share button on an event card or detail. Generates a new group UUID, pins the event into it, copies `/group/{uuid}/calendar` URL.

**Acceptance criteria:**
- [ ] Share button on event card (mobile) and event detail (desktop).
- [ ] Server action `shareEventAsGroup(eventId)` creates group + group_events row + adds current actor as creator.
- [ ] Returns a URL + uses Web Share API on supporting devices, falls back to copy-to-clipboard.
- [ ] Idempotent: same actor sharing same event twice returns the same group URL (or asks confirm-new-group).

**Verification:**
- [ ] Playwright: tap share → URL in clipboard → navigate to URL → event present.
- [ ] Unit test: same actor + same event → same group id.

**Dependencies:** Task 5.

**Files touched:** `src/components/event-card/share-button.tsx`, `src/lib/groups/share.ts`, `src/lib/groups/share.unit.ts`.

**Estimated scope:** M.

### Task 7: Add-public-event-to-group interaction

**Description:** On `/group/[uuid]/calendar`, tapping a public event below adds it to the pinned section.

**Acceptance criteria:**
- [ ] Optimistic UI: event moves to pinned area immediately.
- [ ] Server action persists `group_events` row.
- [ ] Removing a pinned event allowed by anyone in the group for MVP. Log who removed.
- [ ] Anon and user actors both work.

**Verification:**
- [ ] Playwright at 390px: tap add → pinned, refresh → still pinned.
- [ ] Playwright: anon-A adds event, anon-B (different cookie) removes it, both succeed, log shows actor ids.

**Dependencies:** Task 5, Task 2.

**Files touched:** `src/app/group/[uuid]/calendar/page.tsx`, `src/lib/groups/membership.ts`.

**Estimated scope:** M.

### Checkpoint: Groups
- [ ] Full share-to-group loop works in Playwright.
- [ ] OG preview screenshot manually checked on a real phone.

---

## Phase 4 — Polish

### Task 8: No-reload filter + search on `/calendar`

**Description:** Client-side filter bar that updates URL search params and filters the already-fetched event list. Folds in features-v2 slice 8.

**Acceptance criteria:**
- [ ] Filter state lives in URL (`?venue=...&from=...&to=...&q=...`).
- [ ] Initial render is server-filtered (so SEO + cold load are fast).
- [ ] Typing in search filters in place, no network round trip.
- [ ] Shareable filtered URL renders the same filtered list.

**Verification:**
- [ ] Playwright: type "moshi" → list filters within 100ms (no network call). Copy URL → open in new tab → same filtered list.

**Dependencies:** Task 0.

**Files touched:** `src/app/calendar/filter-bar.tsx` (exists, extend), `src/app/calendar/page.tsx`.

**Estimated scope:** M. Folds in `features-v2-plan.md` slice 8.

### Task 9: Inline card expand

**Description:** Tap a calendar card → expand inline instead of routing. Folds in features-v2 slice 9.

**Acceptance criteria:**
- [ ] Card expands in place with smooth height transition (CSS or View Transitions API).
- [ ] Expanded card shows reactions, share, ticket link.
- [ ] No-JS fallback: card is a `<Link>` to event detail.
- [ ] Outbound ticket link in expanded card uses `withRef()`.

**Verification:**
- [ ] Playwright at 390px: tap card → expanded panel visible, second tap collapses.
- [ ] Playwright with JS disabled: tap → navigates to `/e/[slug]`.

**Dependencies:** Task 1, Task 8.

**Files touched:** `src/app/calendar/page.tsx`, `src/components/event-card/*`.

**Estimated scope:** M.

### Task 10: PWA shell

**Description:** Manifest + service worker + install prompt. Offline-aware for the cached calendar list.

**Acceptance criteria:**
- [ ] `public/manifest.webmanifest` with name, icons (192, 512), theme color, display=standalone.
- [ ] Service worker caches `/`, `/calendar`, static assets. Network-first for HTML.
- [ ] Installable on iOS Safari + Android Chrome (manual check).
- [ ] `pnpm build` size budget: SW bundle ≤ 30 KB gzipped.

**Verification:**
- [ ] Lighthouse PWA score = installable.
- [ ] Playwright: visit `/`, check `navigator.serviceWorker.controller` is set after second load.

**Dependencies:** None functional, do after Phase 3 settles.

**Files touched:** `public/manifest.webmanifest`, `src/app/sw.ts`, `src/app/layout.tsx`.

**Estimated scope:** M.

### Checkpoint: Polish
- [ ] Lighthouse a11y ≥ 95, perf ≥ 90 on `/` and `/calendar`.

---

## Phase 5 — Identity upgrade (highest risk, last)

### Task 11: Magic-link sign-in + anon-to-user merge

**Description:** Folds in features-v2 slice 4. Add Resend email provider to Auth.js v5. On successful sign-in, merge the current anon cookie's data into the user account.

**Acceptance criteria:**
- [ ] `/signin` accepts email → sends magic link via Resend (file outbox in dev).
- [ ] Click magic link → session created.
- [ ] If anon cookie present, server action `mergeAnonIntoUser(userId, anonId)` runs in a single transaction:
  - reactions, comments, group memberships, group_events rows reassigned
  - anon_profile row marked merged_into=userId
  - anon cookie cleared
- [ ] Merge is idempotent and safe to re-run.
- [ ] If merge fails partway, transaction rolls back. User gets a "try again" page, no partial state.

**Verification:**
- [ ] Unit test on `mergeAnonIntoUser`: starts with N anon rows, ends with N user rows, 0 anon rows. Idempotent.
- [ ] Playwright end-to-end: react as anon, sign in, anon reactions now show as user reactions.
- [ ] Playwright: induce merge error (mock DB throw mid-merge) → no rows moved.

**Dependencies:** Tasks 2, 5, 6, 7. (Everything that writes anon-scoped data must exist first.)

**Files touched:** `src/lib/auth/auth.ts`, `src/lib/anon/merge.ts`, `src/lib/anon/merge.unit.ts`, magic-link email template.

**Estimated scope:** L. **High risk: identity-merge bugs corrupt data permanently.**

### Checkpoint: Identity
- [ ] Merge tested with seeded fixture: 1 anon with reactions + group memberships → sign in → all rows now user-owned, no orphans.

---

## Out of scope for this plan (defer)

- `/{venue,artist}/{slug}` filtered routes — needs taxonomy + backfill.
- OAuth providers (Google, Apple, Facebook) — magic link covers v1; mock buttons stay per features-v2 slice 5.
- Cross-group identity merge across multiple anon cookies (e.g. anon on phone + anon on laptop both claimed by same email). Phase 6.
- Push notifications.
- iCal export.
- Time zone handling beyond Pacific/Auckland.
- Moderation / report flows.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| SPEC drift continues, agents act on stale info | High | Task 0 first, always. Every plan references it. |
| Anon-to-user merge corrupts data | High | Single transaction. Idempotent. Tested with rollback simulation. Ship Task 11 last. |
| Public calendar pulls focus away from coordination differentiator | Medium | Anchor: every public surface has a clear path into a group. No discovery-only screens. |
| `?ref=arewegoing` clicks don't get logged in prod (CORS, beacon failures) | Medium | Use `navigator.sendBeacon`; fall back to `fetch keepalive`. |
| PWA service worker caches stale calendar HTML | Medium | Network-first for HTML, cache-first only for hashed assets. |
| Card expand feels janky on Android mid-tier | Medium | View Transitions API behind feature detect; CSS-height fallback. |

## Open questions

- **Group privacy model.** UUID-in-URL only? Or add a per-group emoji-pin to deter accidental shares?
- **Group event lifecycle.** Anyone can add and remove for MVP. Vandalism risk small at v1 scale; revisit if it bites.
- **Waitlist transactional emails.** Send confirmation immediately, or batch? Resend pricing ladder matters here.
- **Do we publish the existing features-v2 slices 1-3 first** (currently in flight on `fix/e2e-add-button-locator-and-hydration`), or rebase them into this plan's Phase 2? Recommend: ship the in-flight branch, then start Task 0.

## How this plan relates to existing docs

- `SPEC.md` — Task 0 rewrites it. Until then, treat SPEC.md as wrong-by-default.
- `PROPOSAL.md` — strategic + funding. Stays as is.
- `README.md` — already says arewegoing. Update commands table when Task 0 lands.
- `tasks/features-v2-plan.md` — slices 1-3 are in flight; slices 4, 5, 8, 9 fold into Tasks 11, mocks (defer), 8, 9 here.
