import "server-only";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { exercises, initialPlan } from "@/lib/seed";
import * as schema from "@/db/schema";

const databasePath = process.env.DATABASE_PATH ?? resolve(process.cwd(), "data/kraftbuch.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

const globalDatabase = globalThis as typeof globalThis & { kraftbuchSqlite?: Database.Database };
export const sqlite = globalDatabase.kraftbuchSqlite ?? new Database(databasePath);
if (process.env.NODE_ENV !== "production") globalDatabase.kraftbuchSqlite = sqlite;

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite, { schema });

export function ensureDatabase(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migration (
      version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0, image TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, ip_address TEXT,
      user_agent TEXT, user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL, provider_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, access_token TEXT,
      refresh_token TEXT, id_token TEXT, access_token_expires_at INTEGER,
      refresh_token_expires_at INTEGER, scope TEXT, password TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL,
      expires_at INTEGER NOT NULL, created_at INTEGER, updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS exercise (
      id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      short_name TEXT NOT NULL, load_multiplier INTEGER NOT NULL,
      equipment TEXT NOT NULL, demo_slug TEXT NOT NULL, cues_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS plan_version (
      id TEXT PRIMARY KEY, parent_id TEXT, message TEXT NOT NULL,
      snapshot_json TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_state (
      id TEXT PRIMARY KEY, active_plan_version_id TEXT NOT NULL REFERENCES plan_version(id),
      completed_workout_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS owner_settings (
      id TEXT PRIMARY KEY, target_weight_grams INTEGER NOT NULL DEFAULT 80000,
      target_date TEXT NOT NULL DEFAULT '2027-07-19', rest_seconds INTEGER NOT NULL DEFAULT 90,
      theme TEXT NOT NULL DEFAULT 'system', updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workout_session (
      id TEXT PRIMARY KEY, plan_version_id TEXT NOT NULL REFERENCES plan_version(id),
      status TEXT NOT NULL, started_at INTEGER NOT NULL, completed_at INTEGER,
      note TEXT, total_volume_grams INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS workout_exercise (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES workout_session(id) ON DELETE CASCADE,
      exercise_key TEXT NOT NULL, slot_id TEXT NOT NULL, position INTEGER NOT NULL,
      skipped INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS set_log (
      id TEXT PRIMARY KEY, workout_exercise_id TEXT NOT NULL REFERENCES workout_exercise(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL, target_reps INTEGER, weight_grams INTEGER NOT NULL,
      reps INTEGER, completed INTEGER NOT NULL DEFAULT 0, note TEXT, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS body_weight_entry (
      id TEXT PRIMARY KEY, weight_grams INTEGER NOT NULL, measured_at INTEGER NOT NULL, note TEXT
    );
    CREATE TABLE IF NOT EXISTS progression_suggestion (
      id TEXT PRIMARY KEY, exercise_key TEXT NOT NULL, slot_id TEXT NOT NULL,
      from_weight_grams INTEGER NOT NULL, to_weight_grams INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS session_user_idx ON session(user_id);
    CREATE INDEX IF NOT EXISTS workout_status_idx ON workout_session(status, started_at);
    CREATE INDEX IF NOT EXISTS workout_exercise_session_idx ON workout_exercise(session_id, position);
    CREATE INDEX IF NOT EXISTS set_exercise_idx ON set_log(workout_exercise_id, set_number);
  `);

  const now = Date.now();
  const seed = sqlite.transaction(() => {
    sqlite.prepare("INSERT OR IGNORE INTO schema_migration (version, name, applied_at) VALUES (1, 'initial_schema', ?)").run(now);
    const insertExercise = sqlite.prepare(`
      INSERT INTO exercise (id, key, name, short_name, load_multiplier, equipment, demo_slug, cues_json)
      VALUES (@id, @key, @name, @shortName, @loadMultiplier, @equipment, @demoSlug, @cuesJson)
      ON CONFLICT(key) DO UPDATE SET name=excluded.name, short_name=excluded.short_name,
        load_multiplier=excluded.load_multiplier, equipment=excluded.equipment,
        demo_slug=excluded.demo_slug, cues_json=excluded.cues_json
    `);
    for (const item of exercises) insertExercise.run({ ...item, cuesJson: JSON.stringify(item.cues) });

    const existing = sqlite.prepare("SELECT id FROM app_state WHERE id = 'singleton'").get();
    if (!existing) {
      sqlite.prepare("INSERT INTO plan_version (id, parent_id, message, snapshot_json, created_at) VALUES (?, NULL, ?, ?, ?)")
        .run("plan-initial", "Trainingsplan angelegt", JSON.stringify(initialPlan), now);
      sqlite.prepare("INSERT INTO app_state (id, active_plan_version_id, completed_workout_count) VALUES ('singleton', 'plan-initial', 0)").run();
    }
    sqlite.prepare(`
      INSERT INTO owner_settings (id, target_weight_grams, target_date, rest_seconds, theme, updated_at)
      VALUES ('singleton', 80000, '2027-07-19', 90, 'system', ?)
      ON CONFLICT(id) DO NOTHING
    `).run(now);
  });
  seed();
}

ensureDatabase();
