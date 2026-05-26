# Contributing

> Thanks for looking. This is a small project run by a small group. PRs welcome; please read this first.

## The stack, in one breath

- **Next.js 16** (App Router, Turbopack) + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Drizzle ORM** with PGlite for local dev, Neon Postgres in production
- **NextAuth** (Google in prod, dev credentials in non-prod)
- **Resend** for transactional email (writes to `.gigs-outbox/*.json` if `RESEND_API_KEY` is unset)
- **Stripe** deposit holds, behind a flag and optional in dev

See `README.md` for the full env-var table and `SPEC.md` for the module boundaries.

## Local setup

```bash
git clone https://github.com/olitreadwell/arewegoing.git
cd arewegoing
pnpm install
cp .env.example .env.local
pnpm dev
```

That should put you on http://localhost:3000. If it doesn't, open an issue, that's a bug in the docs.

You don't need a real database, Neon key, or Resend key to run locally. PGlite handles the DB, and the outbox handles email.

## Branching

- Branch off `main`. Short, lowercase, hyphen-separated names: `feat/group-rsvp-summary`, `fix/token-replay-window`.
- Conventional commit messages: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`. Subject line under 72 chars, present tense, no period.
- Keep PRs small. One thin vertical slice per branch is better than a 20-file mega-PR.

## Before you open a PR

Run these locally. CI runs them too, but fixing things here is faster:

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
```

If your change touches a flow with an e2e spec, run that too:

```bash
pnpm test:e2e
```

### Optional: run the gates on every push

The repo ships a `pre-push` hook that runs typecheck, lint, and the unit
test suite before any push leaves your machine. Opt in:

```bash
pnpm hooks:enable
```

Skip a single push if you really need to (rare):

```bash
SKIP_PREPUSH=1 git push
```

Or skip a single gate: `SKIP_TYPECHECK=1`, `SKIP_LINT=1`, `SKIP_TESTS=1`,
`SKIP_ACTIONLINT=1`. `pnpm hooks:disable` reverts to git's default hooks.

## PR shape

- Use the PR template. The skim layer (TL;DR, why, what's in, how to review) is the part most reviewers read.
- Open as a draft early. Easier to course-correct before the diff balloons.
- Link the issue (`Fixes #123` / `Closes #123`).
- Keep the depth layer (`<details>` blocks) for design decisions, edge cases, and risks. Don't delete that detail, hide it.

## Code style

Inherits the global rules in `~/.claude/AGENTS.md` plus the project's own `AGENTS.md`. Highlights:

- 2-space indent, single quotes, 80-100 char lines
- Strict TypeScript. No `any` in app code. If you must use `any`, leave a one-line comment saying why
- No `console.log` in app code. Use the pino helper in `lib/log/` (or wherever the project's logger lives)
- No inline styles. Tailwind utilities or component primitives
- Zod schemas at every server boundary (server actions, POST routes, ingest parsers)
- Comments only when the *why* is non-obvious. Don't comment code you didn't change

## Testing

- Co-locate unit tests with the module they cover, or under `__tests__/`
- Mock external APIs (Resend, Stripe, OAuth) only. Don't mock internal modules
- Include an a11y check for new UI (Playwright + axe is the current pattern)

## Coop note

This project is being incorporated as a worker cooperative. Some practical notes for now:

- If you'd like your contribution attributed to a coop entity (yours, ours, someone else's), say so in the PR description. We'll track it.
- A formal CLA will exist once the coop is incorporated and the licence is decided (see `README.md`).
- Until then, please treat your contribution as offered in good faith under whatever licence the project ends up shipping under. We will not weaponise that against a contributor.
- If that's a blocker for you, open an issue and we'll talk before you write code.

## Questions

- Bug or feature idea: use the issue templates in `.github/ISSUE_TEMPLATE/`
- Security issue: see `SECURITY.md`, don't open a public issue
- Anything else: oliver.treadwell@gmail.com
