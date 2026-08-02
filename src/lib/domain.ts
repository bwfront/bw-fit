import { exerciseMap } from "@/lib/seed";
import type { PlanCommit, PlanDiff, PlanExercise, PlanSnapshot, ProgressDay, ProgressWeek, TrainingDay, WorkoutExercise } from "@/lib/types";

export const DUMBBELL_BAR_WEIGHT_GRAMS = 2_500;
export const DEFAULT_WEEKLY_TARGET = 2;

type CompletedWorkoutSummary = { completedAt: string; totalVolumeGrams: number };

function fromDateKey(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDate(date: string, days: number): string {
  const value = fromDateKey(date);
  value.setUTCDate(value.getUTCDate() + days);
  return toDateKey(value);
}

export function mondayOf(date: string): string {
  const value = fromDateKey(date);
  const offset = (value.getUTCDay() + 6) % 7;
  return shiftDate(date, -offset);
}

/** Builds the calendar grid and aggregates completed sessions by Monday-based calendar week. */
export function buildTrainingPulse(workouts: CompletedWorkoutSummary[], weeklyTarget: number, today: string): { weeks: ProgressWeek[]; days: ProgressDay[]; currentSessions: number; streak: number } {
  const currentWeek = mondayOf(today);
  const firstWeek = shiftDate(currentWeek, -77);
  const sessionsByDay = new Map<string, number>();
  const weeksByStart = new Map<string, { sessions: number; volumeGrams: number }>();

  for (const workout of workouts) {
    const day = workout.completedAt.slice(0, 10);
    const weekStart = mondayOf(day);
    const current = weeksByStart.get(weekStart) ?? { sessions: 0, volumeGrams: 0 };
    current.sessions += 1;
    current.volumeGrams += workout.totalVolumeGrams;
    weeksByStart.set(weekStart, current);
    sessionsByDay.set(day, (sessionsByDay.get(day) ?? 0) + 1);
  }

  const weeks = Array.from({ length: 12 }, (_, index) => {
    const weekStart = shiftDate(firstWeek, index * 7);
    const values = weeksByStart.get(weekStart) ?? { sessions: 0, volumeGrams: 0 };
    return { weekStart, ...values, reachedGoal: values.sessions >= weeklyTarget, isCurrent: weekStart === currentWeek };
  });
  const days: ProgressDay[] = Array.from({ length: 84 }, (_, index) => {
    const date = shiftDate(firstWeek, index);
    return { date, sessions: sessionsByDay.get(date) ?? 0, isToday: date === today };
  });

  let streak = 0;
  let cursor = currentWeek;
  const currentValues = weeksByStart.get(cursor)?.sessions ?? 0;
  if (currentValues < weeklyTarget) cursor = shiftDate(cursor, -7);
  while ((weeksByStart.get(cursor)?.sessions ?? 0) >= weeklyTarget) {
    streak += 1;
    cursor = shiftDate(cursor, -7);
  }

  return { weeks, days, currentSessions: weeksByStart.get(currentWeek)?.sessions ?? 0, streak };
}

export function formatKg(grams: number): string {
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(grams / 1000)} kg`;
}

export function totalExternalLoadGrams(exerciseKey: string, plateWeightGrams: number): number {
  const dumbbellCount = exerciseMap.get(exerciseKey)?.dumbbellCount ?? 0;
  if (dumbbellCount === 0) return 0;
  return (Math.max(0, plateWeightGrams) + DUMBBELL_BAR_WEIGHT_GRAMS) * dumbbellCount;
}

export function formatExerciseLoad(exerciseKey: string, plateWeightGrams: number): string {
  const exercise = exerciseMap.get(exerciseKey);
  if (!exercise || exercise.dumbbellCount === 0) return "Körpergewicht";
  return `${formatKg(plateWeightGrams)} Scheiben/Hantel · ${formatKg(totalExternalLoadGrams(exerciseKey, plateWeightGrams))} gesamt`;
}

export function resolveVariant(keys: string[], completedWorkoutCount: number): string {
  if (!keys.length) throw new Error("Übungsvariante fehlt");
  return keys[completedWorkoutCount % keys.length];
}

export function planHasTrainingDays(snapshot: PlanSnapshot): boolean {
  return snapshot.exercises.some((item) => item.day === "A" || item.day === "B");
}

export function resolveTrainingDay(completedWorkoutCount: number): TrainingDay {
  return completedWorkoutCount % 2 === 0 ? "A" : "B";
}

/** Variant index advances once per visit of that training day when A/B split is active. */
export function resolveSessionVariant(keys: string[], completedWorkoutCount: number, hasTrainingDays: boolean): string {
  const visits = hasTrainingDays ? Math.floor(completedWorkoutCount / 2) : completedWorkoutCount;
  return resolveVariant(keys, visits);
}

export function exercisesForSession(snapshot: PlanSnapshot, completedWorkoutCount: number): PlanExercise[] {
  if (!planHasTrainingDays(snapshot)) return snapshot.exercises;
  const day = resolveTrainingDay(completedWorkoutCount);
  return snapshot.exercises.filter((item) => item.day === day);
}

export function exercisesForDay(snapshot: PlanSnapshot, day: TrainingDay): PlanExercise[] {
  return snapshot.exercises.filter((item) => item.day === day);
}

export function calculateVolume(exerciseKey: string, plateWeightGrams: number, reps: number): number {
  return totalExternalLoadGrams(exerciseKey, plateWeightGrams) * reps;
}

export function workoutVolume(items: WorkoutExercise[]): number {
  return items.reduce(
    (total, item) =>
      total + item.sets.reduce((sum, set) => sum + (set.completed && set.reps ? calculateVolume(item.exerciseKey, set.weightGrams, set.reps) : 0), 0),
    0,
  );
}

export function eligibleForProgression(item: WorkoutExercise): boolean {
  const targeted = item.sets.filter((set) => set.targetReps !== null);
  return targeted.length > 0 && targeted.every((set) => set.completed && (set.reps ?? 0) >= (set.targetReps ?? 0));
}

export function diffPlans(previous: PlanSnapshot, current: PlanSnapshot): PlanDiff[] {
  const previousBySlot = new Map(previous.exercises.map((item) => [item.slotId, item]));
  const currentBySlot = new Map(current.exercises.map((item) => [item.slotId, item]));
  const slots = new Set([...previousBySlot.keys(), ...currentBySlot.keys()]);
  const diffs: PlanDiff[] = [];

  for (const slotId of slots) {
    const before = previousBySlot.get(slotId);
    const after = currentBySlot.get(slotId);
    const key = after?.exerciseKeys[0] ?? before?.exerciseKeys[0] ?? "";
    const changes: string[] = [];
    if (!before) changes.push("Übung hinzugefügt");
    else if (!after) changes.push("Übung entfernt");
    else {
      if (before.weightGrams !== after.weightGrams) changes.push(`${formatExerciseLoad(key, before.weightGrams)} → ${formatExerciseLoad(key, after.weightGrams)}`);
      const beforeReps = before.sets.map((set) => set.reps ?? "frei").join("/");
      const afterReps = after.sets.map((set) => set.reps ?? "frei").join("/");
      if (beforeReps !== afterReps) changes.push(`${beforeReps} → ${afterReps} Wdh.`);
      if (before.exerciseKeys.join() !== after.exerciseKeys.join()) changes.push("Variante geändert");
      if ((before.day ?? null) !== (after.day ?? null)) {
        changes.push(after.day ? `Tag ${after.day}` : "Trainingstag entfernt");
      }
    }
    if (changes.length) diffs.push({ slotId, exerciseName: exerciseMap.get(key)?.shortName ?? "Übung", changes });
  }

  const previousOrder = previous.exercises.map((item) => item.slotId).join();
  const currentOrder = current.exercises.map((item) => item.slotId).join();
  if (previousOrder !== currentOrder) diffs.push({ slotId: "order", exerciseName: "Reihenfolge", changes: ["Reihenfolge geändert"] });
  return diffs;
}

export function visiblePlanVersions(versions: PlanCommit[]): PlanCommit[] {
  const versionById = new Map(versions.map((version) => [version.id, version]));
  return versions.filter((version) => {
    if (!version.parentId) return true;
    const parent = versionById.get(version.parentId);
    if (!parent) return true;
    return diffPlans(parent.snapshot, version.snapshot).some((diff) => diff.slotId !== "order");
  });
}
