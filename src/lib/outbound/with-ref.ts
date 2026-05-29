const REF_NAME = 'ref';
const REF_VALUE = 'arewegoing';

/**
 * Append `?ref=arewegoing` to outbound URLs so partners can attribute clicks.
 * Idempotent: an existing `ref` param is replaced. Malformed URLs pass through.
 */
export function withRef(rawUrl: string | null | undefined): string {
  if (!rawUrl) return '';
  try {
    const url = new URL(rawUrl);
    url.searchParams.set(REF_NAME, REF_VALUE);
    return url.toString();
  } catch {
    return rawUrl;
  }
}
