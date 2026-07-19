import { exerciseMap } from "@/lib/seed";
import type { PlanCommit, PlanDiff, PlanSnapshot, WorkoutExercise } from "@/lib/types";

export const DUMBBELL_BAR_WEIGHT_GRAMS = 2_500;

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
