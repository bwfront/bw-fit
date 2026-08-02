import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildTrainingPulse, calculateVolume, diffPlans, eligibleForProgression, exercisesForSession, applyTrainingPrescription, formatExerciseLoad, formatKg, propagateSetPrescription, resolveSessionVariant, resolveTrainingDay, resolveVariant, totalExternalLoadGrams, visiblePlanVersions } from "@/lib/domain";
import { localVideoDemoSlugs } from "@/lib/media";
import { applyAbSplitPlan, applyLegRaiseDefault, legacyWeightToPlateWeight, migrateLegacyPlanWeights } from "@/lib/migrations";
import { initialPlan } from "@/lib/seed";
import type { PlanCommit, PlanSnapshot, WorkoutExercise } from "@/lib/types";

describe("Gewichte und Volumen", () => {
  it("formatiert Kilogramm und erklärt Scheiben- sowie Gesamtgewicht", () => {
    expect(formatKg(17_500)).toBe("17,5 kg");
    expect(formatKg(0)).toBe("0 kg");
    expect(formatExerciseLoad("flat-bench-press", 10_000)).toBe("10 kg Scheiben/Hantel · 25 kg gesamt");
    expect(formatExerciseLoad("lying-leg-raise", 0)).toBe("Körpergewicht");
  });

  it("addiert das Stangengewicht und berechnet 0, 1 und 2 Hanteln", () => {
    expect(totalExternalLoadGrams("flat-bench-press", 10_000)).toBe(25_000);
    expect(calculateVolume("flat-bench-press", 10_000, 12)).toBe(300_000);
    expect(calculateVolume("goblet-squat", 10_000, 10)).toBe(125_000);
    expect(calculateVolume("lateral-raise", 10_000, 12)).toBe(300_000);
    expect(calculateVolume("lying-leg-raise", 0, 15)).toBe(0);
  });
});

describe("Varianten", () => {
  it("wechselt erst mit dem Zähler abgeschlossener Trainings", () => {
    const keys = ["incline-bench-press", "flat-bench-press"];
    expect(resolveVariant(keys, 0)).toBe("incline-bench-press");
    expect(resolveVariant(keys, 1)).toBe("flat-bench-press");
    expect(resolveVariant(keys, 2)).toBe("incline-bench-press");
  });

  it("wechselt im A/B-Split erst nach dem nächsten Besuch desselben Tags", () => {
    const keys = ["incline-bench-press", "flat-bench-press"];
    expect(resolveTrainingDay(0)).toBe("A");
    expect(resolveTrainingDay(1)).toBe("B");
    expect(resolveSessionVariant(keys, 0, true)).toBe("incline-bench-press");
    expect(resolveSessionVariant(keys, 2, true)).toBe("flat-bench-press");
    expect(exercisesForSession(initialPlan, 0).map((item) => item.slotId)).toEqual(["slot-bench", "slot-row", "slot-shoulder"]);
    expect(exercisesForSession(initialPlan, 1).map((item) => item.slotId)).toEqual(["slot-leg-raise", "slot-squat", "slot-curl"]);
  });
});

describe("Progression", () => {
  it("schlägt nur nach allen erreichten Zielwiederholungen eine Steigerung vor", () => {
    const exercise: WorkoutExercise = {
      id: "we", sessionId: "ws", exerciseKey: "goblet-squat", slotId: "slot", position: 0, skipped: false,
      sets: [1, 2, 3].map((setNumber) => ({ id: `set-${setNumber}`, workoutExerciseId: "we", setNumber, targetReps: 10, weightGrams: 17_500, reps: 10, completed: true, note: null })),
    };
    expect(eligibleForProgression(exercise)).toBe(true);
    exercise.sets[2].reps = 9;
    expect(eligibleForProgression(exercise)).toBe(false);
  });

  it("übernimmt angepasste Werte auf alle folgenden offenen Sätze", () => {
    const sets = [
      { id: "1", setNumber: 1, completed: true, weightGrams: 10_000, reps: 12, targetReps: 12 },
      { id: "2", setNumber: 2, completed: false, weightGrams: 10_000, reps: 12, targetReps: 12 },
      { id: "3", setNumber: 3, completed: false, weightGrams: 10_000, reps: 8, targetReps: 8 },
    ];
    expect(propagateSetPrescription(sets, 2, 12_500, 10)).toEqual([
      sets[0],
      sets[1],
      { ...sets[2], weightGrams: 12_500, reps: 10, targetReps: 10 },
    ]);
  });

  it("schreibt die Trainingsvorgabe einheitlich zurück in den Plan", () => {
    const result = applyTrainingPrescription(initialPlan, "slot-shoulder", 12_500, 10);
    expect(result.changed).toBe(true);
    expect(result.snapshot.exercises.find((item) => item.slotId === "slot-shoulder")).toMatchObject({
      weightGrams: 12_500,
      sets: [{ reps: 10 }, { reps: 10 }, { reps: 10 }],
    });
    expect(applyTrainingPrescription(result.snapshot, "slot-shoulder", 12_500, 10).changed).toBe(false);
  });
});

describe("Trainingspuls", () => {
  it("aggregiert Montag-basierte Wochen, Kalenderfelder und eine erreichte Wochenserie", () => {
    const pulse = buildTrainingPulse([
      { completedAt: "2026-07-14", totalVolumeGrams: 400_000 },
      { completedAt: "2026-07-16", totalVolumeGrams: 500_000 },
      { completedAt: "2026-07-07", totalVolumeGrams: 300_000 },
      { completedAt: "2026-07-09", totalVolumeGrams: 300_000 },
      { completedAt: "2026-06-30", totalVolumeGrams: 100_000 },
    ], 2, "2026-07-19");

    expect(pulse.weeks).toHaveLength(12);
    expect(pulse.days).toHaveLength(84);
    expect(pulse.weeks.at(-1)).toMatchObject({ weekStart: "2026-07-13", sessions: 2, volumeGrams: 900_000, reachedGoal: true, isCurrent: true });
    expect(pulse.currentSessions).toBe(2);
    expect(pulse.streak).toBe(2);
    expect(pulse.days.find((day) => day.date === "2026-07-14")).toMatchObject({ sessions: 1 });
  });

  it("zählt eine unvollständige laufende Woche nicht zur Serie", () => {
    const pulse = buildTrainingPulse([
      { completedAt: "2026-07-15", totalVolumeGrams: 100_000 },
      { completedAt: "2026-07-07", totalVolumeGrams: 100_000 },
      { completedAt: "2026-07-09", totalVolumeGrams: 100_000 },
    ], 2, "2026-07-19");
    expect(pulse.currentSessions).toBe(1);
    expect(pulse.streak).toBe(1);
  });
});

describe("Plan-Historie", () => {
  it("beschreibt Gewichts- und Wiederholungsänderungen", () => {
    const next = structuredClone(initialPlan);
    next.exercises[0].weightGrams = 12_500;
    next.exercises[0].sets = [{ reps: 10 }, { reps: 10 }, { reps: 10 }];
    const diff = diffPlans(initialPlan, next);
    expect(diff[0].changes).toContain("10 kg Scheiben/Hantel · 25 kg gesamt → 12,5 kg Scheiben/Hantel · 30 kg gesamt");
    expect(diff[0].changes).toContain("12/12/12 → 10/10/10 Wdh.");
  });

  it("enthält die sechs vereinbarten Planpositionen als Tag A/B", () => {
    expect(initialPlan.exercises).toHaveLength(6);
    expect(initialPlan.exercises.filter((item) => item.day === "A").map((item) => item.slotId)).toEqual(["slot-bench", "slot-row", "slot-shoulder"]);
    expect(initialPlan.exercises.filter((item) => item.day === "B").map((item) => item.slotId)).toEqual(["slot-leg-raise", "slot-squat", "slot-curl"]);
    expect(initialPlan.exercises.find((item) => item.slotId === "slot-leg-raise")?.sets.map((set) => set.reps)).toEqual([15, 15, 15]);
  });

  it("blendet reine Reihenfolgeversionen aus, ohne die gespeicherte Kette zu verändern", () => {
    const base: PlanCommit = { id: "base", parentId: null, message: "Start", snapshot: structuredClone(initialPlan), createdAt: "2026-07-19T10:00:00.000Z" };
    const reorderedSnapshot = structuredClone(initialPlan);
    [reorderedSnapshot.exercises[0], reorderedSnapshot.exercises[1]] = [reorderedSnapshot.exercises[1], reorderedSnapshot.exercises[0]];
    const reordered: PlanCommit = { id: "order", parentId: base.id, message: "Reihenfolge geändert", snapshot: reorderedSnapshot, createdAt: "2026-07-19T10:01:00.000Z" };
    const changedSnapshot = structuredClone(reorderedSnapshot);
    changedSnapshot.exercises.find((item) => item.slotId === "slot-squat")!.weightGrams = 20_000;
    const changed: PlanCommit = { id: "changed", parentId: reordered.id, message: "Goblet Squat angepasst", snapshot: changedSnapshot, createdAt: "2026-07-19T10:02:00.000Z" };
    const storedVersions = [changed, reordered, base];

    expect(visiblePlanVersions(storedVersions).map((version) => version.id)).toEqual(["changed", "base"]);
    expect(storedVersions.map(({ id, parentId }) => ({ id, parentId }))).toEqual([
      { id: "changed", parentId: "order" },
      { id: "order", parentId: "base" },
      { id: "base", parentId: null },
    ]);
    expect(diffPlans(reordered.snapshot, changed.snapshot).find((diff) => diff.slotId === "slot-squat")?.changes).toHaveLength(1);
  });

  it("zeigt gemischte fachliche und Reihenfolgeänderungen weiterhin an", () => {
    const base: PlanCommit = { id: "base", parentId: null, message: "Start", snapshot: structuredClone(initialPlan), createdAt: "2026-07-19T10:00:00.000Z" };
    const mixedSnapshot = structuredClone(initialPlan);
    [mixedSnapshot.exercises[0], mixedSnapshot.exercises[1]] = [mixedSnapshot.exercises[1], mixedSnapshot.exercises[0]];
    mixedSnapshot.exercises.find((item) => item.slotId === "slot-squat")!.sets = [{ reps: 12 }, { reps: 12 }, { reps: 12 }];
    const mixed: PlanCommit = { id: "mixed", parentId: base.id, message: "Plan angepasst", snapshot: mixedSnapshot, createdAt: "2026-07-19T10:01:00.000Z" };

    expect(diffPlans(base.snapshot, mixed.snapshot).map((diff) => diff.slotId)).toEqual(["slot-squat", "order"]);
    expect(visiblePlanVersions([mixed, base]).map((version) => version.id)).toEqual(["mixed", "base"]);
  });
});

describe("Übungsmedien", () => {
  it("liefert für jede Übungsvariante ein lokales Video", () => {
    const manifest = JSON.parse(readFileSync(resolve("public/media/ATTRIBUTION.json"), "utf8")) as {
      assets: Array<{ slug: string; file: string; license: string; sourceUrl: string }>;
    };
    expect(manifest.assets.map((asset) => asset.slug).sort()).toEqual([...localVideoDemoSlugs].sort());
    for (const asset of manifest.assets) {
      expect(existsSync(resolve("public", asset.file.replace(/^\//, "")))).toBe(true);
      expect(asset.license).toMatch(/^CC-BY/);
      expect(asset.sourceUrl).toMatch(/^https:\/\//);
    }
    const available = new Set(manifest.assets.map((asset) => asset.slug));
    expect(Object.values(initialPlan.exercises).flatMap((entry) => entry.exerciseKeys).every((key) => available.has(key))).toBe(true);
  });
});

describe("Datenmigrationen", () => {
  it("konvertiert alte Gesamtgewichte eindeutig in Scheibengewichte", () => {
    expect(legacyWeightToPlateWeight("flat-bench-press", 10_000)).toBe(7_500);
    expect(legacyWeightToPlateWeight("lying-leg-raise", 0)).toBe(0);
    const legacy = structuredClone(initialPlan);
    legacy.exercises[0].weightGrams = 17_500;
    expect(migrateLegacyPlanWeights(legacy).exercises[0].weightGrams).toBe(15_000);
  });

  it("setzt nur den unveränderten freien Beinheben-Standard auf 3 x 15", () => {
    const legacy = structuredClone(initialPlan);
    const legRaise = legacy.exercises.find((item) => item.slotId === "slot-leg-raise")!;
    legRaise.sets = [{ reps: null }, { reps: null }, { reps: null }];
    expect(applyLegRaiseDefault(legacy).snapshot.exercises.find((item) => item.slotId === "slot-leg-raise")?.sets.map((set) => set.reps)).toEqual([15, 15, 15]);

    legRaise.sets = [{ reps: 12 }, { reps: null }, { reps: null }];
    const customized = applyLegRaiseDefault(legacy);
    expect(customized.changed).toBe(false);
    expect(customized.snapshot.exercises.find((item) => item.slotId === "slot-leg-raise")?.sets.map((set) => set.reps)).toEqual([12, null, null]);
  });

  it("migriert den Full-Body-Plan auf Tag A/B und behält Gewichte sowie Sätze", () => {
    const legacy: PlanSnapshot = {
      name: "Trainingsplan Sommer 2027",
      goal: "Massiver Aufbau · ca. 80 kg definiert",
      exercises: [
        { slotId: "slot-squat", exerciseKeys: ["goblet-squat"], variantMode: "fixed", weightGrams: 20_000, sets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }] },
        { slotId: "slot-bench", exerciseKeys: ["incline-bench-press", "flat-bench-press"], variantMode: "alternate", weightGrams: 12_500, sets: [{ reps: 12 }, { reps: 12 }, { reps: 12 }] },
        { slotId: "slot-row", exerciseKeys: ["bent-over-row"], variantMode: "fixed", weightGrams: 10_000, sets: [{ reps: 12 }, { reps: 12 }, { reps: 12 }] },
        { slotId: "slot-shoulder", exerciseKeys: ["seated-shoulder-press"], variantMode: "fixed", weightGrams: 10_000, sets: [{ reps: 10 }, { reps: 10 }, { reps: 8 }] },
        { slotId: "slot-curl", exerciseKeys: ["dumbbell-curl", "hammer-curl"], variantMode: "alternate", weightGrams: 7_500, sets: [{ reps: 10 }, { reps: 10 }, { reps: 7 }] },
        { slotId: "slot-triceps", exerciseKeys: ["overhead-triceps-extension"], variantMode: "fixed", weightGrams: 10_000, sets: [{ reps: 10 }, { reps: 10 }, { reps: 10 }] },
        { slotId: "slot-lateral", exerciseKeys: ["lateral-raise"], variantMode: "fixed", weightGrams: 2_500, sets: [{ reps: 12 }, { reps: 12 }, { reps: 12 }] },
        { slotId: "slot-leg-raise", exerciseKeys: ["lying-leg-raise"], variantMode: "fixed", weightGrams: 0, sets: [{ reps: 15 }, { reps: 15 }, { reps: 15 }] },
      ],
    };
    const migrated = applyAbSplitPlan(legacy);
    expect(migrated.changed).toBe(true);
    expect(migrated.snapshot.exercises.map((item) => item.slotId)).toEqual([
      "slot-bench", "slot-row", "slot-shoulder", "slot-leg-raise", "slot-squat", "slot-curl",
    ]);
    expect(migrated.snapshot.exercises.find((item) => item.slotId === "slot-squat")).toMatchObject({
      day: "B", weightGrams: 20_000, sets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }],
    });
    expect(migrated.snapshot.exercises.find((item) => item.slotId === "slot-bench")?.weightGrams).toBe(12_500);
    expect(migrated.snapshot.exercises.find((item) => item.slotId === "slot-curl")?.weightGrams).toBe(7_500);
    expect(migrated.snapshot.goal).toContain("Tag A/B");
    expect(applyAbSplitPlan(migrated.snapshot).changed).toBe(false);
  });
});
