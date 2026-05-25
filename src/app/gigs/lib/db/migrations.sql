do $$ begin
  create type rsvp_status as enum ('going', 'maybe', 'out', 'conditional');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pledge_state as enum ('none', 'pledged', 'locked', 'bailed', 'replaced');
exception when duplicate_object then null; end $$;

create table if not exists users (
  id text primary key,
  email text not null unique,
  name text,
  google_sub text,
  created_at timestamp not null default now()
);

create table if not exists recipients (
  id text primary key,
  owner_user_id text references users(id) on delete cascade,
  anon_owner_id text,
  email text not null,
  display_name text not null,
  preferred_channel text not null default 'email',
  created_at timestamp not null default now()
);

create table if not exists events (
  id text primary key,
  slug text not null unique,
  owner_user_id text references users(id) on delete cascade,
  anon_owner_id text,
  anon_owner_name text,
  anon_owner_email text,
  title text not null,
  venue text,
  city text default 'Wellington',
  starts_at timestamp,
  on_sale_at timestamp,
  price_low integer,
  price_high integer,
  ticket_url text,
  image_url text,
  source text not null default 'manual',
  source_url text unique,
  status text not null default 'active',
  discovered_at timestamp,
  series_name text,
  created_at timestamp not null default now()
);

do $$ begin
  create type reaction_kind as enum ('interested', 'down', 'cant', 'pledge_1', 'pledge_2');
exception when duplicate_object then null; end $$;

create table if not exists event_reactions (
  id text primary key,
  event_id text not null references events(id) on delete cascade,
  recipient_id text references recipients(id) on delete cascade,
  user_id text references users(id) on delete cascade,
  anon_id text,
  anon_name text,
  kind reaction_kind not null,
  set_at timestamp not null default now()
);
create unique index if not exists event_reactions_event_actor on event_reactions(event_id, recipient_id, user_id, anon_id);

create table if not exists event_invites (
  id text primary key,
  event_id text not null references events(id) on delete cascade,
  recipient_id text not null references recipients(id) on delete cascade,
  sent_at timestamp not null default now(),
  opened_at timestamp,
  last_clicked_at timestamp
);
create unique index if not exists event_invites_event_recipient on event_invites(event_id, recipient_id);

create table if not exists rsvps (
  id text primary key,
  event_invite_id text not null unique references event_invites(id) on delete cascade,
  status rsvp_status not null,
  pledge_state pledge_state not null default 'none',
  pledged_amount integer,
  pledged_at timestamp,
  locked_at timestamp,
  bailed_at timestamp,
  plus_one_count integer not null default 0,
  plus_one_name text,
  note text,
  updated_at timestamp not null default now()
);

do $$ begin
  create type final_call_state as enum ('pending', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pledge_commitment_state as enum ('asked', 'confirmed', 'dropped');
exception when duplicate_object then null; end $$;

create table if not exists final_calls (
  id text primary key,
  event_id text not null references events(id) on delete cascade,
  triggered_by_user_id text not null references users(id),
  triggered_at timestamp not null default now(),
  deadline_at timestamp not null,
  pledge_amount integer not null,
  status final_call_state not null default 'pending',
  closed_at timestamp
);

create table if not exists pledge_commitments (
  id text primary key,
  final_call_id text not null references final_calls(id) on delete cascade,
  event_invite_id text not null references event_invites(id) on delete cascade,
  state pledge_commitment_state not null default 'asked',
  responded_at timestamp
);
create unique index if not exists pledge_commitments_call_invite on pledge_commitments(final_call_id, event_invite_id);

do $$ begin
  create type promo_status as enum ('not_asked', 'asked', 'got_code', 'declined');
exception when duplicate_object then null; end $$;

create table if not exists promo_outreach (
  id text primary key,
  event_id text not null unique references events(id) on delete cascade,
  status promo_status not null default 'not_asked',
  code text,
  asked_at timestamp,
  resolved_at timestamp,
  notes text,
  updated_at timestamp not null default now()
);

do $$ begin
  create type resale_state as enum ('open', 'claimed', 'expired');
exception when duplicate_object then null; end $$;

create table if not exists resale_listings (
  id text primary key,
  event_id text not null references events(id) on delete cascade,
  original_invite_id text not null references event_invites(id) on delete cascade,
  state resale_state not null default 'open',
  expires_at timestamp not null,
  claimed_by_invite_id text references event_invites(id) on delete set null,
  claimed_at timestamp,
  reason text,
  created_at timestamp not null default now()
);

create table if not exists purchases (
  id text primary key,
  event_id text not null references events(id) on delete cascade,
  buyer_user_id text not null references users(id),
  total_cents integer not null,
  currency text not null default 'NZD',
  ticket_count integer not null,
  promo_code text,
  created_at timestamp not null default now()
);

create table if not exists owed (
  id text primary key,
  purchase_id text not null references purchases(id) on delete cascade,
  event_invite_id text not null references event_invites(id) on delete cascade,
  amount_cents integer not null,
  paid integer not null default 0,
  paid_at timestamp,
  last_reminded_at timestamp
);

create table if not exists email_tokens (
  id text primary key,
  recipient_id text not null references recipients(id) on delete cascade,
  event_id text not null references events(id) on delete cascade,
  action text not null,
  payload text,
  expires_at timestamp not null,
  consumed_at timestamp,
  created_at timestamp not null default now()
);
