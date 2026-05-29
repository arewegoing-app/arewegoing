/**
 * Escapes a string so it can be used safely as a literal pattern inside
 * a RegExp constructor. All special regex metacharacters are backslash-escaped.
 *
 * @param value - The raw string to escape.
 * @returns A string safe to embed in `new RegExp(escapeForRegex(value))`.
 *
 * @example
 * const safe = escapeForRegex('St.');
 * new RegExp(`\\b${safe}\\b`, 'i').test('St. James'); // true
 */
export function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
