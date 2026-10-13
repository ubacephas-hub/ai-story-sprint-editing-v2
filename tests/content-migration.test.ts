import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { schemaSql } from "../src/lib/setup-db";

const migration = readFileSync(
  resolve("migrations/004_content_archiving.sql"),
  "utf8"
);

test("archive migration is idempotent, additive, and leaves existing content untouched", () => {
  for (const statement of [
    "ALTER TABLE modules ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ",
    "ALTER TABLE modules ADD COLUMN IF NOT EXISTS archived_by INTEGER",
    "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ",
    "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS archived_by INTEGER",
    "CREATE INDEX IF NOT EXISTS modules_active_course_position_idx",
    "CREATE INDEX IF NOT EXISTS lessons_active_module_position_idx",
  ]) {
    assert.ok(migration.includes(statement), `missing idempotent SQL: ${statement}`);
  }

  const executableSql = migration
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  assert.doesNotMatch(executableSql, /^\s*(DELETE|UPDATE|DROP)\b/im);
  assert.match(migration, /REFERENCES users\(id\) ON DELETE SET NULL/);
  assert.match(migration, /Rollback guidance/i);
});

test("protected setup handles new and existing databases with nullable archive fields", () => {
  for (const statement of [
    "archived_at TIMESTAMPTZ",
    "archived_by INTEGER REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE modules ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ",
    "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ",
    "CREATE INDEX IF NOT EXISTS modules_active_course_position_idx",
    "CREATE INDEX IF NOT EXISTS lessons_active_module_position_idx",
  ]) {
    assert.ok(schemaSql.includes(statement), `setup schema is missing: ${statement}`);
  }
});
