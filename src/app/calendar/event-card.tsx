/**
 * EventCard — server component wrapper.
 *
 * Renders the static event card shell. The interactive expand behaviour
 * lives in EventCardExpander (client component). This file exists so
 * other agents (e.g. share-event-button) can stack content into the card
 * without touching the client expander.
 *
 * Note: the card rendering is currently handled client-side by
 * EventCardExpander which is fed by ClientFilter. This file exports the
 * shared type so server code can reference it.
 */

export type { ClientEvent as EventCardProps } from './client-filter';
