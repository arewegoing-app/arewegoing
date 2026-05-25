// Picks a Drizzle backend at module load:
//   1. DATABASE_URL set        → Neon HTTP driver (real Postgres, persists)
//   2. local dev (no VERCEL)   → PGlite on disk in .gigs-data
//   3. Vercel without DB URL   → PGlite in-memory (resets per cold start —
//                                 fine for the preview demo, not for real use)
//
// All three expose the same `db` interface via Drizzle and the same
// `ensureMigrated()` entry point.

import * as schema from './schema';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { log } from '../log';

type Schema = typeof schema;

// Discriminated handle so callers don't care which backend they're talking to.
type DbHandle =
  | {
      mode: 'pglite';
      db: import('drizzle-orm/pglite').PgliteDatabase<Schema>;
      exec: (sql: string) => Promise<void>;
    }
  | {
      mode: 'neon';
      db: import('drizzle-orm/neon-http').NeonHttpDatabase<Schema>;
      exec: (sql: string) => Promise<void>;
    };

declare global {
  // eslint-disable-next-line no-var
  var __gigsDbHandle: DbHandle | undefined;
  // eslint-disable-next-line no-var
  var __gigsMigrated: boolean | undefined;
}

const DEV_DATA_DIR = join(process.cwd(), '.gigs-data');
const MIGRATION_SQL_PATH = join(process.cwd(), 'src/app/gigs/lib/db/migrations.sql');
const SEED_TIMEOUT_MS = 8000;

function makeHandle(): DbHandle {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (databaseUrl) {
    // Lazy require so PGlite-only environments don't load Neon at all.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { neon } = require('@neondatabase/serverless') as typeof import('@neondatabase/serverless');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/neon-http') as typeof import('drizzle-orm/neon-http');
    const sql = neon(databaseUrl);
    const db = drizzle(sql, { schema });
    return {
      mode: 'neon',
      db,
      exec: async (script: string) => {
        // Neon HTTP driver takes one statement at a time. Split on semicolons
        // OUTSIDE of dollar-quoted blocks (we use `do $$ ... $$` for enum
        // creation in migrations.sql).
        for (const stmt of splitSql(script)) {
          if (!stmt.trim()) continue;
          await sql.query(stmt);
        }
      },
    };
  }

  // PGlite path (local dev or Vercel preview without a DB URL).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require('@electric-sql/pglite') as typeof import('@electric-sql/pglite');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/pglite') as typeof import('drizzle-orm/pglite');
  const onVercel = !!process.env.VERCEL;
  let pg: import('@electric-sql/pglite').PGlite;
  if (onVercel) {
    pg = new PGlite();
  } else {
    mkdirSync(DEV_DATA_DIR, { recursive: true });
    pg = new PGlite(DEV_DATA_DIR);
  }
  const db = drizzle(pg, { schema });
  return {
    mode: 'pglite',
    db,
    exec: (script: string) => pg.exec(script).then(() => undefined),
  };
}

const handle: DbHandle = global.__gigsDbHandle ?? makeHandle();
if (process.env.NODE_ENV !== 'production') global.__gigsDbHandle = handle;
log.info({ provider: handle.mode }, 'db.client.init');

// Drizzle exports the same chainable surface from both drivers — callers see
// one `db` regardless of backend.
export const db = handle.db as unknown as import('drizzle-orm/pglite').PgliteDatabase<Schema>;

export async function ensureMigrated(): Promise<void> {
  if (global.__gigsMigrated) return;
  const sqlText = readFileSync(MIGRATION_SQL_PATH, 'utf8');
  await handle.exec(sqlText);
  global.__gigsMigrated = true;
  try {
    const { seedKnownEventsIfEmpty } = await import('../discovery/seed-events');
    await Promise.race([
      seedKnownEventsIfEmpty(),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('seed_timeout')), SEED_TIMEOUT_MS)),
    ]);
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : err }, 'db.seed.skipped');
  }
}

export const dbMode = handle.mode;
export { schema };

/** Split a Postgres SQL script on top-level semicolons, respecting `do $$ ... $$`
 *  dollar-quoted blocks and single-quoted strings. Neon HTTP driver wants one
 *  statement per call. */
function splitSql(script: string): string[] {
  const out: string[] = [];
  let buf = '';
  let i = 0;
  let inSingle = false;
  let inDollar = false;
  let dollarTag = '';
  while (i < script.length) {
    const ch = script[i];
    if (inSingle) {
      buf += ch;
      if (ch === "'" && script[i + 1] !== "'") inSingle = false;
      i++;
      continue;
    }
    if (inDollar) {
      buf += ch;
      if (ch === '$' && script.startsWith(dollarTag, i)) {
        buf += script.slice(i + 1, i + dollarTag.length);
        i += dollarTag.length;
        inDollar = false;
      } else {
        i++;
      }
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      buf += ch;
      i++;
      continue;
    }
    if (ch === '$') {
      // Look for $tag$ or $$ opening dollar-quote.
      const tagMatch = script.slice(i).match(/^\$([a-zA-Z_]*)\$/);
      if (tagMatch) {
        dollarTag = `$${tagMatch[1]}$`;
        inDollar = true;
        buf += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }
    if (ch === ';') {
      out.push(buf.trim());
      buf = '';
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
