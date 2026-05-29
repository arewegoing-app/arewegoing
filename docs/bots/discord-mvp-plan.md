# Discord MVP — implementation plan

> Concrete plan if/when arewegoing picks Discord as the first bot integration. Pairs with `messaging-integrations.md` (the high-level spec). Read that doc's recommendation first; only come here once Discord is the chosen direction.

## Correction worth surfacing

`LAION-AI/Open-Assistant` is **not** a bot framework. It was an archived (April 2024) attempt at an open-source ChatGPT-style conversational model. Sometimes shows up on "popular OSS" lists and gets mistaken for relevant work. Skip for bot purposes. If we ever want a natural-language layer ("the bot understands 'I'm in'"), that's a small OpenAI/Anthropic API call, not a self-hosted LLM.

## What discord.js gives you

discord.js wraps Discord's REST API and gateway WebSocket. Typed objects for guilds, channels, users, messages, interactions, embeds, buttons, modals + event handlers for everything the bot's servers do. https://discord.js.org/

Apollo and Sesh — the two dominant Discord event bots — are built on it. Once you know the building blocks, the bots stop feeling magical and start feeling like Lego.

## The 8 primitives Apollo and Sesh use

1. **Slash commands** — `/event create`, `/rsvp`. Registered once via REST, Discord renders the autocomplete UI. `SlashCommandBuilder`.
2. **Embeds** — the big formatted RSVP card with title, fields (Going/Maybe/Can't counts), thumbnails, footers. `EmbedBuilder`.
3. **Button components** — the Going/Maybe/Can't row. Each button has a `custom_id` like `rsvp:going:event_abc`. Discord fires an interaction webhook with the clicker's user ID. Up to 5 buttons per row, 5 rows per message. `ButtonBuilder` + `ActionRowBuilder`.
4. **Select menus** — Apollo's "Bring +1" dropdown. `StringSelectMenuBuilder`.
5. **Modals** — popup forms triggered by buttons. Returns input values in a follow-up interaction. `ModalBuilder` + `TextInputBuilder`.
6. **Ephemeral replies** — the private "✅ You're going" toast only the clicker sees. `interaction.reply({ ephemeral: true })`.
7. **Scheduled jobs** — reminders are NOT a Discord feature. Bot backend runs cron, looks up RSVPs, sends DMs via `user.send()`.
8. **Discord Scheduled Events** — first-party event object. Sesh creates one alongside its own so events show in the server's events tab. `guild.scheduledEvents.create()`.

That's the entire surface. Everything Apollo/Sesh do is a recombination of those 8.

## What Apollo/Sesh add on top (the product layer)

- **Time zone parsing.** "Friday at 8pm Wellington time" → UTC, rendered per-user with `<t:timestamp:F>`. Sesh's time parser is the single feature users rave about most.
- **Recurring events.** RRULE parsing, materialised per-occurrence.
- **Cross-server identity.** Same Discord user remembered across servers so reminders DM once.
- **Permission gating.** Only creator (or specific role) can edit/delete. Bot-side logic.
- **Waitlist + capacity.** Going hits max → new clicks land on waitlist → cancel promotes the next.
- **Premium gating.** Apollo and Sesh both have paid tiers. Database-side.

None of that is hard. It's just code that runs on button click.

## arewegoing-flavoured v1, sized for one weekend

### `/awg invite <calendar-url>`

User pastes a group calendar URL. Bot fetches the calendar, finds the next event, posts:

```
🎵 The Beths at San Fran
Friday 18 July, 8pm Wellington
$45 early bird (closes Sunday)

✅ Going (0)
❔ Maybe (0)
❌ Can't (0)

[Going] [Maybe] [Can't] [See full calendar →]
```

Last button is a link button to `arewegoing.app/group/abc123/calendar`. Other three are RSVP buttons.

### Button click

1. Write `(discord_user_id, event_id, 'going')` to `bot_rsvps`.
2. Edit the embed to update counts + add the user's mention.
3. Ephemeral reply: "You're going. [signed link to the event detail]".

No account required. Signed link carries identity for later session attach.

### `/awg link`

Optional. OAuth flow on arewegoing.app, writes to `bot_identity_links`. Retroactively attaches all bot RSVPs to the linked account.

### `/awg calendar`

Posts the next 5 events for the server's linked group. Each event is its own embed + buttons. Single command drops a week of gigs into the chat, each rallyable in one tap.

### Out of scope for v1

- ❌ Create events from inside Discord (web app still owns event creation).
- ❌ Recurring events.
- ❌ Reminders (v1.1 stretch).
- ❌ Payments (always on arewegoing.app).

The bot is a **mirror and a ralliser**, not a full event manager.

## Reading list before writing code

In priority order:

1. **discord.js guide — Slash commands** — https://discordjs.guide/slash-commands/. Better than the API docs for learning shape.
2. **discord.js guide — Buttons + Modals** — same site, 30 min read.
3. **`discord/cloudflare-sample-app`** — https://github.com/discord/cloudflare-sample-app. Signed interactions in a serverless function. Matches arewegoing's Vercel deployment shape. ~500 LOC, MIT.
4. **`@discordjs/builders`** — typed builder package. Knowing it exists saves digging.
5. **Sesh public docs** — https://sesh.fyi/docs/. Not code, but the product surface is the best spec for what the bot should eventually do.

## The deployment-shape decision

discord.js assumes a persistent process (maintains the gateway WebSocket). That doesn't match Vercel's serverless model.

### Option A — discord.js + persistent host (Fly.io / Railway / VPS)

Bot runs long-lived. Next.js app stays on Vercel. They share Neon DB. ~$5-10/month for the bot host.

- **Pros**: full discord.js SDK, all examples apply, easy to add gateway features later.
- **Cons**: extra deployment target, extra ops surface.

### Option B — `discord-interactions` + `discord-api-types` on Vercel (recommended)

No gateway. Discord sends interaction webhooks to a Next.js route handler. Verify signature, dispatch on interaction type, respond. Slash commands + buttons work fully. Can't read every channel message (don't need to for v1).

- **Pros**: one deployment, same stack as the rest of arewegoing, no extra ops.
- **Cons**: smaller library ecosystem, more glue, future "lurker bot" UX needs migration.

**Recommend Option B for v1.** Removes a deployment target, matches stack, and the constraint (no gateway) maps almost exactly to what WhatsApp Cloud API requires. Skills you build porting later are mostly the same. discord.js becomes a *reference for the shape*, not the library you ship.

## Weekend prototype

1. **Sat AM (2h)**: Fork `discord/cloudflare-sample-app`. Get `/ping` working end-to-end. Hit registration, ngrok, signature verification — all the parts that bite if skipped.
2. **Sat midday (1h)**: Copy the pattern into `src/app/api/bots/discord/` in the arewegoing worktree. `/awg ping` → "pong" in our codebase.
3. **Sat PM (2h)**: Embed + 3 RSVP buttons. Hardcode an event. Buttons edit the embed on click.
4. **Sun (2h)**: Database write via existing Drizzle. Persist RSVPs.

By Sunday night: working RSVP bot in a real server with one test event, no account linking, no fancy UX, full loop. From there the v1 list above is mostly product polish.

## Open questions before writing code

- **Is there a Discord server with 3-5 real friends** we can test in this weekend? Without one, the prototype tests technical milestones but not UX.
- **Option A or Option B for hosting?** Recommendation is B; flag the choice consciously not by default.
- **Does the bot require account linking before RSVPing**, or accept anonymous Discord RSVPs and offer a "claim these later" link? Earlier assumption: latter.
- **Same Next.js app under `src/app/api/bots/discord/`, or a separate package in a monorepo?** Default same-app; split later if it ever needs its own runtime.
