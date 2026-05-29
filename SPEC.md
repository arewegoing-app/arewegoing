# arewegoing — Spec

> **arewegoing.app**: a coordination layer that sits on top of existing ticketing. Public event discovery feeds private group coordination. Friends decide together; money only moves when the group commits.

See [`PROPOSAL.md`](./PROPOSAL.md) for strategy, funding model, tiers, and worker-coop framing. This spec covers engineering only.

---

## 1. Objective

Make group ticket coordination as low-friction as a single-ticket purchase. Two financial risks the buyer carries today:

1. **Bail risk** — friend says yes, ticket gets bought, friend drops, buyer eats cost.
2. **Cash-flow risk** — buyer fronts $200–400, friends pay back over days/weeks.

### What the product does

- **Public discovery surface** — events ingested from ticketing platforms and hand-curated, visible without an account.
- **Group coordination layer** — authenticated users create groups, invite friends, and coordinate RSVPs, pledges, and bail/resale.
- **Anon identity first** — recipients (and casual visitors) interact via signed-token links with no account required. An anon identity is canonical until a magic-link claim merges it into a user account. Do not break this merge path.
- **Every public surface leads to a group action** — discovery pages, event detail, notify-me prompts. The public surface exists to pull people into coordination, not as an end in itself.

### Who it's for

- **Primary user (organiser)**: one person in a friend group. Has an account. Creates events, invites friends, tracks pledges and owed amounts.
- **Recipients / visitors**: mixed devices, no appetite for new accounts. Interact entirely via email links or anonymous browser sessions.

### Geographic scope

Wellington-first in year 1 (curated events, promoter relationships, community trust). Not Wellington-only as a hard constraint. Ingestion adapters and discovery surfaces are designed to work nationally.

---

## 2. Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Local dev server at http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript type-check (no emit) |
| `pnpm test:unit` | Run all unit test files in `__tests__/` |
| `pnpm test:e2e` | Playwright end-to-end tests |
| `pnpm test:e2e:install` | Install Playwright Chromium browser |
| `pnpm reset` | Clear local PGlite data + outbox |
| `pnpm hooks:enable` | Set git hooksPath to `.githooks` |
| `pnpm hooks:disable` | Unset git hooksPath |

---

## 3. Project structure

```
src/
  app/
    page.tsx                   # homepage / discovery index
    calendar/                  # public event discovery feed
    e/[slug]/                  # event detail page
    groups/[slug]/             # group detail page
    new/                       # add event (auth or anon)
    signin/                    # magic-link + Google sign-in
    notify/                    # feature interest confirmation screen
    feedback/                  # user feedback form
    mine/                      # signed-in user's events
    owed/                      # signed-in user's owed tracker
    organizing/                # events the signed-in user created
    dropped/                   # events the user left
    r/                         # token-driven recipient action routes
    api/                       # API routes (auth, cron, inbound, log)
    error.tsx                  # client error boundary
    layout.tsx                 # root layout
  lib/
    auth/                      # Auth.js v5 config, Google + magic-link providers
    db/                        # Drizzle schema, migrations, PGlite + Neon client
    events/                    # event CRUD, series detection, ingestion
    rsvp/                      # RSVP, condition evaluator, reaction tallies
    purchases/                 # buyer, split, owed, resale tracking
    notifications/             # email dispatch (Resend), push for buyer
    ingest/                    # URL fetch, OG/JSON-LD, source adapters
    tokens/                    # HMAC-SHA256 token sign/verify
    series/                    # series + subscription logic
    payments/                  # Stripe deposit holds (flag-gated)
    anon/                      # anon identity creation and claim merging
    groups/                    # group CRUD and membership
    feature_interest/          # feature interest recording and deduplication
    discovery/                 # public event feed queries + filtering
    host_votes/                # pre-drinks / afters host vote
    promo/                     # promoter outreach log
    memory/                    # per-buyer memory (bail history, group habits)
    artists/                   # artist follow + Songkick subscriptions
    log.ts                     # pino logger (see §5b)
__tests__/                     # unit test files (*.unit.ts)
tasks/
  plan.md                      # overall task plan
  features-v2-plan.md          # active features-v2 slices
SPEC.md                        # this file
```

### Module boundaries

**Each module under `src/lib/` owns its tables. Other modules read/write only through the owning module's public API. No cross-module DB queries.**

| Module | Owns tables |
|---|---|
| `auth` | `users`, `sessions`, `accounts`, `verification_tokens` |
| `db` | Drizzle schema, client, migrations (no tables of its own) |
| `events` | `events` |
| `series` | `series`, `series_subs` |
| `rsvp` | `rsvps`, `event_invites`, `final_calls`, `pledge_commitments`, `rsvp_conditions`, `event_reactions` |
| `purchases` | `purchases`, `owed`, `resale_listings` |
| `notifications` | `notifications` |
| `ingest` | adapters registry (no tables) |
| `tokens` | `email_tokens` |
| `anon` | `anon_sessions` |
| `groups` | `groups`, `group_members` |
| `feature_interest` | `feature_interest` |
| `discovery` | no tables (queries `events` via `events` module API) |
| `host_votes` | `event_host_votes` |
| `promo` | `promo_outreach` |
| `memory` | `memory` (buyer-only, scoped to their account) |
| `artists` | `artist_follows` |
| `payments` | no tables (wraps Stripe, behind flag) |

---

## 4. Code style

- Inherits global `~/.claude/AGENTS.md` + `~/.claude/STYLE_GUIDE.md` and any project-level `AGENTS.md`.
- 2-space indent, single quotes, 80–100 char lines.
- Zod schemas at every server boundary (server actions, POST routes, ingest parsers). Use `drizzle-zod` to derive base schemas from tables, refine for actions.
- Server actions over route handlers when possible. Route handlers for token-driven endpoints (recipient actions) and webhooks (inbound email, Stripe).
- React Server Components by default. Client components only when needed (forms, optimistic UI, animations).
- No `console.log` outside dev-only logging helpers.
- Comments only where the WHY is non-obvious.
- Tailwind v4 utility classes. No inline styles. No CSS modules unless extracting a token system.
- Auth.js v5 sessions via `auth()` helper, not the older `getServerSession`.
- Read Next.js docs from `node_modules/next/dist/docs/` before non-trivial framework changes.
- **No `Co-Authored-By` in commits.** Project rule.

### Naming

- Server actions: imperative verb (`createEvent`, `sendInvites`, `recordPurchase`).
- Token actions: dotted noun (`rsvp.in`, `rsvp.maybe`, `rsvp.out`, `pledge.confirm`, `pledge.drop`).
- File names: kebab-case (`event-card.tsx`, `token-service.ts`).
- Schema tables: snake_case plural (`event_invites`, `pledge_commitments`).

---

## 5. Testing strategy

- **Playwright end-to-end** for every slice. Each slice's "Verify" step is a spec, never manual.
- **Mobile-first**: verify on **390px viewport** in Playwright before claiming a slice done.
- **Test-mode auth bypass**: env-gated route `/api/auth/test-login?email=…`, enabled only when `NODE_ENV !== 'production' && GIGS_TEST_AUTH=1`.
- **Email capture in tests**: dev-mode email transport writes to `.gigs-outbox/*.json`. Playwright reads from this directory, parses links, and follows them.
- **DB**: PGlite (in-process) for local dev and CI. Neon Postgres in production. Both drivers behind the same `db/client.ts` adapter.
- **Token tests**: replay protection, expiry, signature tampering.
- **No mocking of internal modules.** Stub external services only (Resend, ingest source HTML via fixtures).
- **Coverage target**: every public server action + every token route has a Playwright spec. Pure functions (token sign/verify, condition evaluator) also unit-tested.

---

## 5b. Logging and observability

- **Logger**: pino at `src/lib/log.ts`. Pretty output via `pino-pretty` in dev (`NODE_ENV !== 'production'`). JSON to stdout in prod, which Vercel captures.
- **Levels**: default `info`. Override with `LOG_LEVEL` env var (`debug`, `info`, `warn`, `error`).
- **Redaction**: `token`, `password`, `secret`, `authorization`, `cookie`, and named secret env vars are auto-redacted from log payloads.
- **Action events**: each server action emits one structured log on success (e.g. `rsvp.applied`, `bail.requested`, `claim.applied`) and one on rejection (`*.rejected`) with `{ reason }`.
- **Client errors**: the root `error.tsx` boundary POSTs to `/api/log` so client-side render errors land in the same pino stream as `client.error`.
- **Where to read logs**:
  - Local: run `pnpm dev`, watch the terminal.
  - Vercel: `vercel logs <deployment-url> --no-follow`, or open the Vercel dashboard for the deployment and filter by event name.

---

## 6. Boundaries

### Always do

- Validate every input at server boundaries with Zod.
- Verify HMAC tokens before any state change.
- Mark single-use tokens consumed on success.
- Keep recipient data scoped to the organiser's account. No leakage between accounts.
- Send plain-text and HTML versions of every email.
- Use the dev-mode email file-logger when `RESEND_API_KEY` is unset.
- Run `pnpm lint` and `pnpm test:e2e` before claiming a slice done.
- Preserve the anon-to-user merge path. Anon identity is canonical until a magic-link claim.
- Ensure every public surface (discovery, event detail, notify-me) leads to a group action.

### Ask first

- Adding a new external service or third-party integration.
- Adding a slice's worth of scope to an existing slice.
- Changing the auth model. Google + magic-link + token URLs is fixed for v1.
- Promoting slices not yet in flight above their sequence in `tasks/features-v2-plan.md`.
- Any change that touches `drizzle/migrations/`, `package.json` deps, or auth code.

### Never do

- No `--no-verify`, no `--no-edit`, no force-push to `main`.
- No new account creation for recipients at claim time. Token-based claim only.
- No SMS in v1.
- No Stripe in v1 unless explicitly approved. Deposit holds are behind a flag; keep them there.
- No mocking of internal modules in tests.
- No drive-by refactors outside the named slice.
- No deletion of code not fully understood.
- No `Co-Authored-By` in commits.

---

## 7. References

| Document | Purpose |
|---|---|
| [`PROPOSAL.md`](./PROPOSAL.md) | Strategy, tiers, worker-coop framing, funding case |
| [`README.md`](./README.md) | Stack overview, env vars, quick-start |
| [`tasks/plan.md`](./tasks/plan.md) | Full task plan |
| [`tasks/features-v2-plan.md`](./tasks/features-v2-plan.md) | Active features-v2 slices (current work) |
| `~/.claude/AGENTS.md` | Global agent guidelines |
| `~/.claude/STYLE_GUIDE.md` | Voice and writing style |
