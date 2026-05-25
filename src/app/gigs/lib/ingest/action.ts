'use server';

import { z } from 'zod';
import { ingest } from './fetch';
import type { IngestResult } from './types';
import { log } from '../log';

const inputSchema = z.object({ url: z.string().url().max(2000) });

export async function fetchEventMetadata(input: { url: string }): Promise<IngestResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    log.warn({ reason: 'invalid_url' }, 'ingest.rejected');
    return { ok: false, reason: 'invalid_url' };
  }
  try {
    const result = await ingest(parsed.data.url);
    if (result.ok) {
      log.info({ url: parsed.data.url, source: result.metadata.source }, 'ingest.ok');
    } else {
      log.warn({ url: parsed.data.url, reason: result.reason }, 'ingest.rejected');
    }
    return result;
  } catch (err) {
    log.error({ err, url: parsed.data.url }, 'ingest.failed');
    throw err;
  }
}
