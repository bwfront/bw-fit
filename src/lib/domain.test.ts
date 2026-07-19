import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildTrainingPulse, calculateVolume, diffPlans, eligibleForProgression, formatExerciseLoad, formatKg, resolveVariant, totalExternalLoadGrams, visiblePlanVersions } from "@/lib/domain";
import { localVideoDemoSlugs } from "@/lib/media";
import { applyLegRaiseDefault, legacyWeightToPlateWeight, migrateLegacyPlanWeights } from "@/lib/migrations";
import { initialPlan } from "@/lib/seed";
import type { PlanCommit, WorkoutExercise } from "@/lib/types";

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
    next.exercises[0].weightGrams = 20_000;
    next.exercises[0].sets = [{ reps: 12 }, { reps: 12 }, { reps: 12 }];
    const diff = diffPlans(initialPlan, next);
    expect(diff[0].changes).toContain("17,5 kg Scheiben/Hantel · 20 kg gesamt → 20 kg Scheiben/Hantel · 22,5 kg gesamt");
    expect(diff[0].changes).toContain("10/10/10 → 12/12/12 Wdh.");
  });

  it("enthält die acht vereinbarten Planpositionen", () => {
    expect(initialPlan.exercises).toHaveLength(8);
    expect(initialPlan.exercises.at(-1)?.exerciseKeys).toEqual(["lying-leg-raise"]);
    expect(initialPlan.exercises.at(-1)?.sets.map((set) => set.reps)).toEqual([15, 15, 15]);
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
    legacy.exercises.at(-1)!.sets = [{ reps: null }, { reps: null }, { reps: null }];
    expect(applyLegRaiseDefault(legacy).snapshot.exercises.at(-1)?.sets.map((set) => set.reps)).toEqual([15, 15, 15]);

    legacy.exercises.at(-1)!.sets = [{ reps: 12 }, { reps: null }, { reps: null }];
    const customized = applyLegRaiseDefault(legacy);
    expect(customized.changed).toBe(false);
    expect(customized.snapshot.exercises.at(-1)?.sets.map((set) => set.reps)).toEqual([12, null, null]);
  });
});
