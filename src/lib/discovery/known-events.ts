// Snapshot of the 19 seed Wellington gigs. Audited against live ingest on
// 2026-05-25 (see __tests__/fetch-real-dates.script.ts). Most values here
// come straight from the source page's JSON-LD; a couple are best-guesses
// where the source doesn't expose structured data (Afters-hosted UTR gigs
// without a When/Where dt/dd block). The seed cron overwrites these on
// every successful live fetch.
//
// Duplicates removed where the same real-world event appeared twice:
//   - Doc Scott (UK) on UTR === Doc Scott Wellington on Humanitix
//   - Little Monsters on UTR === Little Monsters on Humanitix
//   - Rhythm Output Bryan Gee on UTR === Bryan Gee WLG on Humanitix

import type { IngestSource } from '../ingest/types';

type SeedEvent = {
  source: IngestSource;
  sourceUrl: string;
  title: string;
  venue: string;
  city: string;
  startsAtUTC: string;
  priceLow?: number;
  seriesName?: string;
};

export const knownEvents: SeedEvent[] = [
  // Humanitix — verified against live ingest
  {
    source: 'humanitix',
    sourceUrl: 'https://events.humanitix.com/cuba-street-tavern',
    title: 'Something Something Club Presents: Cuba Street Tavern Sunday Session',
    venue: 'Cuba St Tavern',
    city: 'Wellington',
    startsAtUTC: '2026-05-31T03:00:00.000Z',
    priceLow: 5,
    seriesName: 'Sunday Sessions',
  },
  {
    source: 'humanitix',
    sourceUrl: 'https://events.humanitix.com/silent-disco-edm-fusion',
    title: 'Silent Disco: EDM Fusion',
    venue: 'Red Square Bar',
    city: 'Wellington',
    startsAtUTC: '2026-05-29T10:00:00.000Z',
    priceLow: 24,
  },
  {
    source: 'humanitix',
    sourceUrl: 'https://events.humanitix.com/doc-scott-wellington',
    title: 'Doc Scott (Wellington)',
    venue: 'Afters',
    city: 'Wellington',
    startsAtUTC: '2026-06-25T07:00:00.000Z',
    priceLow: 20,
  },
  {
    source: 'humanitix',
    sourceUrl: 'https://events.humanitix.com/little-monsters-june',
    title: 'Little Monsters DJ Present',
    venue: 'Afters.',
    city: 'Wellington',
    startsAtUTC: '2026-06-12T10:00:00.000Z',
    priceLow: 10,
    seriesName: 'Little Monsters',
  },
  {
    source: 'humanitix',
    sourceUrl: 'https://events.humanitix.com/bryan-gee-wlg',
    title: 'Rhythm Output Presents: Bryan Gee WLG',
    venue: 'Afters.',
    city: 'Wellington',
    startsAtUTC: '2026-06-14T06:00:00.000Z',
    priceLow: 19,
    seriesName: 'Rhythm Output',
  },

  // Moshtix — currently blocked (403 to bot UA). Best-guess values.
  {
    source: 'moshtix',
    sourceUrl: 'https://www.moshtix.co.nz/v2/event/techno-night-with-valerie-ace-de/195201',
    title: 'Techno Night with Valerie ACE (DE)',
    venue: 'San Fran',
    city: 'Wellington',
    startsAtUTC: '2026-06-06T11:00:00.000Z',
    priceLow: 45,
    seriesName: 'PUR x Breakaway',
  },

  // Under the Radar — verified against live ingest
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102582/Pallys---Rhythm-For-Ribbons.utr',
    title: "Pally's - Rhythm For Ribbons",
    venue: 'Afters.',
    city: 'Wellington',
    startsAtUTC: '2026-05-31T08:00:00.000Z',
    priceLow: 20,
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102647/Sunday-Sessions.utr',
    title: 'Sunday Sessions',
    venue: 'Cuba St Tavern',
    city: 'Wellington',
    startsAtUTC: '2026-05-31T03:00:00.000Z',
    priceLow: 5,
    seriesName: 'Sunday Sessions',
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102366/Bryon-The-Aquarius-US.utr',
    title: 'Byron The Aquarius (US)',
    venue: 'Meow',
    city: 'Wellington',
    startsAtUTC: '2026-06-05T10:00:00.000Z',
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102660/Lacuna-Presents-Eden-Burns-At-The-Gods.utr',
    title: 'Lacuna Presents: Eden Burns At The Gods',
    venue: 'The Gods Paramount',
    city: 'Wellington',
    startsAtUTC: '2026-06-06T08:00:00.000Z',
    priceLow: 40,
    seriesName: 'Lacuna Presents',
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102308/The-Ritual.utr',
    title: 'The Ritual',
    venue: 'SECRET LOCATION',
    city: 'Wellington',
    startsAtUTC: '2026-06-06T07:00:00.000Z',
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102420/Pur-X-Breakaway-Present-Valerie-Ace-DE-and-Keepsakes.utr',
    title: 'PUR x Breakaway Present: Valerie ACE (DE) and Keepsakes',
    venue: 'San Fran',
    city: 'Wellington',
    startsAtUTC: '2026-06-06T11:00:00.000Z',
    priceLow: 50,
    seriesName: 'PUR x Breakaway',
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102600/DJ-Craze-US.utr',
    title: 'DJ Craze (US)',
    venue: 'Meow',
    city: 'Wellington',
    startsAtUTC: '2026-07-04T10:00:00.000Z',
    priceLow: 60,
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102476/Krafty-Kuts-UK.utr',
    title: 'Krafty Kuts (UK)',
    venue: 'Meow',
    city: 'Wellington',
    startsAtUTC: '2026-07-09T08:00:00.000Z',
    priceLow: 55,
  },

  // Under the Radar — Afters-hosted gigs now parse correctly after the JSON-LD
  // tolerant-parse fix. Values audited 2026-05-25.
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102719/Breaking-Beats-X-Frederick-Crew.utr',
    title: 'Breaking Beats x Frederick Crew',
    venue: 'Afters.',
    city: 'Wellington',
    startsAtUTC: '2026-06-06T10:00:00.000Z',
    seriesName: 'Breaking Beats',
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102645/Ill-Truth-uk.utr',
    title: 'Ill Truth (UK)',
    venue: 'Afters.',
    city: 'Wellington',
    startsAtUTC: '2026-06-19T09:00:00.000Z',
  },
];
