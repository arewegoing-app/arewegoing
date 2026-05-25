export type JsonLdEvent = {
  '@type'?: string | string[];
  name?: string;
  startDate?: string;
  endDate?: string;
  location?: {
    '@type'?: string;
    name?: string;
    address?: { addressLocality?: string; addressRegion?: string };
  } | string;
  image?: string | string[] | { url?: string };
  offers?: { price?: string | number; lowPrice?: string | number } | Array<{ price?: string | number; lowPrice?: string | number }>;
  url?: string;
  description?: string;
};

const SCRIPT_RE = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

export function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  for (const m of html.matchAll(SCRIPT_RE)) {
    const raw = m[1].trim();
    if (!raw) continue;
    const parsed = parseTolerant(raw);
    if (parsed === undefined) continue;
    if (Array.isArray(parsed)) blocks.push(...parsed);
    else blocks.push(parsed);
  }
  return blocks;
}

/**
 * JSON.parse with one fallback pass: some sites (Under the Radar) embed
 * unescaped control characters inside string values, which strict JSON
 * rejects. Stripping CR/LF/TAB doesn't change semantic meaning for the
 * fields we read (title, date, venue) and recovers an otherwise valid blob.
 */
function parseTolerant(raw: string): unknown {
  try { return JSON.parse(raw); } catch {/* fall through */}
  try { return JSON.parse(raw.replace(/[\r\n\t]+/g, ' ')); } catch {/* fall through */}
  return undefined;
}

export function findEvent(blocks: unknown[]): JsonLdEvent | null {
  const walk = (node: unknown): JsonLdEvent | null => {
    if (!node || typeof node !== 'object') return null;
    const obj = node as Record<string, unknown>;
    const t = obj['@type'];
    const types = Array.isArray(t) ? t : [t];
    if (types.some((x) => typeof x === 'string' && /event/i.test(x))) {
      return obj as JsonLdEvent;
    }
    if (Array.isArray(obj['@graph'])) {
      for (const child of obj['@graph']) {
        const found = walk(child);
        if (found) return found;
      }
    }
    return null;
  };
  for (const b of blocks) {
    const found = walk(b);
    if (found) return found;
  }
  return null;
}

function pickPrice(offers: JsonLdEvent['offers']): number | undefined {
  if (!offers) return undefined;
  const list = Array.isArray(offers) ? offers : [offers];
  const nums: number[] = [];
  for (const o of list) {
    const raw = o.lowPrice ?? o.price;
    const n = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof n === 'number' && !Number.isNaN(n) && n >= 0) nums.push(n);
  }
  return nums.length ? Math.min(...nums) : undefined;
}

function pickImage(image: JsonLdEvent['image']): string | undefined {
  if (!image) return undefined;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) {
    const first = image.find((x) => typeof x === 'string');
    return typeof first === 'string' ? first : undefined;
  }
  if (typeof image === 'object' && image.url) return image.url;
  return undefined;
}

export function normalizeEvent(ev: JsonLdEvent): Partial<{ title: string; startsAt: string; venue: string; city: string; priceLow: number; imageUrl: string }> {
  const out: ReturnType<typeof normalizeEvent> = {};
  if (ev.name) out.title = ev.name;
  if (ev.startDate) {
    const d = new Date(ev.startDate);
    if (!Number.isNaN(d.getTime())) out.startsAt = d.toISOString();
  }
  if (ev.location) {
    if (typeof ev.location === 'string') out.venue = ev.location;
    else {
      if (ev.location.name) out.venue = ev.location.name;
      if (ev.location.address?.addressLocality) out.city = ev.location.address.addressLocality;
    }
  }
  const price = pickPrice(ev.offers);
  if (price !== undefined) out.priceLow = Math.floor(price);
  const img = pickImage(ev.image);
  if (img) out.imageUrl = img;
  return out;
}
