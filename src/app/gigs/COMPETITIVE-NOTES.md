# Competitive notes — group-ticket and music-promoter tools

Research scan, 2026-05-26. Not exhaustive. Captured to inform feature decisions on the gigs prototype.

## Group ticket coordination

### Partiful — https://help.partiful.com/
- **Pattern**: No-account RSVPs via phone number; guests respond from a link.
- **Borrow**: "See who else is going" social proof on the event page. Auto reminders 24h + 1h before.
- **Avoid**: Phone-as-identity locks you into SMS costs and excludes anyone reluctant to share a number. Email tokens are cheaper and lower friction.

### Hobnob — https://hobnob.app/
- **Pattern**: Text-message invitations with reply-yes RSVP and a per-event group chat.
- **Borrow**: Hashtag-to-RSVP shortcut. 24h/1h reminder cadence.
- **Avoid**: Layering a group chat on top creates a second inbox. Keep pledge/bail in email, do not spawn a chat surface.

### Lu.ma — https://lu.ma/
- **Pattern**: RSVP with email only; account creation is optional and deferred.
- **Borrow**: Community calendar subscriptions (subscribe to a venue/promoter feed and get notified of new events). Maps directly to the Wellington-venues calendar.
- **Avoid**: Free tier funnels organisers toward paid features. Keep calendar subscriptions free or the discovery flywheel dies.

### Splitwise — https://www.splitwise.com/
- **Pattern**: Running balance roll-up with a "settle in fewest transactions" algorithm.
- **Borrow**: Net-balance view per friend across many gigs instead of per-event ledger only.
- **Avoid**: Settle-up loop assumes Venmo/PayPal. In NZ we need bank-transfer reference codes.

## Promoter-side tools

### DICE — https://dice.fm/partners/work-with-us/promoters
- **Pattern**: Face-value resale via waitlist. Fans return tickets, waitlisted fans buy at the same price.
- **Borrow**: Bail handoff mirrors this: seat moves to next pledger at face value, no negotiation.
- **Avoid**: DICE bans transfers above face value with account suspension. Hostile for small-group context where friends sometimes Venmo a fee.

### Posh — https://posh.vip/
- **Pattern**: Kickback Offers — affiliates and attendees earn commission for referring friends.
- **Borrow**: Two-ticket bundle discount as a default. Rewards the social purchase pattern.
- **Avoid**: AI-controlled tier pricing and influencer affiliate features push toward club-promoter culture. Wrong audience.

### Audience Republic — https://www.audiencerepublic.com/campaign-types/wait-list
- **Pattern**: Waitlist where fans earn points by sharing and referring; top scorers get released tickets.
- **Borrow**: Treat the pledge list as a ranked queue (early pledgers get first refusal when a seat opens) rather than FCFS.
- **Avoid**: Gamification points turn into spammy share-to-win. Rank by pledge time and group ties, not social shares.

### Withfriends — https://why.withfriends.co/
- **Pattern**: Membership revenue, not per-ticket cut.
- **Borrow**: Pricing posture. Don't tax the transaction in a friends-going-to-gigs tool.
- **Avoid**: Membership upsell on every RSVP trains users to expect a paywall.

### Eventbrite Music — https://www.eventbrite.com/organizer/event-industry/music/
- **Pattern**: Lineup tool with artist metadata per event, promo codes for group/early-bird.
- **Borrow**: Artist metadata on the event card. Calendar feed should pull artist names and link them.
- **Avoid**: Signup-then-checkout wall. Invitees should never see a registration form before pledging.

## Discovery aggregators

### Songkick — https://www.songkick.com/developer
- **Pattern**: Artist-subscription model that feeds a personalised calendar. (Slice 6a already does this.)
- **Borrow**: Rank events where a tracked artist plays above generic listings.
- **Avoid**: Public API now requires partnership and licence fees. Keep the adapter layer; treat Songkick as one source among many.

### Bandsintown — https://www.bandsintown.com/
- **Pattern**: Auto-sync artist library from Spotify / Apple Music.
- **Borrow**: "Import from Spotify" first-run bootstraps tracked artists. Better onboarding than manual search.
- **Avoid**: Notification volume is high enough that fans turn alerts off. Default to digest-style emails, not per-announcement pings.

### Resident Advisor — https://ra.co/tickets
- **Pattern**: Promoter-configurable resale rules per event.
- **Borrow**: Per-event resale config (open / friends-only / no-resale) instead of a single global policy.
- **Avoid**: Editorial gatekeeping limits which events get listed. Ingest broadly, let users filter, don't curate.

### Skiddle — https://www.skiddle.com/
- **Pattern**: "Remind Me" feature — soft signal before purchase.
- **Borrow**: Pre-pledge "interested" state on a gig card. Measure intent and re-email when a group forms.
- **Avoid**: Skiddle Reps gamify referrals with commission. Same drift risk as Posh.

## Adjacent UX

### Calendly — https://developer.calendly.com/
- **Pattern**: Single-use scheduling links per invitee, revocable, no login.
- **Borrow**: Validates the architecture; the prototype already does this.
- **Avoid**: Calendly links don't expire by default and get forwarded. Tokens should stay single-use or rate-limited.

---

## Five concrete things to test next

1. **Spotify import on first run** (Bandsintown). On `/gigs/signin`, offer to import tracked artists from Spotify before asking the user to search. Bootstraps personalised calendar in one tap.
2. **Face-value bail-to-pledge handoff** (DICE). Already in Slice 4b. Audit the price-lock: the resale email should make clear no negotiation, same price.
3. **Net-balance roll-up across gigs** (Splitwise). `/gigs/owed` currently sums by event. Add a "by-person" view that nets debts across all events, with NZ bank-transfer reference codes pre-filled.
4. **"Interested" pre-pledge state** (Skiddle). Adds a soft-signal tap on the calendar card before pledging. When 2+ friends tap the same gig, send a "your group is forming around X" email.
5. **Per-event resale config** (RA). Three rules per event: open / friends-only / no-resale. Default to friends-only. Matches the prototype's group focus.
