# Competitive notes — features inside large platforms

Companion to `COMPETITIVE-NOTES.md`. This file covers FEATURES inside major consumer platforms (Meta, Apple, Google, Spotify, Discord, etc) that handle pieces of the friends-going-to-a-gig problem.

Scan date: 2026-05-26.

## Meta

### Facebook Events — "Interested" RSVP — https://www.facebook.com/help/572885262883136
- **Pattern**: Third RSVP state between Going and Not Going. Soft commitment is its own status.
- **Borrow**: Add a non-binary state in the pledge flow: "interested, ping me if close to selling out".
- **Caveat**: Facebook makes ad money on Interested users. We need real seats; soft yes has to convert.

### Facebook Events — Co-host — https://predis.ai/resources/add-host-to-a-facebook-event/
- **Pattern**: Multiple accounts can host one event. No single owner.
- **Borrow**: Let any pledged-in friend forward, edit venue, post updates.
- **Caveat**: They verify host identity via account. We need signed tokens to scope co-host rights.

### Messenger — Polls inside group chat — https://socialbu.com/blog/poll-on-messenger
- **Pattern**: Decision happens inline in the thread the chat already lives in.
- **Borrow**: Our RSVP email should not need a click-through to a new app to vote. Reply tokens or one-click links keep it inline.
- **Caveat**: Messenger owns the thread. We're guests in iMessage / WhatsApp threads, so we ride email as the thread.

### WhatsApp — Events in Communities — https://about.fb.com/news/2024/05/events-in-whatsapp-communities/
- **Pattern**: Event is a first-class object in chat. Name, date, time, venue, RSVP buttons.
- **Borrow**: Mirror this density in the RSVP email. Above the fold: name, date, venue, one button. Nothing else.
- **Caveat**: They identify the responder by phone. We identify by signed email token.

### Instagram — Add Yours templates — https://techcrunch.com/2023/12/15/instagram-add-yours-template-story-sticker/
- **Pattern**: Creator sets the frame; replies extend it without breaking it.
- **Borrow**: When a friend forwards our invite to one more person, the new RSVP attaches to the same plan, not a new one.
- **Caveat**: IG has a social graph. We need parent-token + child-token chaining in URLs.

## Apple

### Apple Invites (2025) — https://support.apple.com/guide/apple-invites/welcome/ios
- **Pattern**: Hosts pay iCloud+, guests theoretically RSVP without an Apple account.
- **Borrow**: Document the no-signup guest path loudly. If we ever add accounts for hosts, keep guests on a pure-token path.
- **Caveat**: Apple wants the Apple ID. We have no reason to want any ID.

### Apple Cash — Request in group iMessage — https://support.apple.com/en-us/123043
- **Pattern**: One request, many payers, status visible inline in the thread.
- **Borrow**: "You owe $42" should be one button in the same place the RSVP happened, not a separate Stripe page with no context.
- **Caveat**: Apple owns identity and payment. The in-thread one-button shape still applies to our "claim your ticket" though.

### Apple Wallet — Ticket sharing via AirDrop / Messages — https://support.apple.com/en-us/111112
- **Pattern**: Transfer is destructive. New barcode issues, old one voids. Only one ticket exists at a time.
- **Borrow**: Bail-and-resale should mint a fresh signed token and explicitly void the old one. No "both links work".
- **Caveat**: Apple coordinates with the issuer server. We're the issuer in our flow, so we own the switch.

### Apple Music + Bandsintown — Concerts tab — https://www.billboard.com/pro/apple-music-concert-listings-bandsintown-integration/
- **Pattern**: Discovery personalised to the listener, not the city's full calendar.
- **Borrow**: Wellington calendar should filter by "artists I like". Even a paste-your-Spotify-username field helps.
- **Caveat**: Apple has years of listening history. We start with "follow artists" lists, not full taste graphs.

## Google

### Google Calendar — Propose a new time — https://support.google.com/calendar/answer/37135
- **Pattern**: Guest can negotiate without forking a separate plan.
- **Borrow**: When the organiser flagged two candidate shows (Friday Meow vs Saturday San Fran), the guest picks one inside the same email.
- **Caveat**: Calendar has tentative state. Gigs have fixed dates, so it's more "pick which of two shows" than "pick a time".

### Google Maps — Collaborative lists — https://support.google.com/maps/answer/7280933
- **Pattern**: Group curation of a shortlist. Pins, emoji, notes.
- **Borrow**: A shared "gigs we are watching" list per friend group. Lightweight reactions before hard RSVP.
- **Caveat**: Maps has accounts. We use a list token shared via URL, but lose per-user reactions unless people sign a name.

### Google Wallet — Shareable pass link — https://www.androidpolice.com/google-wallet-shareable-boarding-passes/
- **Pattern**: Pass-by-link with a web fallback. Recipient doesn't need the wallet app.
- **Borrow**: Every ticket we hand off resolves as a web page first, native wallet second. The web page is the source of truth.
- **Caveat**: Google integrates with issuers. We accept PDFs from many providers, so the web page is the only common shape we can promise.

## Spotify

### Concerts hub powered by Songkick — https://artists.spotify.com/blog/a-new-concert-tab-for-artist-pages
- **Pattern**: Same data source we use. The platform layer is just a nice surface.
- **Borrow**: Songkick is the canonical artist-to-date binding. Venue scrape + Songkick artist subs feed ONE timeline per friend group, not two parallel ones.
- **Caveat**: Spotify ranks by listening graph. We need an explicit "follow this artist" action.

### Blend with up to 10 friends — https://newsroom.spotify.com/2022-03-30/discover-and-listen-to-music-with-even-more-friends-and-family-plus-some-of-your-favorite-artists-with-spotifys-newest-blend-update/
- **Pattern**: Group taste object visible to all members.
- **Borrow**: A "group taste" view inside a pledge thread. Show which gigs match the most members in the group, with avatars per gig.
- **Caveat**: Spotify has listening signals. We do a cheap version by intersecting each member's followed-artist list.

## Discord

### Scheduled Events with Interested button — https://support.discord.com/hc/en-us/articles/4409494125719-Scheduled-Events
- **Pattern**: Live count of interest before commitment, visible to host.
- **Borrow**: Show the organiser a live "X interested, Y pledged, target Z" tracker on the share link.
- **Caveat**: Discord has persistent identity per server. We use ephemeral token identity; count by email hash.

## Snapchat

### Snap Map — Public stories around events — https://support.snapchat.com/en-US/a/our-story
- **Pattern**: Event-level shared content without invite-by-invite.
- **Borrow**: A public "what people are saying about tonight at Meow" page tied to each gig. No login.
- **Caveat**: Snap has location and a giant content firehose. We'd manual-curate at first.

## TikTok

### Eventbrite ticketing integration — https://artists.tiktok.com/help-center/ticketing-anchor
- **Pattern**: Ticket purchase is one hop from discovery.
- **Borrow**: Gig cards link directly to the canonical ticket page. Never bounce through an intermediate landing.
- **Caveat**: TikTok struck one partner deal. We support many providers, so the abstraction handles Moshtix, Eventfinda, Humanitix, direct venue sites.

## Ticketing platforms

### Ticketmaster — Ticket Transfer — https://help.ticketmaster.com/hc/en-us/articles/9786975926673-How-does-Ticket-Transfer-work
- **Pattern**: Email-based transfer, no account required to receive. Old barcode voids on accept.
- **Borrow**: Our resale-to-friend flow matches this shape exactly. Paste an email, send a signed link, recipient confirms, old token dies.
- **Caveat**: TM verifies recipients in their account before re-issue. We need a confirm-by-email step before the swap is final.

### SeatGeek — Parties — https://seatgeek.com/press/seatgeek-introduces-parties-feature-ahead-of-nfl-season
- **Pattern**: Host buys the block. Sends one party link. Each friend opens the link and claims a seat.
- **Borrow**: Lean into this. The organiser holds the block; each pledged friend claims their seat via a token in the RSVP email.
- **Caveat**: SeatGeek forces account creation at claim time. We keep claim signup-free via one-time tokens.

### SeatGeek — Deal Score — https://support.seatgeek.com/hc/en-us/articles/360007200954-What-is-Deal-Score
- **Pattern**: One readable signal beats a wall of metadata.
- **Borrow**: Each gig card carries one badge: "selling fast", "rarely sells out", "first show this artist has played here". One signal, top right.
- **Caveat**: SeatGeek has supply + price history. Start with simple flags, not a numeric score.

### DICE — Waiting List — https://dice.fm/blog/identify-fan-demand-with-the-waiting-list
- **Pattern**: Returns flow to people in queue order. Original buyer is refunded automatically.
- **Borrow**: When someone bails, seat goes to next pledged-but-unseated friend FIRST, then public waitlist. Refund auto-generates.
- **Caveat**: DICE handles the money. We need a clear "I bailed, here is the refund link" flow even when payment is off-platform.

### Eventbrite — Email invitation with embedded RSVP — https://www.eventbrite.com/organizer/features/online-rsvp/
- **Pattern**: Mass email-driven RSVP with no signup required.
- **Borrow**: Confirms our core architecture is right. Match Eventbrite on the boring stuff: sensible reminder intervals, single canonical RSVP URL per recipient.
- **Caveat**: They store RSVP state per email under a creator account. We use signed tokens + database keyed by token hash.

---

## Six concrete moves to test next

1. **Soft-yes RSVP state** (Facebook Interested + Discord). Add a "ping me if close to selling out" button next to Going/Not Going. Live count to the organiser.
2. **Bail-resale that voids old token** (Apple Wallet + DICE). Mints a new token, voids the old; offers to next-pledged-in-group first, then public waitlist; auto refund link.
3. **One-button claim per friend** (SeatGeek Parties). Organiser holds the block. Each RSVP email has one personal claim link, no account creation.
4. **Single-signal badges on gig cards** (SeatGeek Deal Score). One short tag: "rarely sells out at Meow", "first Wellington show", "selling fast".
5. **Group taste intersect** (Spotify Blend). Surface which upcoming gigs match the most members' followed artists. Lives in the pledge thread.
6. **Propose-an-alternative inside the RSVP** (Google Calendar). Organiser flags two candidate shows. Guest picks one inside the same email, no fresh thread.

The architectural truth across all platforms: transfer, invite, and pledge run through one-time tokens or signed links. The prototype already does this. The borrowed UX moves layer on top.
