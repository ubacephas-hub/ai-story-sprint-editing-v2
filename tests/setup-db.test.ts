import assert from "node:assert/strict";
import test from "node:test";
import {
  applySetupSchema,
  schemaSql,
  type SetupSchemaClient,
} from "../src/lib/setup-db";

type LegacyRow = {
  id: number;
  status: "in_progress" | "completed";
  percentComplete?: number;
};

type UpgradeState = {
  columns: Set<string>;
  indexes: Set<string>;
  rows: LegacyRow[];
};

class FakeSchemaClient implements SetupSchemaClient {
  queries: string[] = [];

  async query(sql: string): Promise<unknown> {
    this.queries.push(sql);
    return undefined;
  }
}

function runSchemaAgainstExistingTable(state: UpgradeState, sql: string): void {
  for (const statement of sql.split(";")) {
    const normalized = statement.replace(/\s+/g, " ").trim();
    const alter = normalized.match(
      /^ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS ([a-z_]+)/
    );
    if (alter) {
      state.columns.add(alter[1]);
      continue;
    }

    if (normalized.startsWith("UPDATE lesson_progress SET percent_complete = 100")) {
      assert.ok(
        state.columns.has("percent_complete"),
        "backfill must run after percent_complete is added"
      );
      for (const row of state.rows) {
        if (row.status === "completed" && (row.percentComplete || 0) < 100) {
          row.percentComplete = 100;
        }
      }
      continue;
    }

    if (
      normalized.startsWith(
        "CREATE INDEX IF NOT EXISTS lesson_progress_user_last_watched_idx"
      )
    ) {
      assert.ok(
        state.columns.has("last_watched_at"),
        "latest-watch index must run after last_watched_at is added"
      );
      state.indexes.add("lesson_progress_user_last_watched_idx");
    }
  }
}

function legacyState(): UpgradeState {
  return {
    columns: new Set([
      "id",
      "user_id",
      "lesson_id",
      "status",
      "updated_at",
      "completed_at",
    ]),
    indexes: new Set(["lesson_progress_user_lesson_idx"]),
    rows: [
      { id: 41, status: "completed", percentComplete: undefined },
      { id: 42, status: "in_progress", percentComplete: undefined },
    ],
  };
}

test("setup upgrades an old lesson_progress table before creating latest-watch index", async () => {
  const client = new FakeSchemaClient();
  await applySetupSchema(client);
  assert.equal(client.queries.length, 1);
  assert.equal(client.queries[0], schemaSql);

  const state = legacyState();
  runSchemaAgainstExistingTable(state, client.queries[0]);

  for (const column of [
    "playback_position_seconds",
    "furthest_position_seconds",
    "duration_seconds",
    "watched_seconds",
    "percent_complete",
    "started_at",
    "last_watched_at",
  ]) {
    assert.equal(state.columns.has(column), true, `missing ${column}`);
  }
  assert.equal(state.indexes.has("lesson_progress_user_last_watched_idx"), true);
  assert.deepEqual(state.rows.map((row) => row.id), [41, 42]);
  assert.equal(state.rows[0].percentComplete, 100);
  assert.equal(state.rows[1].percentComplete, undefined);

  // The same setup SQL is safe when the columns, index, and backfill already exist.
  runSchemaAgainstExistingTable(state, client.queries[0]);
  assert.equal(state.indexes.has("lesson_progress_user_last_watched_idx"), true);
  assert.deepEqual(state.rows.map((row) => row.id), [41, 42]);
  assert.equal(state.rows[0].percentComplete, 100);
});

test("setup defines exactly one latest-watch index after last_watched_at", () => {
  const indexName = "lesson_progress_user_last_watched_idx";
  const indexMatches = schemaSql.match(
    new RegExp(`CREATE INDEX IF NOT EXISTS ${indexName}`, "g")
  );
  assert.equal(indexMatches?.length, 1);
  assert.ok(
    schemaSql.indexOf("ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS last_watched_at") <
      schemaSql.indexOf(`CREATE INDEX IF NOT EXISTS ${indexName}`)
  );
});
