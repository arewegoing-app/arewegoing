// Under the Radar pages don't expose JSON-LD `startDate`. They have a definition
// list with "When" and "Where" labels, plus separate "Doors open" / "Gig starts"
// rows for the time. We extract both and assemble an ISO timestamp in NZ time.

const LABEL_RE = (label: string) =>
  new RegExp(`<dt[^>]*>\\s*(?:${label})\\s*<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`, 'i');

const WHEN_RE = LABEL_RE('When');
const WHERE_RE = LABEL_RE('Where|Venue');
const DOORS_RE = LABEL_RE('Doors open');
const STARTS_RE = LABEL_RE('Gig starts');

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function stripTags(s: string | undefined): string {
  if (!s) return '';
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// Parses "Sun May 31st, 2026" / "Sat, 06 June 2026" / "Fri, 17 October 2025"
function parseDate(text: string): { y: number; m: number; d: number } | null {
  const cleaned = text.toLowerCase().replace(/[,]/g, ' ').replace(/(st|nd|rd|th)/g, '').replace(/\s+/g, ' ').trim();
  const tokens = cleaned.split(' ');
  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;
  for (const t of tokens) {
    if (/^\d{4}$/.test(t)) year = Number(t);
    else if (/^\d{1,2}$/.test(t) && day === null) day = Number(t);
    else if (t in MONTHS) month = MONTHS[t];
  }
  if (day === null || month === null || year === null) return null;
  return { y: year, m: month, d: day };
}

// Parses "8:00pm" / "9:00 pm" / "21:00" → 24-hour {h, min}
function parseTime(text: string): { h: number; min: number } | null {
  const cleaned = text.toLowerCase().replace(/\s+/g, '');
  const m = cleaned.match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/);
  if (!m) {
    const m24 = cleaned.match(/(\d{1,2})(am|pm)/);
    if (!m24) return null;
    let h = Number(m24[1]);
    if (m24[2] === 'pm' && h < 12) h += 12;
    if (m24[2] === 'am' && h === 12) h = 0;
    return { h, min: 0 };
  }
  let h = Number(m[1]);
  const min = Number(m[2]);
  const meridiem = m[3];
  if (meridiem === 'pm' && h < 12) h += 12;
  if (meridiem === 'am' && h === 12) h = 0;
  return { h, min };
}

/** Convert a wall-clock NZ time to a UTC ISO string. NZ is +13 (NZDT, Oct–Apr)
 *  or +12 (NZST, Apr–Oct). We use the Intl API to figure out the offset for
 *  the given date so DST is correct. */
function nzWallTimeToUtc(y: number, m: number, d: number, h: number, min: number): string {
  // Build a UTC timestamp as if NZ were UTC, then subtract NZ's offset for that date.
  const naive = new Date(Date.UTC(y, m, d, h, min, 0));
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(naive).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
  const asNzMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour === 24 ? 0 : parts.hour, parts.minute, parts.second);
  const offsetMs = asNzMs - naive.getTime();
  return new Date(naive.getTime() - offsetMs).toISOString();
}

export function refineUtr(html: string): Partial<{ venue: string; city: string; startsAt: string }> {
  const out: { venue?: string; city?: string; startsAt?: string } = {};

  const whereMatch = html.match(WHERE_RE);
  if (whereMatch) {
    const raw = stripTags(whereMatch[1]);
    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      out.venue = parts.slice(0, -1).join(', ');
      out.city = parts[parts.length - 1];
    } else if (parts[0]) {
      out.venue = parts[0];
    }
  }

  const whenMatch = html.match(WHEN_RE);
  if (whenMatch) {
    const dateText = stripTags(whenMatch[1]);
    const dateParts = parseDate(dateText);
    if (dateParts) {
      const startsMatch = html.match(STARTS_RE);
      const doorsMatch = html.match(DOORS_RE);
      const timeText = stripTags(startsMatch?.[1] ?? doorsMatch?.[1] ?? '');
      const t = timeText ? parseTime(timeText) : null;
      const hour = t?.h ?? 21; // default 9pm if unspecified
      const minute = t?.min ?? 0;
      out.startsAt = nzWallTimeToUtc(dateParts.y, dateParts.m, dateParts.d, hour, minute);
    }
  }

  return out;
}
