# Group ticket coordination, owned by the people who use it

**Version 0.1 — 2026-05-26**
**Status: Living draft, iterated alongside the prototype.**

> A friends-first ticket coordination tool for live music in Aotearoa. Built as a worker cooperative. Designed to send a share of the value back to the artists, promoters, and venues whose work the platform sits on top of.

This proposal is the case for funding the next 12 months of work. It is short on the front, deep in the back. Skim the top, open the depth blocks if you want the engineering, financial, and governance detail.

## The ask

- **Pre-seed**: NZD $120k–$180k for 12 months of one full-time engineer (the founder) and part-time community + design contractors.
- **Structure**: not equity in the traditional sense. Funders get a redeemable note plus an advisory seat on a transitional board, with founder commitment to convert to a worker-cooperative structure (ICA / Companies Office Co-op) within 18 months.
- **Use of funds**: 60% engineering and infrastructure, 20% community + onboarding work in Wellington's live-music scene, 10% legal (coop incorporation, contracts with promoters), 10% reserve.

## Why this exists

- **Friends don't have a tool for this.** Group ticket buying happens in WhatsApp threads, Splitwise rows, and shared notes. It's slow and people miss out.
- **Promoters lose group sales they didn't know were lining up.** When a crew of 6 would have bought at presale, the promoter never finds out because the crew couldn't get organised in time.
- **Artists rarely see a cut of the secondary fee.** Every fee a fan pays a ticket reseller is value the artist will never see again.
- **The existing platforms extract.** DICE, Ticketmaster, Eventbrite, SeatGeek take per-ticket fees and the model is built around growth quarters, not community sustainability.

## What we're building

A coordination layer that sits on top of existing ticketing, not a new ticketing platform. The friend group is the unit. The festival or gig is the object. Money only changes hands when the group decides to commit.

### Tier 1 — intent (cheap to ship, high utility)

- **Are you going?** A one-tap signal per friend per event.
- **Subscriptions to venues, artists, promoters.** When something new gets announced, the right people hear about it. Filtered by what their friend group also likes.
- **Group taste.** "Five of your friends would buy a ticket to Frank Booker at Meow if it goes on sale." Built by intersecting each member's followed-artist list.
- **Annual festival mode.** "Are you doing Splore this year?" with three buttons: going, maybe, not this year. History across years. (See depth block below.)

### Tier 2 — organiser interaction (mid effort, mid value)

- **Promo-code ask.** Once N+ friends in a group have signalled intent, the system drafts an email to the promoter asking for a group code. Promoter sees a real, named crowd, not an anonymous DM.
- **Event history per friend group.** "We went together to Homegrown 2024, Splore 2025." Trivial to derive from existing data, valuable in conversation.
- **Surfaced event details.** Set times, support acts, cancellations, follow links to the artist's Instagram or Bandcamp. The data is already in the ticketing pages we ingest; we just don't show it yet.

### Tier 3 — money and logistics (heavier, only once the group is bought in)

- **Group buys with deposits.** Weekly $5/$10/$20 contributions toward your festival ticket starting months before the sale. Money as commitment, not just intent.
- **Bail and resale.** Built. Lives at face value, friends-first, then opens to a public waitlist. Refund automation.
- **Spare tickets.** "Sam has one extra to Eden Burns. First reply gets it."
- **Sub-event coordination.** Campsites, carpools, pre-drinks, arrival times. Each is its own RSVP graph attached to the parent event.

## Why a worker cooperative

- **The product is a public utility for a niche scene.** Wellington's live music community is small and tightly networked. Extractive ownership would be felt and rejected.
- **The work scales with members, not with capital.** Adding one engineer or one community contractor produces more value than adding a marketing dollar. That's the worker-coop shape, not the venture shape.
- **Surplus goes back to the scene, not to a cap table.** Profit caps with the remainder flowing to a Wellington music infrastructure fund. (See depth block on governance.)
- **Identity matches the audience.** "Built by people who go to the same gigs you do" is a defensible position the platforms can't copy.

## How money flows back to artists and organisers

Three explicit mechanisms, none of them charity:

1. **Promoter rebate on group buys.** When a friend group buys 5+ tickets through a group code negotiated via the platform, 50% of any platform fee on those tickets is rebated to the promoter. The promoter who took the call earns more than the promoter we contacted but never converted.
2. **Artist tip jar at the point of pledge.** When a friend pledges to a gig, a tip jar appears alongside. Small ($2 / $5 / $10). 100% pass-through to the artist or band. Platform takes nothing.
3. **Festival surplus fund.** At year-end, any operating surplus the worker coop generates is split: 40% retained as reserve, 30% to a Wellington music infrastructure fund (sound engineers' wages at small venues, sub-NZD-25 gig subsidy, recording grants), 30% as patronage dividend to active worker-coop members.

The numbers above are starting points and would be set by the cooperative's first general meeting. They are explicit in the proposal so funders know the shape, not the exact percentages.

## Where we are today

- **Working prototype.** Next.js 16 app deployed to Vercel. ~16,000 lines of code, 25 test files, 13 named slices shipped on the branch.
- **Real ingestion.** Adapters for 6 ticketing platforms (Humanitix, Moshtix, Flicket, Ticketek, TicketFairy, Under the Radar) plus Eventfinda discovery and email-forward parsing. Songkick for artist subscriptions.
- **Signed-token architecture.** No account required for recipients. Validates against Calendly, Eventbrite, and Apple Wallet patterns.
- **Pledge, bail, resale flows.** Built and tested. Stripe deposit holds available behind an env flag, stub by default.
- **Live preview**: `https://scratchpad-git-feat-gigs-app-olitreadwells-projects.vercel.app/gigs`.

## How a year of investment compounds

Three lanes run in parallel.

1. **Festival mode v1 → general availability.** Splore 2027, Rhythm and Vines, Soundsplash, Homegrown, Bay Dreams, Northern Bass curated as canonical festival objects. "Are you going?" surface live before October 2026.
2. **First promoter relationships.** 3–5 Wellington promoters (Welcome to Nowhere, Heaters, Pure Loft Productions, Movement, anyone we can name and shake hands with) opted in to receive group-buy enquiries.
3. **Worker coop formalised.** Trust deed and incorporation done by month 12. First three workers under coop employment contracts.

## One question for funders

Are you willing to back a redeemable note that converts to coop membership rights rather than equity, knowing the upside is capped and the downside is your principal? Everything else flows from that decision.

---

<details>
<summary><strong>Engineering detail — current architecture state</strong></summary>

- **Stack**: Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS 4, shadcn/ui, Drizzle ORM, PGlite (local) + Neon Postgres (production), NextAuth (Google + dev creds in non-prod), Resend, Stripe (deposit holds, behind a flag), pino + pino-pretty for structured logs.
- **Why this stack survives funding**: Vercel hosting is cheap until traffic is real. Neon Postgres scales. Stripe deposit holds are the only paid integration. Resend handles email at $20 per 50k. The whole prototype runs for under $50 a month at current usage.
- **Token-based architecture**: HMAC sha256 signed tokens. Recipients never sign up. Same pattern as Calendly. Validated against attacker-model unit tests (16 scenarios in `tokens-adversarial.unit.ts`).
- **Observability**: pino structured logs across every server action and API route. Client-side error beacon. Loading and error states on every segment. Empty states with concrete CTAs on every list page.
- **Test coverage**: 21 unit tests, 4 Playwright e2e specs, currently green.
- **Open security work**: 5 issues found in self-audit, 5 fixed (HMAC fallback in prod, dev auth escape hatch, inbound webhook fail-open, resale claim wrong-listing race, token consumption ignoring action). Documented in the PR review comment trail.

</details>

<details>
<summary><strong>Festival mode — the wedge product</strong></summary>

Annual festivals are the cleanest wedge for v1. Most of the calendar discovery infrastructure becomes optional because there are roughly 15 festivals per year in NZ worth coordinating around, and they're hand-curated.

**Festival objects (year 1 scope)**:
- Splore (Tāpapakanga, Feb)
- Rhythm and Vines (Gisborne, NYE)
- Soundsplash (Raglan, Jan)
- Northern Bass (Mangawhai, NYE)
- Homegrown (Wellington, March)
- Bay Dreams (Mt Maunganui + Nelson, Jan)
- Wellington Jazz Festival (June)
- WOMAD (New Plymouth, March)
- Cuba Dupa (Wellington, March, free but coordination still useful)
- 4–6 more curated based on the community's actual asks

**Schema move**: events table grows a `kind` enum (`gig | festival | sub_event`) and a nullable `parent_event_id`. A festival has tiers (weekend, day pass, camping, VIP) as joined rows. Sub-events (campsite, carpool, pre-drinks) attach via `parent_event_id`.

**RSVP/pledge/bail composes**: every primitive already shipped for atomic gigs works on a festival or a sub-event. No new state machine required. The graph is just deeper.

**Time horizon**: target Splore 2027 presale (estimated October 2026) for the public soft launch.

</details>

<details>
<summary><strong>Worker coop governance — how decisions get made</strong></summary>

- **Structure**: New Zealand cooperative company under the Co-operative Companies Act 1996. Worker shares (one share per worker, one vote regardless of capital contribution).
- **Founding workers**: the engineer-founder (Oli), plus seats reserved for design contractor, community organiser, and a Wellington-music-scene representative as those roles are filled.
- **Board (transitional, year 1)**: founder + two advisor seats funded by the pre-seed notes. Converts to elected worker-coop board by month 12.
- **Patronage dividend**: per the rules of the coop, surplus may be distributed to workers based on hours and contribution rather than capital. This is the legal mechanism that lets the coop reward labour without becoming a charity.
- **Investor exit**: pre-seed notes are redeemable from operating cash flow once the coop has 18 months of runway in reserve. Capped multiple (1.5x to 2x, to be set in the term sheet). No equity-style ownership of the coop itself; the redeemable note is debt-like.
- **Why this shape**: keeps the door open to genuine cooperative ownership without forcing the early funders to take on coop-member obligations. They get their money back with a fair multiple; they don't get long-tail control.

</details>

<details>
<summary><strong>Revenue model — how the coop sustains itself</strong></summary>

Three modest streams, deliberately ordered so the platform fee is the smallest:

1. **Promoter relationships (largest)**. Promoters pay a small monthly fee ($50–$200) for a Promoter Hub view: which friend groups are talking about their events, which sales windows have warm leads, which group-code asks landed. Optional, transparent, opt-in.
2. **Group-buy facilitation fee**. When the platform brokers a group-code purchase of 5+ tickets, a 1–2% fee applies on top of face value. 50% rebated to the promoter. The buyer sees the fee transparently before pledging.
3. **Festival surplus fund (governance-distributed)**. Voluntary $1–$5 tip at the moment of pledging. 100% pass-through to the artist where possible; where not, accrues to the surplus fund and is distributed annually.

**Explicit non-revenue**: no platform fee on the friend-to-friend RSVP flow itself. The free tier is the actual product. Money only enters the model when there's a counter-party (promoter or artist) who is also benefiting.

**Year 1 forecast (rough, low-confidence)**: 50–150 active friend groups in Wellington by year-end, 3–5 promoter relationships, NZD $30k–$60k revenue against a $150k cost base. The coop is not breakeven in year 1. That is what the pre-seed funds.

</details>

<details>
<summary><strong>Competitive landscape — what we learned</strong></summary>

Two research scans inform this proposal:

1. `src/app/gigs/COMPETITIVE-NOTES.md` — standalone tools (Partiful, Hobnob, Lu.ma, Splitwise, DICE, Posh, Audience Republic, Withfriends, Eventbrite, Songkick, Bandsintown, RA, Skiddle, Calendly).
2. `src/app/gigs/COMPETITIVE-NOTES-PLATFORMS.md` — features inside major consumer platforms (Meta, Apple, Google, Spotify, Discord, Snapchat, TikTok, Ticketmaster, SeatGeek).

**The architectural validation across both scans**: every platform that does this well runs transfer, invite, and pledge through one-time tokens or signed links. The prototype already does this.

**The five UX moves on the borrow list**:
1. Spotify import on first run (Bandsintown).
2. Face-value bail-to-pledge handoff (DICE + Apple Wallet).
3. Net-balance roll-up across gigs (Splitwise).
4. Pre-pledge "interested" soft state (Skiddle + Facebook Interested + Discord).
5. Per-event resale config (RA).

**The five patterns to actively avoid**:
1. Phone-as-identity (Partiful, Apple Cash, WhatsApp Events).
2. Account creation at claim time (SeatGeek, Apple Invites).
3. Per-ticket platform tax (Eventbrite, Posh).
4. Numeric scoring of complex signals (SeatGeek Deal Score raw).
5. Notification firehose (Bandsintown).

</details>

<details>
<summary><strong>Risks and mitigations</strong></summary>

- **Risk**: The ticketing platforms shut us out of their HTML. **Mitigation**: we already have adapters for 6 platforms plus email forwarding. Email forwarding is the truly resilient ingestion path.
- **Risk**: Promoters don't engage with the group-code asks. **Mitigation**: start with promoters Oli knows personally in Wellington (5+ on the list). Year 1 success looks like 3 of them in the loop, not 30.
- **Risk**: The coop legal structure takes longer than 12 months. **Mitigation**: pre-seed notes don't depend on coop incorporation. The founder operates as a sole trader for year 1; the coop incorporation is a year-end goal, not a precondition.
- **Risk**: NextAuth, Stripe, or Neon pricing changes break unit economics. **Mitigation**: all are commodity services with multiple competitors. Switching cost is real but not catastrophic.
- **Risk**: The friend-group market is too small to support a coop wage. **Mitigation**: the promoter relationship is the actual revenue. Friend groups are the demand surface that makes the promoter pay. We've sized this at 50–150 active groups in year 1, which is a small fraction of Wellington's gig-going population.

</details>

<details>
<summary><strong>Founding context — why Wellington, why now</strong></summary>

- Wellington has a tightly networked live-music scene that has not yet been served by a fan-side coordination tool.
- The prototype was built by a Wellington gig-goer who is already in the friend group the product is designed for.
- The Wellington DJ scene specifically (Christopher Tubbs, Frank Booker, Eden Burns, the broader Goodthings / Heaters / Welcome to Nowhere orbit) is the canonical use case. Five of us hear about a Frank Booker presale and want a way to say "I'd buy" without committing money on a promoter's homepage.
- The Aotearoa music scene has live conversations about ticket gouging, predatory secondary markets, and the need for fan-owned alternatives. This proposal is one entry in that conversation.
- The Cooperative Companies Act 1996 is well-suited to the structure. Other NZ cooperatives (Foodstuffs, Farmlands, Mitre 10, Silver Fern Farms) have made worker-and-customer-owned at scale a known shape.

</details>

---

## Things to refresh as ideas develop

When you tell me about new features, I update Tier 1 / 2 / 3 and the festival mode block. When you have new competitive insights, I update the relevant depth block. When the numbers firm up (rate of group adoption, promoter relationships, real cost base), I update the ask and the revenue model.

Treat this as a Git-tracked living document, not a deck.

## Open questions that need your answer

- **Funder shape**: who specifically are we approaching? Friends-and-family round, a music-aligned community fund, a coop-aligned investor (Mātauranga Co-op Fund or similar)?
- **Coop legal lead**: do you have an introduction to a Wellington cooperative lawyer? Names: Brookfields, Anthony Harper, or smaller coop-specialist firms.
- **First promoter relationships**: which 3–5 names do we approach in week 1?
- **Brand**: what is this product called when it's not "the gigs prototype"?

## Revision history

- **v0.1 (2026-05-26)**: First draft. Incorporates the Tier 1/2/3 feature framing, festival-mode wedge, two competitive scans, the worker-coop governance shape, and a preliminary funding ask. Numbers are placeholders.
