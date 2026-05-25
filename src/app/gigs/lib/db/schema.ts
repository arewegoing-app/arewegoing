import { pgTable, text, integer, timestamp, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { nanoid } from 'nanoid';

const id = () => text('id').primaryKey().$defaultFn(() => nanoid());

export const rsvpStatusEnum = pgEnum('rsvp_status', ['going', 'maybe', 'out', 'conditional']);
export const pledgeStateEnum = pgEnum('pledge_state', ['none', 'pledged', 'locked', 'bailed', 'replaced']);

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  name: text('name'),
  googleSub: text('google_sub'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const recipients = pgTable('recipients', {
  id: id(),
  ownerUserId: text('owner_user_id').references(() => users.id, { onDelete: 'cascade' }),
  anonOwnerId: text('anon_owner_id'),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  preferredChannel: text('preferred_channel').notNull().default('email'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const events = pgTable('events', {
  id: id(),
  slug: text('slug').notNull().unique(),
  ownerUserId: text('owner_user_id').references(() => users.id, { onDelete: 'cascade' }),
  anonOwnerId: text('anon_owner_id'),
  anonOwnerName: text('anon_owner_name'),
  anonOwnerEmail: text('anon_owner_email'),
  title: text('title').notNull(),
  venue: text('venue'),
  city: text('city').default('Wellington'),
  startsAt: timestamp('starts_at'),
  onSaleAt: timestamp('on_sale_at'),
  priceLow: integer('price_low'),
  priceHigh: integer('price_high'),
  ticketUrl: text('ticket_url'),
  imageUrl: text('image_url'),
  source: text('source').notNull().default('manual'),
  sourceUrl: text('source_url').unique(),
  status: text('status').notNull().default('active'),
  discoveredAt: timestamp('discovered_at'),
  seriesName: text('series_name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const reactionKindEnum = pgEnum('reaction_kind', ['interested', 'down', 'cant', 'pledge_1', 'pledge_2', 'have_ticket']);

export const eventReactions = pgTable('event_reactions', {
  id: id(),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  recipientId: text('recipient_id').references(() => recipients.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  anonId: text('anon_id'),
  anonName: text('anon_name'),
  kind: reactionKindEnum('kind').notNull(),
  setAt: timestamp('set_at').notNull().defaultNow(),
}, (t) => ({
  uniqEventActor: uniqueIndex('event_reactions_event_actor').on(t.eventId, t.recipientId, t.userId, t.anonId),
}));

export type EventReaction = typeof eventReactions.$inferSelect;

export const eventInvites = pgTable('event_invites', {
  id: id(),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  recipientId: text('recipient_id').notNull().references(() => recipients.id, { onDelete: 'cascade' }),
  hasOwnTicket: integer('has_own_ticket').notNull().default(0),
  sentAt: timestamp('sent_at').notNull().defaultNow(),
  openedAt: timestamp('opened_at'),
  lastClickedAt: timestamp('last_clicked_at'),
}, (t) => ({
  eventRecipient: uniqueIndex('event_invites_event_recipient').on(t.eventId, t.recipientId),
}));

export const rsvps = pgTable('rsvps', {
  id: id(),
  eventInviteId: text('event_invite_id').notNull().references(() => eventInvites.id, { onDelete: 'cascade' }).unique(),
  status: rsvpStatusEnum('status').notNull(),
  pledgeState: pledgeStateEnum('pledge_state').notNull().default('none'),
  pledgedAmount: integer('pledged_amount'),
  pledgedAt: timestamp('pledged_at'),
  lockedAt: timestamp('locked_at'),
  bailedAt: timestamp('bailed_at'),
  plusOneCount: integer('plus_one_count').notNull().default(0),
  plusOneName: text('plus_one_name'),
  note: text('note'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const conditionKindEnum = pgEnum('condition_kind', ['min_going', 'price_ceiling', 'requires_promo']);

export const rsvpConditions = pgTable('rsvp_conditions', {
  id: id(),
  eventInviteId: text('event_invite_id').notNull().references(() => eventInvites.id, { onDelete: 'cascade' }),
  kind: conditionKindEnum('kind').notNull(),
  intValue: integer('int_value'),
  boolValue: integer('bool_value'),
  satisfied: integer('satisfied').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type RsvpCondition = typeof rsvpConditions.$inferSelect;

export const finalCallStateEnum = pgEnum('final_call_state', ['pending', 'closed']);
export const pledgeCommitmentStateEnum = pgEnum('pledge_commitment_state', ['asked', 'confirmed', 'dropped']);

export const finalCalls = pgTable('final_calls', {
  id: id(),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  triggeredByUserId: text('triggered_by_user_id').notNull().references(() => users.id),
  triggeredAt: timestamp('triggered_at').notNull().defaultNow(),
  deadlineAt: timestamp('deadline_at').notNull(),
  pledgeAmount: integer('pledge_amount').notNull(),
  status: finalCallStateEnum('status').notNull().default('pending'),
  closedAt: timestamp('closed_at'),
});

export const pledgeCommitments = pgTable('pledge_commitments', {
  id: id(),
  finalCallId: text('final_call_id').notNull().references(() => finalCalls.id, { onDelete: 'cascade' }),
  eventInviteId: text('event_invite_id').notNull().references(() => eventInvites.id, { onDelete: 'cascade' }),
  state: pledgeCommitmentStateEnum('state').notNull().default('asked'),
  respondedAt: timestamp('responded_at'),
}, (t) => ({
  unique: uniqueIndex('pledge_commitments_call_invite').on(t.finalCallId, t.eventInviteId),
}));

export type FinalCall = typeof finalCalls.$inferSelect;
export type PledgeCommitment = typeof pledgeCommitments.$inferSelect;

export const promoStatusEnum = pgEnum('promo_status', ['not_asked', 'asked', 'got_code', 'declined']);

export const promoOutreach = pgTable('promo_outreach', {
  id: id(),
  eventId: text('event_id').notNull().unique().references(() => events.id, { onDelete: 'cascade' }),
  status: promoStatusEnum('status').notNull().default('not_asked'),
  code: text('code'),
  askedAt: timestamp('asked_at'),
  resolvedAt: timestamp('resolved_at'),
  notes: text('notes'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type PromoOutreach = typeof promoOutreach.$inferSelect;

export const resaleStateEnum = pgEnum('resale_state', ['open', 'claimed', 'expired']);

export const resaleListings = pgTable('resale_listings', {
  id: id(),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  originalInviteId: text('original_invite_id').notNull().references(() => eventInvites.id, { onDelete: 'cascade' }),
  state: resaleStateEnum('state').notNull().default('open'),
  expiresAt: timestamp('expires_at').notNull(),
  claimedByInviteId: text('claimed_by_invite_id').references(() => eventInvites.id, { onDelete: 'set null' }),
  claimedAt: timestamp('claimed_at'),
  reason: text('reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type ResaleListing = typeof resaleListings.$inferSelect;

export const purchases = pgTable('purchases', {
  id: id(),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  buyerUserId: text('buyer_user_id').notNull().references(() => users.id),
  totalCents: integer('total_cents').notNull(),
  currency: text('currency').notNull().default('NZD'),
  ticketCount: integer('ticket_count').notNull(),
  promoCode: text('promo_code'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const owed = pgTable('owed', {
  id: id(),
  purchaseId: text('purchase_id').notNull().references(() => purchases.id, { onDelete: 'cascade' }),
  eventInviteId: text('event_invite_id').notNull().references(() => eventInvites.id, { onDelete: 'cascade' }),
  amountCents: integer('amount_cents').notNull(),
  paid: integer('paid').notNull().default(0),
  paidAt: timestamp('paid_at'),
  lastRemindedAt: timestamp('last_reminded_at'),
});

export type Purchase = typeof purchases.$inferSelect;
export type Owed = typeof owed.$inferSelect;

export const emailTokens = pgTable('email_tokens', {
  id: id(),
  recipientId: text('recipient_id').notNull().references(() => recipients.id, { onDelete: 'cascade' }),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  payload: text('payload'),
  expiresAt: timestamp('expires_at').notNull(),
  consumedAt: timestamp('consumed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const eventFeedback = pgTable('event_feedback', {
  id: id(),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  eventInviteId: text('event_invite_id').references(() => eventInvites.id, { onDelete: 'cascade' }),
  anonId: text('anon_id'),
  attended: integer('attended'),
  rating: integer('rating'),
  note: text('note'),
  feedbackSentAt: timestamp('feedback_sent_at').notNull(),
  respondedAt: timestamp('responded_at'),
}, (t) => ({
  uniqEventActor: uniqueIndex('event_feedback_event_actor').on(t.eventId, t.eventInviteId, t.anonId),
}));

export type FeedbackRow = typeof eventFeedback.$inferSelect;

export type User = typeof users.$inferSelect;
export type Recipient = typeof recipients.$inferSelect;
export type Event = typeof events.$inferSelect;
export type EventInvite = typeof eventInvites.$inferSelect;
export type Rsvp = typeof rsvps.$inferSelect;
