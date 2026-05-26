// Regression test for the splitSql function in src/lib/db/client.ts.
// A 2026-05-26 prod outage was caused by a SQL comment containing a ';'
// — splitSql treated the semicolon as a statement terminator and the next
// fragment failed parsing.

import { strict as assert } from 'node:assert';

async function main() {
  const { splitSql } = await import('@/lib/db/client');

  // Baseline: two statements split cleanly.
  assert.deepEqual(splitSql('select 1; select 2;'), ['select 1', 'select 2']);
  console.log('OK: baseline split on ;');

  // Line comment with a ; inside must not terminate the surrounding stmt.
  const lineComment = `-- nullable; only set when kind='extras'
alter table x add column y integer;`;
  const r1 = splitSql(lineComment);
  assert.equal(r1.length, 1, `expected 1 stmt, got ${r1.length}: ${JSON.stringify(r1)}`);
  console.log('OK: line comment with ; stays in same statement');

  // Block comment with a ; inside ditto.
  const blockComment = `/* with ; inside */ alter table x add column y integer;`;
  const r2 = splitSql(blockComment);
  assert.equal(r2.length, 1, `expected 1 stmt, got ${r2.length}: ${JSON.stringify(r2)}`);
  console.log('OK: block comment with ; stays in same statement');

  // Dollar-quoted block with ; inside must not split.
  const doBlock = `do $$ begin
  alter type reaction_kind add value if not exists 'extras';
exception when others then null; end $$;`;
  const r3 = splitSql(doBlock);
  assert.equal(r3.length, 1, `expected 1 stmt, got ${r3.length}`);
  assert.ok(r3[0].includes("'extras'"));
  console.log('OK: dollar-quoted DO block keeps inner ; intact');

  // Single-quoted string with ; inside must not split.
  const stringStmt = `insert into x (note) values ('hi; there');`;
  const r4 = splitSql(stringStmt);
  assert.equal(r4.length, 1);
  console.log('OK: single-quoted string with ; stays in same statement');

  // The actual offending migration excerpt.
  const real = `create table if not exists feature_interest (id text);
-- features-v2 slice 2: extras_count column. Nullable -- only set when kind is 'extras'.
do $$ begin
  alter table event_reactions add column if not exists extras_count integer;
exception when others then null; end $$;`;
  const r5 = splitSql(real);
  assert.equal(r5.length, 2, `expected 2 stmts (create + comment-leading do block), got ${r5.length}`);
  assert.ok(r5[0].startsWith('create table'));
  // The comment is preserved as the prefix of the do-block statement.
  assert.ok(r5[1].includes('do $$'), `do block lost: ${r5[1]}`);
  // The ';' inside the comment must NOT have terminated the statement early.
  assert.ok(r5[1].includes('extras_count integer'));
  console.log('OK: real migration excerpt splits correctly');

  console.log('All split-sql unit tests passed.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
