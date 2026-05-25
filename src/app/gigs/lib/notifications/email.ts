import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUTBOX_DIR = join(process.cwd(), '.gigs-outbox');

export type Email = {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail(email: Email): Promise<{ id: string }> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (!process.env.RESEND_API_KEY) {
    mkdirSync(OUTBOX_DIR, { recursive: true });
    writeFileSync(join(OUTBOX_DIR, `${id}.json`), JSON.stringify({ id, ...email }, null, 2));
    return { id };
  }
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = email.from ?? process.env.RESEND_FROM ?? 'Gigs <noreply@example.com>';
  const res = await resend.emails.send({ ...email, from });
  if (res.error) throw new Error(`Resend: ${res.error.message}`);
  return { id: res.data?.id ?? id };
}
