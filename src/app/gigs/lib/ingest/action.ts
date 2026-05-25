'use server';

import { z } from 'zod';
import { ingest } from './fetch';
import type { IngestResult } from './types';

const inputSchema = z.object({ url: z.string().url().max(2000) });

export async function fetchEventMetadata(input: { url: string }): Promise<IngestResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_url' };
  return ingest(parsed.data.url);
}
