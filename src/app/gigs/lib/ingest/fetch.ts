import { eventMetadataSchema, type EventMetadata, type IngestResult } from './types';
import { extractJsonLd, findEvent, normalizeEvent } from './parsers/json-ld';
import { extractMeta, normalizeOg } from './parsers/og';
import { detectSource, KNOWN_BLOCKED } from './adapters';
import { refineUtr } from './adapters/undertheradar';

const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 5_000;
const USER_AGENT = 'GigsBot/0.1 (+https://example.com)';

export async function ingest(rawUrl: string): Promise<IngestResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) return { ok: false, reason: 'invalid_url' };

  const blocked = KNOWN_BLOCKED.find((b) => b.test.test(parsedUrl.hostname));
  if (blocked) return { ok: false, reason: 'unsupported_source', message: blocked.reason };

  const html = await fetchHtml(parsedUrl);
  if (!html.ok) return html;

  return parseHtml(html.text, parsedUrl);
}

async function fetchHtml(url: URL): Promise<{ ok: true; text: string } | { ok: false; reason: 'fetch_failed' | 'timeout' | 'too_large'; message?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, reason: 'fetch_failed', message: `HTTP ${res.status}` };
    const contentLength = Number(res.headers.get('content-length') ?? 0);
    if (contentLength > MAX_BYTES) return { ok: false, reason: 'too_large' };
    const text = await res.text();
    if (text.length > MAX_BYTES) return { ok: false, reason: 'too_large' };
    return { ok: true, text };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return { ok: false, reason: 'timeout' };
    return { ok: false, reason: 'fetch_failed', message: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export function parseHtml(html: string, url: URL): IngestResult {
  const source = detectSource(url);

  const fromJsonLd = (() => {
    const ev = findEvent(extractJsonLd(html));
    return ev ? normalizeEvent(ev) : {};
  })();

  const fromOg = normalizeOg(extractMeta(html));

  const sourceRefined = source === 'undertheradar' ? refineUtr(html) : {};

  const merged: Partial<EventMetadata> = {
    title: fromJsonLd.title ?? fromOg.title,
    venue: fromJsonLd.venue ?? sourceRefined.venue,
    city: fromJsonLd.city ?? sourceRefined.city,
    startsAt: fromJsonLd.startsAt ?? sourceRefined.startsAt,
    priceLow: fromJsonLd.priceLow,
    imageUrl: fromJsonLd.imageUrl ?? fromOg.imageUrl,
    ticketUrl: url.toString(),
    source,
  };

  if (!merged.title) return { ok: false, reason: 'no_metadata' };

  const parsed = eventMetadataSchema.safeParse(merged);
  if (!parsed.success) return { ok: false, reason: 'parse_failed', message: parsed.error.issues[0]?.message };
  return { ok: true, metadata: parsed.data };
}
