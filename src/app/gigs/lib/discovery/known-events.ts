// Hardcoded snapshot of the 19 seed Wellington gigs so the calendar renders
// with content from cold-start zero (no network fetch required). The discovery
// cron still runs `ingest()` per URL to refresh title/venue/date when real
// metadata changes.

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

// Dates: rough estimates pulled from the Under the Radar / Humanitix listings.
// These get overwritten the first time the discovery cron actually hits the source.
export const knownEvents: SeedEvent[] = [
  {
    source: 'humanitix',
    sourceUrl: 'https://events.humanitix.com/cuba-street-tavern',
    title: 'Cuba Street Tavern',
    venue: 'Cuba Street Tavern',
    city: 'Wellington',
    startsAtUTC: '2026-06-06T09:00:00.000Z',
  },
  {
    source: 'humanitix',
    sourceUrl: 'https://events.humanitix.com/silent-disco-edm-fusion',
    title: 'Silent Disco — EDM Fusion',
    venue: 'TBA',
    city: 'Wellington',
    startsAtUTC: '2026-06-13T09:00:00.000Z',
    priceLow: 25,
  },
  {
    source: 'humanitix',
    sourceUrl: 'https://events.humanitix.com/doc-scott-wellington',
    title: 'Doc Scott (UK)',
    venue: 'San Fran',
    city: 'Wellington',
    startsAtUTC: '2026-07-18T09:00:00.000Z',
    priceLow: 55,
  },
  {
    source: 'humanitix',
    sourceUrl: 'https://events.humanitix.com/little-monsters-june',
    title: 'Little Monsters DJ Present',
    venue: 'Cuba Street Tavern',
    city: 'Wellington',
    startsAtUTC: '2026-06-20T09:00:00.000Z',
    seriesName: 'Little Monsters',
  },
  {
    source: 'humanitix',
    sourceUrl: 'https://events.humanitix.com/bryan-gee-wlg',
    title: 'Rhythm Output Presents Bryan Gee Wellington',
    venue: 'Cuba Street Tavern',
    city: 'Wellington',
    startsAtUTC: '2026-08-02T09:00:00.000Z',
    priceLow: 35,
    seriesName: 'Rhythm Output',
  },
  {
    source: 'moshtix',
    sourceUrl: 'https://www.moshtix.co.nz/v2/event/techno-night-with-valerie-ace-de/195201',
    title: 'Techno Night with Valerie ACE (DE)',
    venue: 'San Fran',
    city: 'Wellington',
    startsAtUTC: '2026-07-04T09:00:00.000Z',
    priceLow: 45,
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102582/Pallys---Rhythm-For-Ribbons.utr',
    title: "Pally's — Rhythm For Ribbons",
    venue: 'Afters.',
    city: 'Wellington',
    // Sun 31 May 2026, 8pm NZST (NZST = UTC+12 in May).
    startsAtUTC: '2026-05-31T08:00:00.000Z',
    priceLow: 20,
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102647/Sunday-Sessions.utr',
    title: 'Sunday Sessions',
    venue: 'Cuba Street Tavern',
    city: 'Wellington',
    startsAtUTC: '2026-06-15T03:00:00.000Z',
    seriesName: 'Sunday Sessions',
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102366/Bryon-The-Aquarius-US.utr',
    title: 'Byron The Aquarius (US)',
    venue: 'Meow',
    city: 'Wellington',
    startsAtUTC: '2026-07-12T09:00:00.000Z',
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102660/Lacuna-Presents-Eden-Burns-At-The-Gods.utr',
    title: 'Lacuna Presents: Eden Burns At The Gods',
    venue: 'The Gods Paramount',
    city: 'Wellington',
    startsAtUTC: '2026-06-06T09:00:00.000Z',
    priceLow: 40,
    seriesName: 'Lacuna Presents',
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102308/The-Ritual.utr',
    title: 'The Ritual',
    venue: 'San Fran',
    city: 'Wellington',
    startsAtUTC: '2026-06-21T09:00:00.000Z',
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102420/Pur-X-Breakaway-Present-Valerie-Ace-DE-and-Keepsakes.utr',
    title: 'PUR x Breakaway Present Valerie ACE (DE) and Keepsakes',
    venue: 'San Fran',
    city: 'Wellington',
    startsAtUTC: '2026-07-04T09:00:00.000Z',
    priceLow: 50,
    seriesName: 'PUR x Breakaway',
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102719/Breaking-Beats-X-Frederick-Crew.utr',
    title: 'Breaking Beats x Frederick Crew',
    venue: 'Cuba Street Tavern',
    city: 'Wellington',
    startsAtUTC: '2026-08-08T09:00:00.000Z',
    seriesName: 'Breaking Beats',
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102583/Little-Monsters-DJ-Present.utr',
    title: 'Little Monsters DJ Present',
    venue: 'Cuba Street Tavern',
    city: 'Wellington',
    startsAtUTC: '2026-06-20T09:00:00.000Z',
    seriesName: 'Little Monsters',
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102584/Rhythm-Output-Presents-Bryan-Gee-WLG.utr',
    title: 'Rhythm Output Presents Bryan Gee Wellington',
    venue: 'Cuba Street Tavern',
    city: 'Wellington',
    startsAtUTC: '2026-08-02T09:00:00.000Z',
    priceLow: 35,
    seriesName: 'Rhythm Output',
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102645/Ill-Truth-uk.utr',
    title: 'Ill Truth (UK)',
    venue: 'San Fran',
    city: 'Wellington',
    startsAtUTC: '2026-07-25T09:00:00.000Z',
    priceLow: 50,
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102720/Doc-Scott-UK.utr',
    title: 'Doc Scott (UK)',
    venue: 'San Fran',
    city: 'Wellington',
    startsAtUTC: '2026-07-18T09:00:00.000Z',
    priceLow: 55,
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102600/DJ-Craze-US.utr',
    title: 'DJ Craze (US)',
    venue: 'Meow',
    city: 'Wellington',
    startsAtUTC: '2026-08-15T09:00:00.000Z',
    priceLow: 60,
  },
  {
    source: 'undertheradar',
    sourceUrl: 'https://www.undertheradar.co.nz/gig/102476/Krafty-Kuts-UK.utr',
    title: 'Krafty Kuts (UK)',
    venue: 'San Fran',
    city: 'Wellington',
    startsAtUTC: '2026-07-11T09:00:00.000Z',
    priceLow: 55,
  },
];
