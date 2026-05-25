import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as schema from './schema';

const DEV_DATA_DIR = join(process.cwd(), '.gigs-data');
const MIGRATION_SQL_PATH = join(process.cwd(), 'src/app/gigs/lib/db/migrations.sql');

declare global {
  // eslint-disable-next-line no-var
  var __gigsDb: PgliteDatabase<typeof schema> | undefined;
  // eslint-disable-next-line no-var
  var __gigsPg: PGlite | undefined;
  // eslint-disable-next-line no-var
  var __gigsMigrated: boolean | undefined;
}

function makeDb(): { db: PgliteDatabase<typeof schema>; pg: PGlite } {
  // On Vercel (or any read-only/serverless filesystem) use in-memory PGlite.
  // Data resets on each cold start — fine for the preview deploy. Switch to Neon
  // for persistence by reading DATABASE_URL.
  const onVercel = !!process.env.VERCEL;
  if (onVercel) {
    const pg = new PGlite();
    return { db: drizzle(pg, { schema }), pg };
  }
  mkdirSync(DEV_DATA_DIR, { recursive: true });
  const pg = new PGlite(DEV_DATA_DIR);
  return { db: drizzle(pg, { schema }), pg };
}

const cached = global.__gigsDb && global.__gigsPg ? { db: global.__gigsDb, pg: global.__gigsPg } : makeDb();
if (process.env.NODE_ENV !== 'production') {
  global.__gigsDb = cached.db;
  global.__gigsPg = cached.pg;
}

export const db = cached.db;

export async function ensureMigrated(): Promise<void> {
  if (global.__gigsMigrated) return;
  const sql = readFileSync(MIGRATION_SQL_PATH, 'utf8');
  await cached.pg.exec(sql);
  global.__gigsMigrated = true;
}

export { schema };
