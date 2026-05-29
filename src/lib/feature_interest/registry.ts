/**
 * Human-readable labels for feature keys logged via `recordFeatureInterest`.
 * Add an entry here when you wire a new clickable shell. Anything not in this
 * map still works — the confirmation page just falls back to the raw key.
 */
export const FEATURE_REGISTRY: Record<
  string,
  { label: string; tagline?: string }
> = {
  'signin.google': {
    label: 'Sign in with Google',
    tagline: 'OAuth client coming soon.',
  },
  'signin.apple': {
    label: 'Sign in with Apple',
    tagline: 'OAuth client coming soon.',
  },
  'connect.facebook': {
    label: 'Find friends on Facebook',
    tagline: 'Pull mutual friends + auto-suggest who to invite.',
  },
  'connect.songkick': {
    label: 'Connect Songkick',
    tagline: 'Auto-suggest gigs based on artists you follow.',
  },
  'connect.soundcloud': {
    label: 'Connect SoundCloud',
    tagline: 'Surface DJs you listen to when they tour NZ.',
  },
  'connect.spotify': {
    label: 'Connect Spotify',
    tagline: 'Surface tour dates from artists you stream.',
  },
  'general.new_features': {
    label: 'New features',
    tagline: 'Heads-up when something new ships.',
  },
  'general.waitlist': {
    label: 'arewegoing waitlist',
    tagline: 'Email me when arewegoing is ready for general use.',
  },
};

export function describeFeature(key: string): { label: string; tagline?: string } {
  return FEATURE_REGISTRY[key] ?? { label: key };
}
