/**
 * Songkick Artist Calendar API client.
 *
 * Fetches upcoming events for a tracked artist, filtered to New Zealand.
 * Returns an empty array when SONGKICK_API_KEY is not set or the fetch fails.
 */

export type ParsedArtistEvent = {
  /** The event title as reported by Songkick. */
  title: string;
  /** Venue name. */
  venue: string;
  /** City name. */
  city: string;
  /** ISO 8601 date string for the event start. */
  startDate: string;
  /** Songkick event page URL. */
  sourceUrl: string;
};

type SongkickEvent = {
  id: number;
  displayName: string;
  start: { date: string | null; datetime: string | null };
  venue: {
    displayName: string;
    metroArea: { displayName: string; country: { displayName: string } };
  };
  uri: string;
};

type SongkickResponse = {
  resultsPage: {
    results: { event?: SongkickEvent[] };
    status: string;
  };
};

const NZ_COUNTRY = 'New Zealand';
const FETCH_TIMEOUT_MS = 5000;

/**
 * Fetch upcoming events for the given Songkick artist ID filtered to NZ.
 * Returns [] when no API key is configured or any fetch/parse error occurs.
 *
 * @param artistId - Songkick numeric artist ID as a string.
 * @returns Parsed NZ events sorted by startDate ascending.
 */
export async function fetchArtistNZEvents(artistId: string): Promise<ParsedArtistEvent[]> {
  const apiKey = process.env.SONGKICK_API_KEY;
  if (!apiKey) return [];

  const url = `https://api.songkick.com/api/3.0/artists/${artistId}/calendar.json?apikey=${encodeURIComponent(apiKey)}`;

  let body: SongkickResponse;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    body = (await res.json()) as SongkickResponse;
  } catch {
    return [];
  }

  const rawEvents = body?.resultsPage?.results?.event ?? [];
  const nzEvents = rawEvents.filter(
    (e) => e.venue?.metroArea?.country?.displayName === NZ_COUNTRY,
  );

  return nzEvents
    .map((e) => ({
      title: e.displayName,
      venue: e.venue?.displayName ?? '',
      city: e.venue?.metroArea?.displayName ?? '',
      startDate: e.start?.datetime ?? e.start?.date ?? '',
      sourceUrl: e.uri,
    }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}
