// UTR JSON-LD is sparse — fall back to DOM patterns for venue + date.
const VENUE_RE = /<dt[^>]*>\s*Venue\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i;
const WHEN_RE = /<dt[^>]*>\s*When\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i;

export function refineUtr(html: string): Partial<{ venue: string; city: string }> {
  const out: { venue?: string; city?: string } = {};
  const venueMatch = html.match(VENUE_RE);
  if (venueMatch) {
    const raw = stripTags(venueMatch[1]).trim();
    // Format observed: "The Gods Paramount, Wellington" or "Cuba St Tavern, Wellington"
    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      out.venue = parts.slice(0, -1).join(', ');
      out.city = parts[parts.length - 1];
    } else if (parts[0]) {
      out.venue = parts[0];
    }
  }
  return out;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}
