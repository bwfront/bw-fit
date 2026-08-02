"use server";

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sqlite } from "@/db";
import { applyTrainingPrescription, calculateVolume, DUMBBELL_BAR_WEIGHT_GRAMS, eligibleForProgression, exercisesForSession, planHasTrainingDays, resolveSessionVariant } from "@/lib/domain";
import { getActivePlan, getActiveWorkout, getBackupPayload, getWorkoutSession } from "@/lib/data";
import { applyAbSplitPlan, applyLegRaiseDefault, legacyWeightToPlateWeight, migrateLegacyPlanWeights } from "@/lib/migrations";
import { exerciseMap } from "@/lib/seed";
import { requireOwner } from "@/lib/session";
import type { PlanSnapshot } from "@/lib/types";

const setUpdateSchema = z.object({
  setId: z.string().min(1),
  weightKg: z.number().min(0).max(500),
  reps: z.number().int().min(0).max(500),
  completed: z.boolean(),
});

const snapshotSchema = z.object({
  name: z.string(),
  goal: z.string(),
  exercises: z.array(z.object({
    slotId: z.string(),
    day: z.enum(["A", "B"]).optional(),
    exerciseKeys: z.array(z.string()).min(1),
    variantMode: z.enum(["fixed", "alternate"]),
    weightGrams: z.number().int().min(0),
    sets: z.array(z.object({ reps: z.number().int().min(0).nullable() })).min(1),
  })),
});

function createPlanVersion(snapshot: PlanSnapshot, message: string, parentId?: string) {
  const current = getActivePlan();
  const id = crypto.randomUUID();
  sqlite.prepare("INSERT INTO plan_version (id, parent_id, message, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, parentId ?? current.id, message, JSON.stringify(snapshot), Date.now());
  sqlite.prepare("UPDATE app_state SET active_plan_version_id = ? WHERE id = 'singleton'").run(id);
  return id;
}

function syncPlanFromTraining(slotId: string, weightGrams: number, reps: number, exerciseKey: string) {
  const plan = getActivePlan();
  const result = applyTrainingPrescription(plan.snapshot, slotId, weightGrams, reps);
  if (!result.changed) return;
  const name = exerciseMap.get(exerciseKey)?.shortName ?? "Übung";
  const message = `${name} aus Training angepasst`;
  if (plan.message === message) {
    sqlite.prepare("UPDATE plan_version SET snapshot_json = ? WHERE id = ?").run(JSON.stringify(result.snapshot), plan.id);
    return;
  }
  createPlanVersion(result.snapshot, message);
}

export async function startWorkout() {
  await requireOwner();
  const active = getActiveWorkout();
  if (active) redirect(`/training/${active.id}`);

  const plan = getActivePlan();
  const state = sqlite.prepare("SELECT completed_workout_count AS count FROM app_state WHERE id = 'singleton'").get() as { count: number };
  const hasDays = planHasTrainingDays(plan.snapshot);
  const sessionExercises = exercisesForSession(plan.snapshot, state.count);
  if (!sessionExercises.length) throw new Error("Für diesen Trainingstag sind keine Übungen hinterlegt.");
  const id = crypto.randomUUID();
  const now = Date.now();
  const transaction = sqlite.transaction(() => {
    sqlite.prepare("INSERT INTO workout_session (id, plan_version_id, status, started_at, total_volume_grams) VALUES (?, ?, 'active', ?, 0)")
      .run(id, plan.id, now);
    const addExercise = sqlite.prepare("INSERT INTO workout_exercise (id, session_id, exercise_key, slot_id, position, skipped) VALUES (?, ?, ?, ?, ?, 0)");
    const addSet = sqlite.prepare("INSERT INTO set_log (id, workout_exercise_id, set_number, target_reps, weight_grams, reps, completed, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)");
    sessionExercises.forEach((item, position) => {
      const exerciseKey = resolveSessionVariant(item.exerciseKeys, state.count, hasDays);
      const workoutExerciseId = crypto.randomUUID();
      addExercise.run(workoutExerciseId, id, exerciseKey, item.slotId, position);
      item.sets.forEach((set, setIndex) => addSet.run(crypto.randomUUID(), workoutExerciseId, setIndex + 1, set.reps, item.weightGrams, set.reps, now));
    });
  });
  transaction();
  redirect(`/training/${id}`);
}

export async function updateSet(input: z.infer<typeof setUpdateSchema>) {
  await requireOwner();
  const data = setUpdateSchema.parse(input);
  const weightGrams = Math.round(data.weightKg * 1000);
  const row = sqlite.prepare(`
    SELECT sl.set_number AS setNumber, sl.weight_grams AS weightGrams, sl.reps AS reps,
           we.id AS workoutExerciseId, we.slot_id AS slotId, we.exercise_key AS exerciseKey, ws.status AS status
    FROM set_log sl
    JOIN workout_exercise we ON we.id = sl.workout_exercise_id
    JOIN workout_session ws ON ws.id = we.session_id
    WHERE sl.id = ?
  `).get(data.setId) as {
    setNumber: number;
    weightGrams: number;
    reps: number | null;
    workoutExerciseId: string;
    slotId: string;
    exerciseKey: string;
    status: string;
  } | undefined;
  if (!row || row.status !== "active") throw new Error("Satz gehört zu keinem aktiven Training.");

  const prescriptionChanged = row.weightGrams !== weightGrams || row.reps !== data.reps;
  const now = Date.now();
  sqlite.transaction(() => {
    sqlite.prepare("UPDATE set_log SET weight_grams = ?, reps = ?, completed = ?, updated_at = ? WHERE id = ?")
      .run(weightGrams, data.reps, data.completed ? 1 : 0, now, data.setId);
    if (!prescriptionChanged) return;
    sqlite.prepare(`
      UPDATE set_log
      SET weight_grams = ?, reps = ?, target_reps = ?, updated_at = ?
      WHERE workout_exercise_id = ? AND set_number > ? AND completed = 0
    `).run(weightGrams, data.reps, data.reps, now, row.workoutExerciseId, row.setNumber);
    syncPlanFromTraining(row.slotId, weightGrams, data.reps, row.exerciseKey);
  })();
  revalidatePath("/training");
  if (prescriptionChanged) {
    revalidatePath("/plan");
    revalidatePath("/");
    revalidatePath("/verlauf");
  }
}

export async function updateSetNote(setId: string, note: string) {
  await requireOwner();
  const id = z.string().uuid().parse(setId);
  const value = z.string().max(500).parse(note).trim();
  sqlite.prepare("UPDATE set_log SET note = ?, updated_at = ? WHERE id = ?")
    .run(value || null, Date.now(), id);
}

export async function setExerciseSkipped(workoutExerciseId: string, skipped: boolean) {
  await requireOwner();
  z.string().uuid().parse(workoutExerciseId);
  sqlite.prepare("UPDATE workout_exercise SET skipped = ? WHERE id = ?").run(skipped ? 1 : 0, workoutExerciseId);
  revalidatePath("/training");
}

export async function saveWorkoutNote(sessionId: string, note: string) {
  await requireOwner();
  z.string().uuid().parse(sessionId);
  sqlite.prepare("UPDATE workout_session SET note = ? WHERE id = ? AND status = 'active'").run(note.slice(0, 1000), sessionId);
}

export async function completeWorkout(sessionId: string) {
  await requireOwner();
  z.string().uuid().parse(sessionId);
  const workout = getWorkoutSession(sessionId);
  if (!workout || workout.status !== "active") throw new Error("Training ist nicht aktiv.");
  const totalVolume = workout.exercises.reduce((total, item) => total + item.sets.reduce((sum, set) => {
    return sum + (set.completed && set.reps ? calculateVolume(item.exerciseKey, set.weightGrams, set.reps) : 0);
  }, 0), 0);
  const transaction = sqlite.transaction(() => {
    sqlite.prepare("UPDATE workout_session SET status = 'completed', completed_at = ?, total_volume_grams = ? WHERE id = ?")
      .run(Date.now(), totalVolume, sessionId);
    sqlite.prepare("UPDATE app_state SET completed_workout_count = completed_workout_count + 1 WHERE id = 'singleton'").run();
    const addSuggestion = sqlite.prepare(`
      INSERT INTO progression_suggestion (id, exercise_key, slot_id, from_weight_grams, to_weight_grams, status, created_at)
      SELECT ?, ?, ?, ?, ?, 'pending', ?
      WHERE NOT EXISTS (SELECT 1 FROM progression_suggestion WHERE slot_id = ? AND status = 'pending')
    `);
    for (const item of workout.exercises) {
      if (!item.skipped && eligibleForProgression(item) && (exerciseMap.get(item.exerciseKey)?.dumbbellCount ?? 0) > 0) {
        const from = item.sets[0].weightGrams;
        addSuggestion.run(crypto.randomUUID(), item.exerciseKey, item.slotId, from, from + 2500, Date.now(), item.slotId);
      }
    }
  });
  transaction();
  revalidatePath("/");
  revalidatePath("/verlauf");
  revalidatePath("/fortschritt");
  redirect(`/training/${sessionId}/abschluss`);
}

export async function cancelWorkout(sessionId: string) {
  await requireOwner();
  z.string().uuid().parse(sessionId);
  sqlite.prepare("UPDATE workout_session SET status = 'cancelled', completed_at = ? WHERE id = ? AND status = 'active'").run(Date.now(), sessionId);
  revalidatePath("/");
  redirect("/");
}

export async function addBodyWeight(formData: FormData) {
  await requireOwner();
  const kg = z.coerce.number().min(30).max(300).parse(formData.get("weightKg"));
  const date = z.string().date().parse(formData.get("date"));
  const note = z.string().max(300).catch("").parse(formData.get("note"));
  const measuredAt = new Date(`${date}T08:00:00`).getTime();
  sqlite.prepare("INSERT INTO body_weight_entry (id, weight_grams, measured_at, note) VALUES (?, ?, ?, ?)")
    .run(crypto.randomUUID(), Math.round(kg * 1000), measuredAt, note || null);
  revalidatePath("/");
  revalidatePath("/fortschritt");
}

export async function updatePlanSlot(formData: FormData) {
  await requireOwner();
  const slotId = z.string().min(1).parse(formData.get("slotId"));
  const weightKg = z.coerce.number().min(0).max(500).parse(formData.get("weightKg"));
  const rawReps = z.string().max(80).parse(formData.get("reps"));
  const plan = getActivePlan();
  const item = plan.snapshot.exercises.find((entry) => entry.slotId === slotId);
  if (!item) throw new Error("Planposition nicht gefunden.");
  const sets = rawReps.split(/[\/,\s]+/).filter(Boolean).map((value) => {
    if (value.toLowerCase() === "frei") return { reps: null };
    return { reps: z.coerce.number().int().min(1).max(200).parse(value) };
  });
  if (!sets.length) throw new Error("Mindestens ein Satz ist nötig.");
  const next: PlanSnapshot = {
    ...plan.snapshot,
    exercises: plan.snapshot.exercises.map((entry) => entry.slotId === slotId
      ? { ...entry, weightGrams: Math.round(weightKg * 1000), sets }
      : entry),
  };
  const name = exerciseMap.get(item.exerciseKeys[0])?.shortName ?? "Übung";
  sqlite.transaction(() => createPlanVersion(next, `${name} angepasst`))();
  revalidatePath("/plan");
  revalidatePath("/verlauf");
  revalidatePath("/");
}

export async function movePlanSlot(slotId: string, direction: -1 | 1) {
  await requireOwner();
  const plan = getActivePlan();
  const index = plan.snapshot.exercises.findIndex((item) => item.slotId === slotId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= plan.snapshot.exercises.length) return;
  const current = plan.snapshot.exercises[index];
  const neighbor = plan.snapshot.exercises[target];
  if ((current.day ?? null) !== (neighbor.day ?? null)) return;
  const exercises = [...plan.snapshot.exercises];
  [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
  sqlite.transaction(() => createPlanVersion({ ...plan.snapshot, exercises }, "Reihenfolge geändert"))();
  revalidatePath("/plan");
  revalidatePath("/verlauf");
}

export async function applySuggestion(id: string) {
  await requireOwner();
  const suggestion = sqlite.prepare("SELECT * FROM progression_suggestion WHERE id = ? AND status = 'pending'").get(id) as Record<string, unknown> | undefined;
  if (!suggestion) return;
  const plan = getActivePlan();
  const next: PlanSnapshot = {
    ...plan.snapshot,
    exercises: plan.snapshot.exercises.map((item) => item.slotId === suggestion.slot_id
      ? { ...item, weightGrams: Number(suggestion.to_weight_grams) }
      : item),
  };
  sqlite.transaction(() => {
    createPlanVersion(next, `${exerciseMap.get(String(suggestion.exercise_key))?.shortName ?? "Gewicht"} gesteigert`);
    sqlite.prepare("UPDATE progression_suggestion SET status = 'applied' WHERE id = ?").run(id);
  })();
  revalidatePath("/");
  revalidatePath("/plan");
  revalidatePath("/verlauf");
}

export async function dismissSuggestion(id: string) {
  await requireOwner();
  sqlite.prepare("UPDATE progression_suggestion SET status = 'dismissed' WHERE id = ?").run(id);
  revalidatePath("/");
}

export async function revertPlan(versionId: string) {
  await requireOwner();
  const row = sqlite.prepare("SELECT snapshot_json FROM plan_version WHERE id = ?").get(versionId) as { snapshot_json: string } | undefined;
  if (!row) throw new Error("Planversion nicht gefunden.");
  const snapshot = snapshotSchema.parse(JSON.parse(row.snapshot_json)) as PlanSnapshot;
  sqlite.transaction(() => createPlanVersion(snapshot, "Frühere Version wiederhergestellt"))();
  revalidatePath("/");
  revalidatePath("/plan");
  revalidatePath("/verlauf");
}

export async function updateSettings(formData: FormData) {
  await requireOwner();
  const targetWeight = z.coerce.number().min(30).max(300).parse(formData.get("targetWeightKg"));
  const targetDate = z.string().date().parse(formData.get("targetDate"));
  const restSeconds = z.coerce.number().int().min(15).max(600).parse(formData.get("restSeconds"));
  const weeklyTarget = z.coerce.number().int().min(1).max(7).parse(formData.get("weeklyTarget"));
  sqlite.prepare("UPDATE owner_settings SET target_weight_grams = ?, target_date = ?, rest_seconds = ?, weekly_target = ?, updated_at = ? WHERE id = 'singleton'")
    .run(Math.round(targetWeight * 1000), targetDate, restSeconds, weeklyTarget, Date.now());
  revalidatePath("/");
  revalidatePath("/einstellungen");
  revalidatePath("/fortschritt");
}

export async function importBackup(formData: FormData) {
  await requireOwner();
  const file = formData.get("backup");
  if (!(file instanceof File) || !file.size) throw new Error("Keine Sicherungsdatei ausgewählt.");
  const parsed = z.object({
    schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    exportedAt: z.string(),
    planVersions: z.array(z.object({ id: z.string(), parentId: z.string().nullable(), message: z.string(), snapshot: snapshotSchema, createdAt: z.string() })),
    activePlanVersionId: z.string(),
    completedWorkoutCount: z.number().int().min(0),
    settings: z.object({ targetWeightGrams: z.number().int(), targetDate: z.string(), restSeconds: z.number().int(), weeklyTarget: z.number().int().min(1).max(7).optional(), theme: z.string() }),
    bodyWeights: z.array(z.object({ id: z.string(), weightGrams: z.number(), measuredAt: z.string(), note: z.string().nullable() })),
    workouts: z.array(z.object({
      id: z.string(), planVersionId: z.string(), status: z.enum(["active", "completed", "cancelled"]),
      startedAt: z.string(), completedAt: z.string().nullable(), note: z.string().nullable(), totalVolumeGrams: z.number().int(),
      exercises: z.array(z.object({
        id: z.string(), sessionId: z.string(), exerciseKey: z.string(), slotId: z.string(), position: z.number().int(), skipped: z.boolean(),
        sets: z.array(z.object({ id: z.string(), workoutExerciseId: z.string(), setNumber: z.number().int(), targetReps: z.number().int().nullable(), weightGrams: z.number().int(), reps: z.number().int().nullable(), completed: z.boolean(), note: z.string().nullable() })),
      })),
    })),
    suggestions: z.array(z.object({ id: z.string(), exerciseKey: z.string(), slotId: z.string(), fromWeightGrams: z.number().int(), toWeightGrams: z.number().int(), status: z.enum(["pending", "applied", "dismissed"]), createdAt: z.string() })),
  }).parse(JSON.parse(await file.text()));

  const backupDir = process.env.BACKUP_PATH ?? resolve(process.cwd(), "backups");
  await mkdir(backupDir, { recursive: true });
  await writeFile(resolve(backupDir, `vor-import-${Date.now()}.json`), JSON.stringify(getBackupPayload(), null, 2), "utf8");

  sqlite.transaction(() => {
    sqlite.prepare("DELETE FROM set_log").run();
    sqlite.prepare("DELETE FROM workout_exercise").run();
    sqlite.prepare("DELETE FROM workout_session").run();
    sqlite.prepare("DELETE FROM progression_suggestion").run();
    sqlite.prepare("DELETE FROM body_weight_entry").run();
    sqlite.prepare("DELETE FROM app_state").run();
    sqlite.prepare("DELETE FROM plan_version").run();
    for (const version of parsed.planVersions) {
      let snapshot = parsed.schemaVersion === 1 ? migrateLegacyPlanWeights(version.snapshot) : version.snapshot;
      if (parsed.schemaVersion === 1 && version.id === parsed.activePlanVersionId) snapshot = applyLegRaiseDefault(snapshot).snapshot;
      if (version.id === parsed.activePlanVersionId) snapshot = applyAbSplitPlan(snapshot).snapshot;
      sqlite.prepare(`INSERT INTO plan_version (id, parent_id, message, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?)`)
        .run(version.id, version.parentId, version.message, JSON.stringify(snapshot), new Date(version.createdAt).getTime());
    }
    sqlite.prepare("INSERT INTO app_state (id, active_plan_version_id, completed_workout_count) VALUES ('singleton', ?, ?)")
      .run(parsed.activePlanVersionId, parsed.completedWorkoutCount);
    sqlite.prepare("UPDATE owner_settings SET target_weight_grams = ?, target_date = ?, rest_seconds = ?, weekly_target = ?, theme = ?, updated_at = ? WHERE id = 'singleton'")
      .run(parsed.settings.targetWeightGrams, parsed.settings.targetDate, parsed.settings.restSeconds, parsed.settings.weeklyTarget ?? 2, parsed.settings.theme, Date.now());
    for (const entry of parsed.bodyWeights) {
      sqlite.prepare("INSERT INTO body_weight_entry (id, weight_grams, measured_at, note) VALUES (?, ?, ?, ?)")
        .run(entry.id, entry.weightGrams, new Date(entry.measuredAt).getTime(), entry.note);
    }
    for (const workout of parsed.workouts) {
      sqlite.prepare("INSERT INTO workout_session (id, plan_version_id, status, started_at, completed_at, note, total_volume_grams) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(workout.id, workout.planVersionId, workout.status, new Date(workout.startedAt).getTime(), workout.completedAt ? new Date(workout.completedAt).getTime() : null, workout.note, workout.totalVolumeGrams);
      for (const item of workout.exercises) {
        sqlite.prepare("INSERT INTO workout_exercise (id, session_id, exercise_key, slot_id, position, skipped) VALUES (?, ?, ?, ?, ?, ?)")
          .run(item.id, workout.id, item.exerciseKey, item.slotId, item.position, item.skipped ? 1 : 0);
        for (const set of item.sets) {
          const weightGrams = parsed.schemaVersion === 1 ? legacyWeightToPlateWeight(item.exerciseKey, set.weightGrams) : set.weightGrams;
          sqlite.prepare("INSERT INTO set_log (id, workout_exercise_id, set_number, target_reps, weight_grams, reps, completed, note, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .run(set.id, item.id, set.setNumber, set.targetReps, weightGrams, set.reps, set.completed ? 1 : 0, set.note, Date.now());
        }
      }
    }
    for (const suggestion of parsed.suggestions) {
      const fromWeightGrams = parsed.schemaVersion === 1 ? legacyWeightToPlateWeight(suggestion.exerciseKey, suggestion.fromWeightGrams) : suggestion.fromWeightGrams;
      const toWeightGrams = parsed.schemaVersion === 1 ? legacyWeightToPlateWeight(suggestion.exerciseKey, suggestion.toWeightGrams) : suggestion.toWeightGrams;
      sqlite.prepare("INSERT INTO progression_suggestion (id, exercise_key, slot_id, from_weight_grams, to_weight_grams, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(suggestion.id, suggestion.exerciseKey, suggestion.slotId, fromWeightGrams, toWeightGrams, suggestion.status, new Date(suggestion.createdAt).getTime());
    }
    if (parsed.schemaVersion === 1) {
      sqlite.exec(`
        UPDATE workout_session
        SET total_volume_grams = COALESCE((
          SELECT SUM(CASE WHEN e.dumbbell_count = 0 THEN 0 ELSE (sl.weight_grams + ${DUMBBELL_BAR_WEIGHT_GRAMS}) * e.dumbbell_count * sl.reps END)
          FROM workout_exercise we
          JOIN set_log sl ON sl.workout_exercise_id = we.id
          JOIN exercise e ON e.key = we.exercise_key
          WHERE we.session_id = workout_session.id AND sl.completed = 1
        ), 0)
        WHERE status = 'completed'
      `);
    }
  })();
  revalidatePath("/");
  revalidatePath("/plan");
  revalidatePath("/fortschritt");
}
