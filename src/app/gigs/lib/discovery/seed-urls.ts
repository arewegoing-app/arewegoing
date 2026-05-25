// Curated seed of upcoming Wellington gigs the user wants to rally for.
// Used by the discovery cron + by `pnpm gigs:seed` for local fixtures.
// House / D&B / breaks / techno bias — matches the user's friend group taste.

export const seedUrls = [
  // Humanitix
  'https://events.humanitix.com/cuba-street-tavern',
  'https://events.humanitix.com/silent-disco-edm-fusion',
  'https://events.humanitix.com/doc-scott-wellington',
  'https://events.humanitix.com/little-monsters-june',
  'https://events.humanitix.com/bryan-gee-wlg',

  // Moshtix
  'https://www.moshtix.co.nz/v2/event/techno-night-with-valerie-ace-de/195201',

  // Under the Radar — Wellington
  'https://www.undertheradar.co.nz/gig/102582/Pallys---Rhythm-For-Ribbons.utr',
  'https://www.undertheradar.co.nz/gig/102647/Sunday-Sessions.utr',
  'https://www.undertheradar.co.nz/gig/102366/Bryon-The-Aquarius-US.utr',
  'https://www.undertheradar.co.nz/gig/102660/Lacuna-Presents-Eden-Burns-At-The-Gods.utr',
  'https://www.undertheradar.co.nz/gig/102308/The-Ritual.utr',
  'https://www.undertheradar.co.nz/gig/102420/Pur-X-Breakaway-Present-Valerie-Ace-DE-and-Keepsakes.utr',
  'https://www.undertheradar.co.nz/gig/102719/Breaking-Beats-X-Frederick-Crew.utr',
  'https://www.undertheradar.co.nz/gig/102583/Little-Monsters-DJ-Present.utr',
  'https://www.undertheradar.co.nz/gig/102584/Rhythm-Output-Presents-Bryan-Gee-WLG.utr',
  'https://www.undertheradar.co.nz/gig/102645/Ill-Truth-uk.utr',
  'https://www.undertheradar.co.nz/gig/102720/Doc-Scott-UK.utr',
  'https://www.undertheradar.co.nz/gig/102600/DJ-Craze-US.utr',
  'https://www.undertheradar.co.nz/gig/102476/Krafty-Kuts-UK.utr',
];

export const knownPromoterSeries = [
  { name: 'Lacuna Presents', match: /lacuna\s+presents/i },
  { name: 'ON&ON Presents', match: /on\s*&\s*on\s+presents/i },
  { name: 'Goodthings Sessions', match: /goodthings\s+session/i },
  { name: 'Solid State', match: /solid\s+state/i },
  { name: 'Midweek Melters', match: /midweek\s+melters/i },
  { name: 'PUR x Breakaway', match: /pur\s*x\s*breakaway/i },
  { name: 'Rhythm Output', match: /rhythm\s+output\s+presents/i },
  { name: 'Little Monsters', match: /little\s+monsters/i },
  { name: 'Sunday Sessions', match: /sunday\s+sessions/i },
  { name: 'Breaking Beats', match: /breaking\s+beats/i },
];

export const knownVenues = [
  'Cuba Street Tavern',
  'Cuba St Tavern',
  'San Fran',
  'The Gods Paramount',
  'Paramount',
  'Meow',
  'Meow Nui',
  'MOON',
  'Thunder Road',
  'Rogue and Vagabond',
  'BL3 Bar',
];
