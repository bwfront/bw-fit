import { DUMBBELL_BAR_WEIGHT_GRAMS } from "@/lib/domain";
import { exerciseMap, initialPlan } from "@/lib/seed";
import type { PlanExercise, PlanSnapshot, TrainingDay } from "@/lib/types";

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

const AB_SPLIT_ORDER: Array<{ slotId: string; day: TrainingDay }> = [
  { slotId: "slot-bench", day: "A" },
  { slotId: "slot-row", day: "A" },
  { slotId: "slot-shoulder", day: "A" },
  { slotId: "slot-leg-raise", day: "B" },
  { slotId: "slot-squat", day: "B" },
  { slotId: "slot-curl", day: "B" },
];

function isAbSplitPlan(snapshot: PlanSnapshot): boolean {
  if (snapshot.exercises.length !== AB_SPLIT_ORDER.length) return false;
  return snapshot.exercises.every((item, index) => {
    const expected = AB_SPLIT_ORDER[index];
    return item.slotId === expected.slotId && item.day === expected.day;
  });
}

/** Builds the A/B split while keeping weights and set targets from matching slots. */
export function applyAbSplitPlan(snapshot: PlanSnapshot): { snapshot: PlanSnapshot; changed: boolean } {
  if (isAbSplitPlan(snapshot)) return { snapshot, changed: false };

  const bySlot = new Map(snapshot.exercises.map((item) => [item.slotId, item]));
  const defaults = new Map(initialPlan.exercises.map((item) => [item.slotId, item]));
  const exercises: PlanExercise[] = AB_SPLIT_ORDER.map(({ slotId, day }) => {
    const existing = bySlot.get(slotId);
    const fallback = defaults.get(slotId)!;
    return {
      slotId,
      day,
      exerciseKeys: existing?.exerciseKeys?.length ? existing.exerciseKeys : fallback.exerciseKeys,
      variantMode: existing?.variantMode ?? fallback.variantMode,
      weightGrams: existing?.weightGrams ?? fallback.weightGrams,
      sets: existing?.sets?.length ? existing.sets : fallback.sets,
    };
  });

  return {
    changed: true,
    snapshot: {
      ...snapshot,
      goal: snapshot.goal.includes("Tag A/B") ? snapshot.goal : `${snapshot.goal.replace(/\s·\s*$/, "")} · Tag A/B`.replace(/\s+/g, " ").trim(),
      exercises,
    },
  };
}
