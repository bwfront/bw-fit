import { DUMBBELL_BAR_WEIGHT_GRAMS } from "@/lib/domain";
import { exerciseMap } from "@/lib/seed";
import type { PlanSnapshot } from "@/lib/types";

/** Converts the legacy complete weight of one dumbbell to plate-only weight. */
export function legacyWeightToPlateWeight(exerciseKey: string, legacyWeightGrams: number): number {
  const dumbbellCount = exerciseMap.get(exerciseKey)?.dumbbellCount ?? 0;
  return dumbbellCount === 0 ? 0 : Math.max(0, legacyWeightGrams - DUMBBELL_BAR_WEIGHT_GRAMS);
}

export function migrateLegacyPlanWeights(snapshot: PlanSnapshot): PlanSnapshot {
  return {
    ...snapshot,
    exercises: snapshot.exercises.map((item) => ({
      ...item,
      weightGrams: legacyWeightToPlateWeight(item.exerciseKeys[0] ?? "", item.weightGrams),
    })),
  };
}

export function applyLegRaiseDefault(snapshot: PlanSnapshot): { snapshot: PlanSnapshot; changed: boolean } {
  let changed = false;
  const exercises = snapshot.exercises.map((item) => {
    const isUntouchedDefault = item.exerciseKeys.length === 1
      && item.exerciseKeys[0] === "lying-leg-raise"
      && item.sets.length === 3
      && item.sets.every((set) => set.reps === null);
    if (!isUntouchedDefault) return item;
    changed = true;
    return { ...item, sets: [{ reps: 15 }, { reps: 15 }, { reps: 15 }] };
  });
  return { snapshot: changed ? { ...snapshot, exercises } : snapshot, changed };
}
