# Messaging integrations: spec and recommendation

> **TL;DR.** Ship a "Share to WhatsApp" deep-link button now. Build a Discord bot second, only if a real community asks. Skip Slack and Telegram bots for v1. WhatsApp bots cannot join group chats, so a bot route is the wrong shape for the primary audience.

Scan date: 2026-05-29. Spec owner: arewegoing core team.

## Section 1 — Capabilities matrix

### Discord

1. **Programmable surface.** "Application" with a bot user, slash commands, message components (buttons, select menus), modals, scheduled events, and embedded Activities. Gateway WebSocket + REST. Source: https://discord.com/developers/docs/intro
2. **Auth model.** Discord user ID is stable per account. OAuth2 (`identify`, `email`, `guilds.members.read`) maps a Discord user to an arewegoing account. Bots can DM users who share a guild with the bot. Bots cannot post as a user.
3. **Rich UI.** Buttons, dropdowns, modals, embeds with thumbnails, scheduled-event objects with a native "Interested" count. Source: https://discord.com/developers/docs/interactions/message-components
4. **In-group RSVP.** Yes. Post an embed with Going / Maybe / Can't buttons. Interaction payload carries the user ID. Trivial to capture.
5. **Outbound notifications.** Channel posts and DMs both work, subject to the user sharing a guild with the bot.
6. **Cost.** Free to operate the bot. Hosting cost is the only ongoing line.
7. **Approval.** Self-serve until 100 servers. Verification + (optional) "Message Content Intent" review needed past that. Slash commands avoid the message-content intent entirely.
8. **End-user friction.** Server admin clicks an OAuth install link, picks the server, accepts scopes. Friend-group servers usually have one admin who can do this in under a minute.
9. **NZ specifics.** None.

### Slack

1. **Programmable surface.** Slack App via manifest, Bolt SDK (Node/Python), Block Kit UI, slash commands, shortcuts, modals, workflow steps. Source: https://api.slack.com/start
2. **Auth model.** Slack workspace user ID, OAuth identity scopes. Bots can DM workspace members.
3. **Rich UI.** Block Kit: sections, buttons, selects, datepickers, modals.
4. **In-group RSVP.** Yes, via Block Kit buttons in a channel. Interaction payload carries user ID.
5. **Outbound notifications.** Channel posts, DMs, scheduled messages.
6. **Cost.** Free to build. Free Slack workspaces cap message history at 90 days, which affects audit but not RSVP capture.
7. **Approval.** Public distribution requires Slack App Directory review. Internal-only or unlisted distribution does not.
8. **End-user friction.** Workspace admin installs via OAuth link. Friend groups rarely have a Slack workspace.
9. **NZ specifics.** None.

### Telegram

1. **Programmable surface.** Bot API (HTTP long-poll or webhook) + Mini Apps (web views inside Telegram with `Telegram.WebApp` JS bridge) + inline mode. Sources: https://core.telegram.org/bots/api, https://core.telegram.org/bots/webapps
2. **Auth model.** Telegram user ID, optional Telegram Login Widget for site-side mapping. Mini Apps receive a signed `initData` payload that proves the user identity to the server.
3. **Rich UI.** Inline keyboards (buttons), reply keyboards, polls, Mini Apps (full HTML/JS).
4. **In-group RSVP.** Yes. Add the bot to a group, post a message with an inline keyboard. Each tap fires a callback with the user ID. Privacy mode default keeps the bot from reading every message but does not block button callbacks.
5. **Outbound notifications.** DM users who have started the bot, post in groups the bot is in. Cannot cold-DM.
6. **Cost.** Free. No per-message fee.
7. **Approval.** None. Create via @BotFather in two minutes.
8. **End-user friction.** Someone in the group adds the bot via username or share link. No admin tier required for small groups.
9. **NZ specifics.** None. NZ Telegram base is small but real.

### WhatsApp

1. **Programmable surface.** WhatsApp Business Cloud API (Meta-hosted) and WhatsApp Flows (embedded forms inside chat). Sources: https://developers.facebook.com/docs/whatsapp/cloud-api/, https://developers.facebook.com/docs/whatsapp/flows/
2. **Auth model.** Phone number. No OAuth. Mapping a WhatsApp user to an arewegoing account means "ask for their phone or have them message the bot first."
3. **Rich UI.** Quick-reply buttons (max 3), list messages, interactive templates, Flows (multi-step forms rendered inside the chat).
4. **In-group RSVP.** **No.** Business bots cannot be added to consumer group chats. This is the headline constraint. See section 2.
5. **Outbound notifications.** 1:1 only. Inside the 24-hour customer-service window, free-form. Outside it, only pre-approved template messages, billed per conversation.
6. **Cost.** Conversation-based pricing. First 1,000 service conversations per month free per WABA. Marketing and utility templates billed per conversation, NZ rates roughly USD $0.03-0.08 depending on category. Source: https://developers.facebook.com/docs/whatsapp/pricing/
7. **Approval.** Meta Business verification (legal name, address, business documents) required to scale past the test number's 50-recipient cap. Often takes 1-3 weeks and can be rejected for thin business profiles. App Review needed for advanced permissions.
8. **End-user friction.** Either the user clicks a `wa.me` link to start a chat with the bot, or they scan a QR. There is no "add bot to group" path.
9. **NZ specifics.** Test phone number is provisioned by Meta. Production sender numbers need a business phone Meta can verify. NZ numbers work fine. WhatsApp adoption in Wellington friend groups is high.

## Section 2 — WhatsApp deep dive

### 1. Cloud API in one paragraph

Meta-hosted REST API. Send and receive messages, templates, media, interactive buttons, and Flows. No need to run your own WhatsApp client. Webhooks deliver inbound messages to your server. https://developers.facebook.com/docs/whatsapp/cloud-api/

### 2. The group-chat wall

Confirmed: WhatsApp Business APIs (Cloud API and the older On-Premise API) cannot send to or receive from group chats. Meta has stated this is intentional for spam control and end-to-end-encryption reasons. Bots only work in 1:1 conversations with users who have either messaged the business number first or accepted a template message. There is no public API to add a bot to a consumer group. The "Events in WhatsApp Communities" product is a first-party Meta feature, not something third-party apps can plug into.

**Implication.** Any "RSVP inside the group chat" UX on WhatsApp is impossible without Meta either opening group APIs or us becoming a first-party feature. Both are out of scope.

### 3. Workarounds

- **`wa.me` deep links.** `https://wa.me/?text=<URL-encoded-text>` opens WhatsApp's share sheet with the text pre-filled. The user picks the group, hits send. No API, no verification, works today.
- **Rich preview cards.** WhatsApp renders OpenGraph previews for shared URLs. A good `og:image` on `/group/[uuid]/calendar` gives a free preview tile inside the group chat. This is the single highest-leverage change.
- **Broadcast lists.** A WhatsApp user (not a bot) can create a broadcast list of up to 256 contacts. Each recipient gets a 1:1 message. Not bot-driven, not relevant to us.
- **1:1 bot for reminders.** A user could DM our bot to say "remind me about Beths gig". This works but adds friction (number lookup, opt-in, template approval for reminders sent outside the 24-hour window). High effort, low payoff at our scale.
- **WhatsApp Flows.** Embedded forms inside the chat. Useful if we wanted users to RSVP via a form inside a 1:1 chat with our bot, but it does not solve the group-coordination problem.

### 4. Realistic UX without a group bot

A "Share group calendar to WhatsApp" button on `/group/[uuid]/calendar`:

1. User clicks "Share to WhatsApp".
2. Browser opens `https://wa.me/?text=Going%20to%20these%3F%20https%3A%2F%2Farewegoing.app%2Fgroup%2F<uuid>%2Fcalendar`.
3. WhatsApp share sheet appears. User picks the group thread.
4. Group sees the rich preview card (OG image, title, "X friends, Y events").
5. Anyone in the group taps the link, lands on the calendar, RSVPs in the web app. No login.

This is the de facto integration today, just without a button. Adding the button and a sharp OG card is one afternoon of work.

### 5. Is a WhatsApp bot worth doing for v1

**No.** The reasons stack:

- The bot cannot live in the group chat where the audience already coordinates.
- 1:1 reminder bots add friction (template approval, number opt-in) for value the web app already delivers via email.
- Meta Business verification consumes 1-3 weeks of calendar time and can fail.
- Per-conversation pricing means the bot becomes a line item the moment it succeeds.

The minimum-viable WhatsApp integration is the share-link button. Do that. Reassess a 1:1 bot after we have 100+ active groups asking for it.

## Section 3 — Comparison and recommendation

### Comparison

| Platform | In-chat RSVP | Group bot | Identity mapping | Cost | Approval friction | NZ relevance |
|---|---|---|---|---|---|---|
| Discord | Yes, buttons | Yes | OAuth, stable user ID | Free | Low until 100 servers | Medium (younger users, music communities) |
| Slack | Yes, Block Kit | Yes | OAuth, workspace ID | Free | App Directory review for public distribution | Low for friend groups |
| Telegram | Yes, inline keyboard | Yes | Login Widget or Mini App initData | Free | None | Low-medium, growing |
| WhatsApp | No | **No** | Phone only | Per-conversation fees | High (Meta Business verification) | **High** |

### Recommendation

1. **Now (v1).** Ship a "Share to WhatsApp" button on every group calendar page. Tighten the OG card on `/group/[uuid]/calendar` so the preview inside WhatsApp shows event count, friend count, and a clean header image. Estimated payoff: matches where the audience already is, zero ongoing cost, no platform approval.

2. **Next (v1.1, demand-driven).** Discord bot. Only build it once a real user (not a hypothesis) asks. Scope: slash command `/awg invite <calendar-url>` posts an embed with Going / Maybe / Can't buttons; clicks RSVP into arewegoing via a signed token tying the Discord user ID to a server-side ephemeral identity. No mandatory account link.

3. **Defer (post-v1).** Telegram bot. Same shape as Discord. Build only if a NZ Telegram-heavy community surfaces.

4. **Never (for friend groups).** Slack bot. Wrong surface for the audience. Reconsider only if we pursue a B2B angle (venues, promoters running internal Slacks).

5. **Architecture.** A single thin "messaging" module with one webhook entrypoint per platform is enough. Do not build a general "bot framework" until two platforms are live and the shared shape is obvious. Premature abstraction would slow the first integration.

6. **Bigger question.** The share-link is already the de facto integration. If the share button + OG card lands 80% of the value, the bot route is over-engineering for v1. The bar for building a bot is: a user community we have already converted asks for it and would otherwise churn.

## Section 4 — Build cost estimate

### Share-to-WhatsApp button + OG card

- **Engineering:** 0.5 to 1 day.
- **Dependencies:** None new. Existing Next.js OG image route, existing share intent.
- **Ongoing cost:** None.
- **Approval:** None.

### Discord bot (only if pulled by demand)

- **Engineering:** 1 to 2 weeks for slash command, RSVP buttons, identity link, basic admin install flow.
- **Dependencies:** `discord-api-types`, `discord-interactions` (or `discord.js` if we want gateway), a public HTTPS endpoint for interaction webhooks. Vercel Functions are fine.
- **Ongoing cost:** Hosting only. No per-message fees.
- **Approval timeline:** None until 100 servers. Plan a verification + intent review later if needed.

### Telegram bot (deferred)

- **Engineering:** 1 to 1.5 weeks. Slightly simpler than Discord but Mini App work adds time if we want a richer RSVP UI.
- **Dependencies:** `grammy` or `telegraf`. Webhook endpoint.
- **Ongoing cost:** Hosting only.
- **Approval:** None.

### WhatsApp 1:1 reminder bot (not recommended for v1)

- **Engineering:** 2 to 3 weeks once verification clears. Template approval, opt-in flow, conversation-window state machine.
- **Dependencies:** Meta Business account, verified phone number, Cloud API access, template approvals per message type.
- **Ongoing cost:** Per-conversation fees, NZ marketing tier roughly USD $0.05 each at current rates.
- **Approval timeline:** 1 to 3 weeks for Meta Business verification, plus per-template review.

## Section 5 — Meta deep dive (Messenger group bots, WhatsApp Flows)

### Messenger group bots — the closest thing to "RSVP in the chat"

Facebook Messenger Platform technically supports bots in group threads via the Handover Protocol and the Send API with `recipient.thread_key`. Source: https://developers.facebook.com/docs/messenger-platform/discovery/group-conversations/

Prior art: Pluto (shut down 2018), Sephora's group gifting bot (2017), PartyRound (2017-2019). The shape worked. Why it doesn't ship today:

- Bots can only join group threads where every member opted in to third-party apps in their Messenger privacy settings. Most users have not.
- `pages_messaging` permission requires Meta App Review (same wall as WhatsApp).
- Many group thread features moved behind discontinued products (Workplace).
- Messenger usage in NZ friend groups is an order of magnitude below WhatsApp.

Verdict: technical path exists, audience does not. Skip.

### WhatsApp 1:1 bot with "rally the group" fan-out pattern

The most honest WhatsApp answer. The bot lives in 1:1 chats; coordination fans out into the group thread via humans.

Flow:
1. Organiser picks 5 friends, hits "Send via WhatsApp" on arewegoing.
2. Each friend gets a 1:1 template message: "Oli is going to The Beths on Friday. Reply YES, NO, or MAYBE."
3. Friend replies in their 1:1 thread; bot writes RSVP to arewegoing.
4. Bot posts back: "5 of 5 friends replied. 4 yes, 1 maybe. Tap to see who's going: arewegoing.app/group/abc123/calendar"
5. Organiser sees live tally in the web app, optionally shares the calendar link into the actual group chat using `wa.me`.

Closest reference implementation: Twilio's "WhatsApp RSVP bot" tutorial at https://www.twilio.com/docs/whatsapp/tutorial/build-a-whatsapp-rsvp-application. Other patterns: Glide's WhatsApp event RSVPs templates, Tigerhall (Singapore, NZ-relevant tone).

Costs that stack:
- Meta Business verification: 1-3 weeks, can fail. arewegoing as a worker-coop pre-incorporation will likely fail today. **This is the actual blocker.**
- Dedicated NZ business phone number.
- Template approval for every outbound message shape (24-72h each, can be rejected).
- Per-conversation fees, NZ utility tier roughly USD $0.04-0.06 each.
- 24-hour window: freeform only inside it; outside, only pre-approved templates.

Realistic timeline: **4-7 weeks**, mostly Meta-side waiting. Discord MVP is 1 week, no waiting, no approvals.

### WhatsApp Flows — the wildcard

Embedded forms inside the 1:1 chat. Multi-step RSVP form renders natively. Source: https://developers.facebook.com/docs/whatsapp/flows/

Why it might work:
- Group-level UX inside a 1:1 chat; the user never sees the constraint.
- Lower template-approval burden once the Flow is approved.
- Richer than buttons (dropdowns, multi-step, conditional logic).
- Newer (2023); few competitors.

Why it might not:
- Still requires Meta Business verification.
- Still 1:1, not in the group thread.
- Flows tooling is thinner than the rest of the Cloud API.
- No "send a Flow to a group" primitive.

References: KLM, Vodafone India, Spotify (briefly) — customer-service Flows. Meta's own "appointment booking" demo Flow is structurally close to "RSVP to a gig".

### Updated recommendation

1. **Discord MVP first** in a worktree (1 week eng, no platform approvals).
2. **Start Meta Business verification in parallel** — it's calendar time, not eng time. No commitment lost.
3. **After Discord ships + verification clears**: WhatsApp 1:1 bot with the fan-out pattern, plus a Flow for the RSVP form. Reuses identity-link table, RSVP table, conversation state machine from Discord.
4. **Never**: Messenger group bot. Audience isn't there, Meta restrictions tightening.

## Section 6 — Open-source references worth studying

### Telegram (strongest open-source ecosystem)

- `python-telegram-bot/python-telegram-bot` — canonical Python SDK; `examples/conversationbot.py` + `examples/inlinekeyboard.py` cover the two patterns we need.
- `grammyjs/grammy` — modern TypeScript SDK; better ergonomic fit for a Next.js codebase. https://grammy.dev/
- `telegram rsvp bot` on GitHub — multiple small (100-500 LOC) RSVP-specific bots with the inline-keyboard tally pattern. Mostly Python, mostly long-poll. Worth reading for patterns, not forking.

### Discord

- **`discord/cloudflare-sample-app`** — the single most useful repo to read before writing a line. Edge function, signed webhook verification, slash commands, message components, MIT-licensed, ~500 LOC. https://github.com/discord/cloudflare-sample-app
- `discordjs/discord.js` — canonical SDK, mature.
- `discord-api-types/discord-api-types` — typed REST primitives; better fit for serverless route handlers (no persistent gateway).
- **Closed but UX gold standard**: Sesh, Apollo, Raid-Helper. Worth studying their install flow + embed layout before designing our own.

### Matrix (wildcard for federated bridging)

- `maubot/maubot` — Python plugin framework; community RSVP and poll plugins exist.
- `mautrix/whatsapp` — bridges Matrix rooms to WhatsApp chats via the unofficial `whatsmeow` protocol. **TOS grey zone**; Meta has banned bridge accounts. Knowing it exists matters; shipping on it does not.
- `mautrix/telegram` — same idea, lower risk because Telegram's TOS is more permissive.

### WhatsApp

- **TOS-compliant**: `tawn33y/whatsapp-cloud-api` (Node, typed, small surface). Twilio's WhatsApp RSVP tutorial (MIT-licensed sample).
- **TOS-violating**: `tulir/whatsmeow` (Go), `WhiskeySockets/Baileys` (JS). Reverse-engineered WhatsApp Web protocol. Powers the bridges. Not a foundation for a public product — works until Meta notices.

### Recommendation on forking

Don't fork an existing RSVP bot. The good ones are mostly Python, mostly long-poll, mostly abandoned, and mostly don't map to a serverless Next.js codebase. Read them for patterns. Build fresh on the right primitives for our stack:

1. **Read** `discord/cloudflare-sample-app` end to end (~500 LOC, the deployment shape).
2. **Read** `grammy` or `discord-api-types` docs (the SDK ergonomics).
3. **Read** `tawn33y/whatsapp-cloud-api` (the WhatsApp Cloud API shape for the eventual port).
4. **Build** the identity-link table, RSVP-capture table, and webhook-verify helper generic from day one. Those three are ~80% of the WhatsApp port.

## Section 7 — Product-shape ideation (read this before committing eng time)

This section is strategic, not technical. The earlier sections answer "what is buildable". This one asks "what should we build at all".

### The framing the platforms make us forget

What makes arewegoing different from every other event app: **friends decide together** and **the people you invite never sign up**. Every messaging integration should be judged on whether it preserves or destroys those two properties. A bot that requires every friend to install something is worse than email. A bot that requires every friend to have an arewegoing account is worse than email. A bot that posts a tally everyone can see and tap, without any of them signing up, is **better** than email — and that pattern only exists on Discord, Telegram, and Messenger. Not WhatsApp. WhatsApp's group identity is phone numbers, which is too sensitive to expose to a bot. The API restrictions are downstream of that fact.

### Five product shapes to consider

**1. The lurker bot.** Bot lives in the group, notices "anyone going to The Beths Friday?" via regex, posts an RSVP card unprompted. Discord restricts it (message content intent review). Telegram allows it freely. The most magical UX, the least fashionable pattern. Prior art: EmacsBot, Hubot, Errbot from 2014-2017 chatops.

**2. The share-target bot.** No bot in the group. You share an arewegoing URL into the group; the URL preview *is* the RSVP card. Friends tap and land on a calendar that already knows which group they came from via a signed token. When 5 people from the same WhatsApp thread tap the same URL within 10 minutes, the app infers the group from co-arrival. The most arewegoing-flavoured answer — works on every platform because it depends on no platform.

**3. The friend-of-friend bot.** One person ("the host") installs the bot once. Bot DMs them custom event links. They paste the link into whatever group they want. Bot DMs them the tally. Works on WhatsApp, iMessage + Shortcuts, SMS via Twilio. The fan-out pattern reframed: the bot is the host's personal assistant, not the group's chat companion.

**4. The Matrix bridge prototype.** Private Matrix homeserver, bridge to a WhatsApp group via `mautrix-whatsapp`, build a Matrix bot that relays into WhatsApp. Personal use only, will likely get banned, weekend project. The "prove the dream UX works at all" experiment — if the dream UX turns out to be annoying in practice, that's load-bearing information before 4 weeks of Meta verification.

**5. The iMessage Shortcut.** A custom Apple Shortcut named "arewegoing this" — takes an event URL, opens contact picker, shares via iMessage/WhatsApp/Telegram/Signal per user choice. Distributed as a downloadable Shortcut file. Zero platform approvals. Android equivalent: tiny PWA with a Share Target manifest entry.

### The provocation

Shape 2 + Shape 5 together feel right for arewegoing. Both lean into the share-link as the integration. Both work everywhere. Both preserve "friends never sign up". Neither requires Meta verification, Discord OAuth, or a long-poll bot. **The interesting engineering work is on the receiving end of the link, not the sending end** — co-arrival inference, signed group tokens, sharp OG cards, sub-second calendar load. That's a more interesting problem than "build a Discord bot" and it ports to every platform for free.

### What's over-rated

- **Slash commands in chat.** Friend groups use words, not slashes.
- **Per-platform feature parity.** You need RSVPs to work *at all* on the platform users actually use, not the same way on three platforms.
- **A "bot framework" abstraction.** Three concrete integrations beat one abstract one. Build for one platform until the shared shape becomes obvious.

### What's under-rated

- **The share-link as a first-class product surface.** OG card, URL design, signed token, co-arrival inference.
- **Telegram as a sandbox.** Permissive API, no approval, free. Build the most experimental version of every shape there first, learn, port the lessons.
- **The Matrix bridge as UX research**, not a product. One weekend to learn whether the dream UX even feels right.

### The question to hold open

Does the audience need the bot *in* WhatsApp, or do they need arewegoing to feel like a *natural part of* their WhatsApp conversations? Those have very different answers. The first means Meta verification + 1:1 chats + templates + fees + weeks of approval. The second means sharp share-link + beautiful preview card + sub-second tap-and-RSVP page + "your group" detection that just works. Most product people who started at the first answer end up at the second. Worth holding open before committing.

### Weekend prototype to actually learn

1. **Saturday morning.** Shape 2 — share target + co-arrival detection on the calendar page. ~2h.
2. **Saturday afternoon.** Shape 1 — Telegram lurker bot in a private chat with 2-3 friends. ~2h. See if ambient RSVP cards feel good or invasive.
3. **Sunday morning.** Shape 5 — Apple Shortcut prototype. ~1h. Compare to the share button.

The point isn't to ship any of these. The point is to learn which shape feels right before committing to weeks of platform work.

## Section 8 — Open questions for the user

- **Is there an actual Discord server today** where an arewegoing group already coordinates, or is the Discord bot still hypothetical?
- **What is the target install ceiling for v1?** If we expect under 50 groups in the first six months, the share-link button is plainly enough.
- **Do we have a Meta Business entity ready to verify?** If yes, the WhatsApp bot calculus shifts. If no, the 1-3 week verification wall is a real cost.
- **Should the group calendar OG card show friend names or just counts?** Privacy default matters for the share preview.
- **Is there budget for the per-conversation WhatsApp fees** if a 1:1 reminder bot ever ships, and at what monthly cap should we throttle?
- **Do we want to support sign-in via Discord / Telegram as identity providers**, or keep email-token + Google as the only auth path for now?
- **Is the existing `/group/[uuid]/calendar` URL stable**, or will the slug shape change in v2 and break shared links?
