import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const exercise = sqliteTable("exercise", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  loadMultiplier: integer("load_multiplier").notNull(),
  equipment: text("equipment").notNull(),
  demoSlug: text("demo_slug").notNull(),
  cuesJson: text("cues_json").notNull(),
});

export const planVersion = sqliteTable("plan_version", {
  id: text("id").primaryKey(),
  parentId: text("parent_id"),
  message: text("message").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export const appState = sqliteTable("app_state", {
  id: text("id").primaryKey(),
  activePlanVersionId: text("active_plan_version_id").notNull().references(() => planVersion.id),
  completedWorkoutCount: integer("completed_workout_count").notNull().default(0),
});

export const ownerSettings = sqliteTable("owner_settings", {
  id: text("id").primaryKey(),
  targetWeightGrams: integer("target_weight_grams").notNull().default(80_000),
  targetDate: text("target_date").notNull().default("2027-07-19"),
  restSeconds: integer("rest_seconds").notNull().default(90),
  theme: text("theme").notNull().default("system"),
  updatedAt: timestamp("updated_at").notNull(),
});

export const workoutSession = sqliteTable("workout_session", {
  id: text("id").primaryKey(),
  planVersionId: text("plan_version_id").notNull().references(() => planVersion.id),
  status: text("status").notNull(),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  note: text("note"),
  totalVolumeGrams: integer("total_volume_grams").notNull().default(0),
});

export const workoutExercise = sqliteTable("workout_exercise", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => workoutSession.id, { onDelete: "cascade" }),
  exerciseKey: text("exercise_key").notNull(),
  slotId: text("slot_id").notNull(),
  position: integer("position").notNull(),
  skipped: integer("skipped", { mode: "boolean" }).notNull().default(false),
});

export const setLog = sqliteTable("set_log", {
  id: text("id").primaryKey(),
  workoutExerciseId: text("workout_exercise_id").notNull().references(() => workoutExercise.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  targetReps: integer("target_reps"),
  weightGrams: integer("weight_grams").notNull(),
  reps: integer("reps"),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  note: text("note"),
  updatedAt: timestamp("updated_at").notNull(),
});

export const bodyWeightEntry = sqliteTable("body_weight_entry", {
  id: text("id").primaryKey(),
  weightGrams: integer("weight_grams").notNull(),
  measuredAt: timestamp("measured_at").notNull(),
  note: text("note"),
});

export const progressionSuggestion = sqliteTable("progression_suggestion", {
  id: text("id").primaryKey(),
  exerciseKey: text("exercise_key").notNull(),
  slotId: text("slot_id").notNull(),
  fromWeightGrams: integer("from_weight_grams").notNull(),
  toWeightGrams: integer("to_weight_grams").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull(),
});

export const schema = {
  user,
  session,
  account,
  verification,
  exercise,
  planVersion,
  appState,
  ownerSettings,
  workoutSession,
  workoutExercise,
  setLog,
  bodyWeightEntry,
  progressionSuggestion,
};
