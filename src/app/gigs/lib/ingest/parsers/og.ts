const META_RE = /<meta\s+[^>]*?(?:property|name)=["']([^"']+)["'][^>]*?content=["']([^"']+)["'][^>]*\/?>/gi;
const META_RE_REVERSED = /<meta\s+[^>]*?content=["']([^"']+)["'][^>]*?(?:property|name)=["']([^"']+)["'][^>]*\/?>/gi;
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;

export function extractMeta(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const m of html.matchAll(META_RE)) meta[m[1].toLowerCase()] = decodeEntities(m[2]);
  for (const m of html.matchAll(META_RE_REVERSED)) {
    if (!meta[m[2].toLowerCase()]) meta[m[2].toLowerCase()] = decodeEntities(m[1]);
  }
  const t = html.match(TITLE_RE);
  if (t) meta['__title'] = decodeEntities(t[1].trim());
  return meta;
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
