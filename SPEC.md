# Gigs — Spec

> Multi-app in the scratchpad repo. Email-driven group ticket coordination for Wellington music gigs. Buyer signs in once, friends rally via email links with no account.

## 1. Objective

Make bulk-buying 4-8 early-bird tickets feel as low-friction as a single ticket. Solve two financial risks the buyer carries today:

1. **Bail risk** — friend says yes, ticket gets bought, friend drops, buyer eats cost.
2. **Cash-flow risk** — buyer fronts $200-400, friends pay back over days/weeks.

### Target user

- **Primary user (buyer)**: one person in a Wellington friend group. Has a Google account, willing to use a web app.
- **Recipients**: 4-8 friends, mixed iOS/Android, mostly on WhatsApp, no appetite for new logins. Live entirely in their email inbox + browser links.

### Success looks like

- Buyer creates an event in <60 seconds (paste URL → autofill → pick 5 recipients → send).
- Recipients click "I'm in" inside an email and never have to sign anywhere.
- A final-call email gets 80%+ click-through within 6 hours.
- Buyer dashboard shows real-time who owes what, with reminders firing automatically.
- When a recipient bails, the resale queue fills the slot before the buyer absorbs the cost.

## 2. Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Local dev server, all apps |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm gigs:migrate` | Apply Drizzle migrations |
| `pnpm gigs:seed` | Reset gigs schema + load fixtures |
| `pnpm gigs:e2e` | Playwright end-to-end tests |
| `pnpm gigs:e2e:ui` | Playwright UI mode for debugging |
| `vercel --prod` | Deploy to production |

## 3. Project structure

```
src/app/
  page.tsx                   # multi-app index, links to /gigs
  gigs/
    layout.tsx               # gigs-specific layout (auth gate, nav)
    page.tsx                 # buyer dashboard: events list
    new/page.tsx             # create event (manual + URL paste)
    e/[slug]/
      page.tsx               # buyer view of event
      public/page.tsx        # recipient view (token-gated)
    recipients/page.tsx      # buyer address book
    api/
      rsvp/route.ts          # POST: token-verified RSVP set
      pledge/route.ts        # POST: token-verified pledge
      auth/[...nextauth]/route.ts
      cron/route.ts          # Vercel Cron entry
    lib/
      auth/                  # Auth.js v5 config, Google OAuth
      db/                    # Drizzle schema, migrations, client
      events/                # event CRUD, series detection
      rsvp/                  # RSVP + condition evaluator
      purchases/             # buyer + split + owed tracking
      notifications/         # email dispatch (Resend), push for buyer
      ingest/                # URL fetch, OG/JSON-LD, source adapters
      tokens/                # HMAC-SHA256 token sign/verify
      emails/                # React Email templates
    __tests__/               # Playwright specs per slice
tasks/
  plan.md                    # full plan (long)
  todo.md                    # per-slice checklist
SPEC.md                      # this file
```

### Module boundaries

Each module under `lib/` owns its tables. Other modules read/write only through the owning module's public API. No cross-module DB queries.

| Module | Owns tables |
|---|---|
| `auth` | `users` (buyers), sessions |
| `db` | drizzle schema, client, migrations |
| `events` | `events`, `series`, `series_subs` |
| `rsvp` | `rsvps`, `event_invites`, `final_calls`, `pledge_commitments`, `rsvp_conditions` |
| `purchases` | `purchases`, `owed`, `resale_listings`, `promo_outreach` |
| `notifications` | `notifications` log |
| `ingest` | adapters registry (no tables) |
| `tokens` | `email_tokens` |
| (cross-module) | `recipients`, `groups`, `group_members` — owned by `events` |

## 4. Code style

- Inherits global `~/.claude/AGENTS.md` + `~/.claude/STYLE_GUIDE.md` + project `AGENTS.md` (Next 16 caveats).
- 2-space indent, single quotes, 80-100 char lines.
- Zod schemas at every server boundary (server actions, POST routes, ingest parsers). Use `drizzle-zod` to derive base schemas from tables, refine for actions.
- Server actions over route handlers when possible. Route handlers for token-driven endpoints (recipient RSVP/pledge) and webhooks (inbound email).
- React Server Components by default. Client components only when needed (forms, optimistic UI).
- No `console.log` outside of dev-only logging helpers.
- Comments: only when the WHY is non-obvious.
- Tailwind v4 utility classes; no inline styles, no CSS modules unless extracting a token system.
- Auth.js v5 sessions via `auth()` helper, not the older `getServerSession`.
- Read Next.js docs from `node_modules/next/dist/docs/` before non-trivial changes (per project AGENTS.md).

### Naming

- Server actions: imperative verb (`createEvent`, `sendInvites`, `recordPurchase`).
- Token actions: noun (`rsvp.in`, `rsvp.maybe`, `rsvp.out`, `pledge.confirm`, `pledge.drop`).
- File names: kebab-case (`event-card.tsx`, `token-service.ts`).
- Schema tables: snake_case plural (`event_invites`, `pledge_commitments`).

## 5. Testing strategy

- **Playwright end-to-end** for every slice. Each slice's "Verify" step is a spec, never manual.
- **Test-mode auth bypass**: env-gated route `/gigs/api/auth/test-login?email=…` only enabled when `NODE_ENV !== 'production' && GIGS_TEST_AUTH=1`.
- **Email capture in tests**: dev-mode email transport writes to `.gigs-outbox/*.json`. Playwright reads from this dir, parses links, follows them.
- **Seed script** (`pnpm gigs:seed`): resets gigs schema, loads fixtures — 1 buyer, 4 recipients, 1 Wellington group, 1 series (Goodthings), 2 events at different rally states.
- **DB**: SQLite locally + in CI via better-sqlite3 with Drizzle. Neon Postgres in production. Both drivers behind the same `db/client.ts` adapter.
- **Token tests**: replay protection, expiry, signature tampering.
- **No mocking of internal modules.** Stub external services only (Resend, Songkick, ticketing source HTML via fixtures).
- **Coverage target**: every public server action + every token route has a Playwright spec. Pure functions (token sign/verify, condition evaluator) also unit-tested.

## 5b. Logging and observability

- **Logger**: pino at `src/app/gigs/lib/log.ts`. Pretty output via `pino-pretty` in dev (`NODE_ENV !== 'production'`); JSON to stdout in prod, which Vercel captures.
- **Levels**: default is `info`. Override with `LOG_LEVEL` env var (`debug`, `info`, `warn`, `error`).
- **Redaction**: `token`, `password`, `secret`, `authorization`, `cookie`, and the named secret env vars are auto-redacted from log payloads.
- **Action events**: each server action emits one structured log on success (`rsvp.applied`, `bail.requested`, `claim.applied`, `pledge.applied`, `purchase.recorded`, ...) and one on rejection (`*.rejected`) with `{ reason }`.
- **Client errors**: the `/gigs/error.tsx` boundary POSTs to `/gigs/api/log` so client-side render errors land in the same pino stream as `client.error`.
- **Where to read logs**:
  - Local: just run `pnpm dev`, watch the terminal.
  - Vercel preview/prod: `vercel logs <deployment-url> --no-follow` or open the deployment in the Vercel dashboard → Logs tab. Filter by message name (e.g. `rsvp.applied`) to follow a user's path.

## 6. Boundaries

### Always do

- Validate every input at server boundaries with Zod.
- Verify HMAC tokens before any state change.
- Mark single-use tokens consumed on success.
- Keep recipient data scoped to the buyer's account — no leakage between buyers.
- Send plain-text and HTML versions of every email.
- Use the dev-mode email file-logger when `RESEND_API_KEY` is unset.
- Run `pnpm lint` and `pnpm gigs:e2e` before claiming a slice done.

### Ask first

- Adding a new external service (Songkick, Stripe, new email provider).
- Adding a slice's worth of scope to an existing slice.
- Changing the auth model — Google + token URLs is fixed for v1.
- Switching from SQLite-in-dev to Postgres-in-dev.
- Promoting deferred slices (5b, 5c, 6, 6a-d, 7, 7b, 8) before slices 0-4b ship.

### Never do

- No `--no-verify`, no `--no-edit`, no force-push.
- No new account creation for recipients. Period.
- No SMS in v1.
- No payments / Stripe in v1 (Slice 7b is a separate decision).
- No public discovery feed (Slice 8 deferred until 0-7 are real-world tested).
- No public reliability scores / leaderboards. Memory data is buyer-only.
- No mocking internal modules in tests.
- No drive-by refactors of other scratchpad apps.
- No deletion of code I don't fully understand.

## 7. References

- Full plan: `tasks/plan.md`
- Slice-by-slice todo: `tasks/todo.md`
- Scratchpad conventions: `CLAUDE.md`, `AGENTS.md`
- Global style: `~/.claude/AGENTS.md`, `~/.claude/STYLE_GUIDE.md`
