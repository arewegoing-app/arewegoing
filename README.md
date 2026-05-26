# are we going?

Group ticket coordination for live music. Friends decide together, no signup for the people you invite, money only moves when the group commits.

Built as a worker cooperative from day one. See [`PROPOSAL.md`](./PROPOSAL.md) for the funding case.

## Origin

The prototype lived at `github.com/olitreadwell/scratchpad` under `src/app/gigs/`. Full git history of that prototype is preserved in this repo via `git filter-repo`. The original code review trail lives in [scratchpad PR #6](https://github.com/olitreadwell/scratchpad/pull/6).

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind CSS 4 + shadcn/ui
- Drizzle ORM, PGlite for local dev, Neon Postgres in production
- NextAuth (Google + dev credentials in non-prod)
- Resend for transactional email, Stripe deposit holds behind a flag
- pino + pino-pretty for structured logging

## Commands

```bash
pnpm install
pnpm dev               # local at http://localhost:3000
pnpm build             # production build
pnpm test:unit         # run all unit tests
pnpm test:e2e          # run Playwright e2e
pnpm reset             # clear local PGlite + outbox
```

## Environment variables

Set in `.env.local` for dev, in Vercel for previews and production.

| Name | Required | Notes |
|---|---|---|
| `AUTH_SECRET` | yes (prod) | 32+ random chars for NextAuth |
| `GIGS_TOKEN_SECRET` | yes (prod) | 32+ random chars for signed action tokens; the server throws on first use if unset under `NODE_ENV=production` |
| `DATABASE_URL` | optional | Neon Postgres connection string. If unset, PGlite (in-memory in serverless) is used |
| `RESEND_API_KEY` + `RESEND_FROM` | optional | If unset, emails write to `.gigs-outbox/*.json` for local testing |
| `INBOUND_SECRET` | required to use inbound webhook | Bearer token for `/api/inbound/email`. Route returns 503 if unset and `INBOUND_AUTH_OFF=1` is not set |
| `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` | optional | Enables Google OAuth alongside dev creds (non-prod only) |
| `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` | optional | Switches deposit holds from stub to live |
| `LOG_LEVEL` | optional | `debug` / `info` / `warn` / `error`; defaults to info in prod, debug in dev |

## Reading logs

- **Local**: `pnpm dev`, watch the terminal. pino-pretty colourises and indents.
- **Vercel**: `vercel logs <deployment-url> --no-follow`, or open the deployment in the dashboard and filter by event name (`rsvp.applied`, `bail.requested`, `claim.applied`, etc).

## Docs

- [`PROPOSAL.md`](./PROPOSAL.md) — funding proposal v0.2, worker coop from day one
- [`SPEC.md`](./SPEC.md) — engineering spec
- [`COMPETITIVE-NOTES.md`](./COMPETITIVE-NOTES.md) — standalone-tool research
- [`COMPETITIVE-NOTES-PLATFORMS.md`](./COMPETITIVE-NOTES-PLATFORMS.md) — in-platform feature research

## License

[AGPL-3.0](./LICENSE). Strong copyleft, coop-friendly by default. Anyone running a modified version over a network must share the source. We may add a coop-aligned additional permission under section 7 once the coop is incorporated.
