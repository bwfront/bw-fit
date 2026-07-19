import "server-only";

import { sqlite } from "@/db";
import { DUMBBELL_BAR_WEIGHT_GRAMS } from "@/lib/domain";
import { exerciseMap } from "@/lib/seed";
import type { PlanCommit, PlanSnapshot, ProgressionSuggestion, SetLog, WorkoutExercise, WorkoutSession } from "@/lib/types";

type Row = Record<string, unknown>;

function dateValue(value: unknown): string {
  return new Date(Number(value)).toISOString();
}

export function getActivePlan(): PlanCommit {
  const row = sqlite.prepare(`
    SELECT p.* FROM plan_version p
    JOIN app_state a ON a.active_plan_version_id = p.id
    WHERE a.id = 'singleton'
  `).get() as Row;
  return {
    id: String(row.id),
    parentId: row.parent_id ? String(row.parent_id) : null,
    message: String(row.message),
    snapshot: JSON.parse(String(row.snapshot_json)) as PlanSnapshot,
    createdAt: dateValue(row.created_at),
  };
}

export function getPlanVersions(limit?: number): PlanCommit[] {
  const rows = (limit === undefined
    ? sqlite.prepare("SELECT * FROM plan_version ORDER BY created_at DESC").all()
    : sqlite.prepare("SELECT * FROM plan_version ORDER BY created_at DESC LIMIT ?").all(limit)) as Row[];
  return rows.map((row) => ({
    id: String(row.id),
    parentId: row.parent_id ? String(row.parent_id) : null,
    message: String(row.message),
    snapshot: JSON.parse(String(row.snapshot_json)) as PlanSnapshot,
    createdAt: dateValue(row.created_at),
  }));
}

export function getCompletedWorkoutCount(): number {
  const row = sqlite.prepare("SELECT completed_workout_count AS count FROM app_state WHERE id = 'singleton'").get() as Row;
  return Number(row.count);
}

export function getWorkoutSession(id: string): WorkoutSession | null {
  const row = sqlite.prepare("SELECT * FROM workout_session WHERE id = ?").get(id) as Row | undefined;
  if (!row) return null;
  const exerciseRows = sqlite.prepare("SELECT * FROM workout_exercise WHERE session_id = ? ORDER BY position").all(id) as Row[];
  const exercises: WorkoutExercise[] = exerciseRows.map((exerciseRow) => {
    const setRows = sqlite.prepare("SELECT * FROM set_log WHERE workout_exercise_id = ? ORDER BY set_number").all(exerciseRow.id) as Row[];
    return {
      id: String(exerciseRow.id),
      sessionId: id,
      exerciseKey: String(exerciseRow.exercise_key),
      slotId: String(exerciseRow.slot_id),
      position: Number(exerciseRow.position),
      skipped: Boolean(exerciseRow.skipped),
      sets: setRows.map((setRow): SetLog => ({
        id: String(setRow.id),
        workoutExerciseId: String(setRow.workout_exercise_id),
        setNumber: Number(setRow.set_number),
        targetReps: setRow.target_reps === null ? null : Number(setRow.target_reps),
        weightGrams: Number(setRow.weight_grams),
        reps: setRow.reps === null ? null : Number(setRow.reps),
        completed: Boolean(setRow.completed),
        note: setRow.note ? String(setRow.note) : null,
      })),
    };
  });
  return {
    id: String(row.id),
    planVersionId: String(row.plan_version_id),
    status: String(row.status) as WorkoutSession["status"],
    startedAt: dateValue(row.started_at),
    completedAt: row.completed_at ? dateValue(row.completed_at) : null,
    note: row.note ? String(row.note) : null,
    totalVolumeGrams: Number(row.total_volume_grams),
    exercises,
  };
}

export function getActiveWorkout(): WorkoutSession | null {
  const row = sqlite.prepare("SELECT id FROM workout_session WHERE status = 'active' ORDER BY started_at DESC LIMIT 1").get() as Row | undefined;
  return row ? getWorkoutSession(String(row.id)) : null;
}

export function getRecentWorkouts(limit = 20): WorkoutSession[] {
  const rows = sqlite.prepare("SELECT id FROM workout_session WHERE status = 'completed' ORDER BY completed_at DESC LIMIT ?").all(limit) as Row[];
  return rows.map((row) => getWorkoutSession(String(row.id))).filter((item): item is WorkoutSession => Boolean(item));
}

export function getPreviousExercisePerformance(exerciseKey: string, beforeStartedAt?: string) {
  const before = beforeStartedAt ? new Date(beforeStartedAt).getTime() : Date.now() + 1;
  const row = sqlite.prepare(`
    SELECT we.id FROM workout_exercise we
    JOIN workout_session ws ON ws.id = we.session_id
    WHERE we.exercise_key = ? AND ws.status = 'completed' AND ws.started_at < ?
    ORDER BY ws.completed_at DESC LIMIT 1
  `).get(exerciseKey, before) as Row | undefined;
  if (!row) return [];
  return (sqlite.prepare("SELECT weight_grams, reps FROM set_log WHERE workout_exercise_id = ? AND completed = 1 ORDER BY set_number").all(row.id) as Row[])
    .map((set) => ({ weightGrams: Number(set.weight_grams), reps: Number(set.reps) }));
}

export function getSettings() {
  const row = sqlite.prepare("SELECT * FROM owner_settings WHERE id = 'singleton'").get() as Row;
  return {
    targetWeightGrams: Number(row.target_weight_grams),
    targetDate: String(row.target_date),
    restSeconds: Number(row.rest_seconds),
    theme: String(row.theme),
  };
}

export function getBodyWeights(limit = 50) {
  const rows = sqlite.prepare("SELECT * FROM body_weight_entry ORDER BY measured_at DESC LIMIT ?").all(limit) as Row[];
  return rows.map((row) => ({
    id: String(row.id),
    weightGrams: Number(row.weight_grams),
    measuredAt: dateValue(row.measured_at),
    note: row.note ? String(row.note) : null,
  }));
}

export function getPendingSuggestions(): ProgressionSuggestion[] {
  const rows = sqlite.prepare("SELECT * FROM progression_suggestion WHERE status = 'pending' ORDER BY created_at DESC").all() as Row[];
  return rows.map((row) => ({
    id: String(row.id),
    exerciseKey: String(row.exercise_key),
    slotId: String(row.slot_id),
    fromWeightGrams: Number(row.from_weight_grams),
    toWeightGrams: Number(row.to_weight_grams),
    status: String(row.status) as ProgressionSuggestion["status"],
    createdAt: dateValue(row.created_at),
  }));
}

export function getExerciseStats() {
  const rows = sqlite.prepare(`
    SELECT we.exercise_key,
      MAX(sl.weight_grams) AS max_weight,
      SUM(CASE WHEN e.dumbbell_count = 0 THEN 0 ELSE (sl.weight_grams + ${DUMBBELL_BAR_WEIGHT_GRAMS}) * sl.reps * e.dumbbell_count END) AS total_volume,
      COUNT(DISTINCT ws.id) AS sessions
    FROM set_log sl
    JOIN workout_exercise we ON we.id = sl.workout_exercise_id
    JOIN workout_session ws ON ws.id = we.session_id
    JOIN exercise e ON e.key = we.exercise_key
    WHERE sl.completed = 1 AND ws.status = 'completed'
    GROUP BY we.exercise_key ORDER BY total_volume DESC
  `).all() as Row[];
  return rows.map((row) => ({
    exerciseKey: String(row.exercise_key),
    name: exerciseMap.get(String(row.exercise_key))?.shortName ?? String(row.exercise_key),
    maxWeightGrams: Number(row.max_weight ?? 0),
    totalVolumeGrams: Number(row.total_volume ?? 0),
    sessions: Number(row.sessions ?? 0),
  }));
}

export function getBackupPayload() {
  const state = sqlite.prepare("SELECT * FROM app_state WHERE id = 'singleton'").get() as Row;
  const settings = getSettings();
  const sessionRows = sqlite.prepare("SELECT id FROM workout_session ORDER BY started_at").all() as Row[];
  const suggestionRows = sqlite.prepare("SELECT * FROM progression_suggestion ORDER BY created_at").all() as Row[];
  return {
    schemaVersion: 2 as const,
    exportedAt: new Date().toISOString(),
    planVersions: getPlanVersions(10_000).reverse(),
    activePlanVersionId: String(state.active_plan_version_id),
    completedWorkoutCount: Number(state.completed_workout_count),
    settings,
    bodyWeights: getBodyWeights(10_000).reverse(),
    workouts: sessionRows.map((row) => getWorkoutSession(String(row.id))).filter((item): item is WorkoutSession => Boolean(item)),
    suggestions: suggestionRows.map((row) => ({
      id: String(row.id),
      exerciseKey: String(row.exercise_key),
      slotId: String(row.slot_id),
      fromWeightGrams: Number(row.from_weight_grams),
      toWeightGrams: Number(row.to_weight_grams),
      status: String(row.status),
      createdAt: dateValue(row.created_at),
    })),
  };
}
