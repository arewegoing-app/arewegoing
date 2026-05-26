// Quote-aware meta extractor. Attribute content delimited by " can contain ',
// and vice versa, so we need two passes — one per delimiter — and we keep
// whichever value comes first.

const META_DQ = /<meta\s+([^>]*)>/gi;

export function extractMeta(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const tag of html.matchAll(META_DQ)) {
    const attrs = tag[1];
    const key = readAttr(attrs, 'property') ?? readAttr(attrs, 'name');
    const value = readAttr(attrs, 'content');
    if (key && value && meta[key.toLowerCase()] === undefined) {
      meta[key.toLowerCase()] = decodeEntities(value);
    }
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) meta['__title'] = decodeEntities(title[1].trim());
  return meta;
}

function readAttr(attrs: string, name: string): string | undefined {
  const dq = attrs.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'));
  if (dq) return dq[1];
  const sq = attrs.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, 'i'));
  if (sq) return sq[1];
  return undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function normalizeOg(meta: Record<string, string>): Partial<{ title: string; imageUrl: string }> {
  const out: ReturnType<typeof normalizeOg> = {};
  const title = meta['og:title'] ?? meta['twitter:title'] ?? meta['__title'];
  if (title) out.title = title;
  const image = meta['og:image'] ?? meta['twitter:image'];
  if (image) out.imageUrl = image;
  return out;
}
