import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calculateVolume, diffPlans, eligibleForProgression, formatKg, resolveVariant } from "@/lib/domain";
import { localVideoDemoSlugs } from "@/lib/media";
import { initialPlan } from "@/lib/seed";
import type { WorkoutExercise } from "@/lib/types";

describe("Gewichte und Volumen", () => {
  it("formatiert das Gewicht einer Hantel deutsch", () => {
    expect(formatKg(17_500)).toBe("17,5 kg");
    expect(formatKg(0)).toBe("Körpergewicht");
  });

  it("multipliziert das Volumen mit der verwendeten Hantelanzahl", () => {
    expect(calculateVolume("flat-bench-press", 10_000, 12)).toBe(240_000);
    expect(calculateVolume("goblet-squat", 17_500, 10)).toBe(175_000);
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

describe("Plan-Historie", () => {
  it("beschreibt Gewichts- und Wiederholungsänderungen", () => {
    const next = structuredClone(initialPlan);
    next.exercises[0].weightGrams = 20_000;
    next.exercises[0].sets = [{ reps: 12 }, { reps: 12 }, { reps: 12 }];
    const diff = diffPlans(initialPlan, next);
    expect(diff[0].changes).toContain("17,5 kg → 20 kg");
    expect(diff[0].changes).toContain("10/10/10 → 12/12/12 Wdh.");
  });

  it("enthält die acht vereinbarten Planpositionen", () => {
    expect(initialPlan.exercises).toHaveLength(8);
    expect(initialPlan.exercises.at(-1)?.exerciseKeys).toEqual(["lying-leg-raise"]);
    expect(initialPlan.exercises.at(-1)?.sets.every((set) => set.reps === null)).toBe(true);
  });
});

describe("Übungsmedien", () => {
  it("liefert für jede Übungsvariante ein lokales Video oder Bewegungsdiagramm", () => {
    const manifest = JSON.parse(readFileSync(resolve("public/media/ATTRIBUTION.json"), "utf8")) as {
      assets: Array<{ slug: string; file: string }>;
      codeNativeFallbacks: string[];
    };
    expect(manifest.assets.map((asset) => asset.slug).sort()).toEqual([...localVideoDemoSlugs].sort());
    for (const asset of manifest.assets) {
      expect(existsSync(resolve("public", asset.file.replace(/^\//, "")))).toBe(true);
    }
    const available = new Set([...manifest.assets.map((asset) => asset.slug), ...manifest.codeNativeFallbacks]);
    expect(Object.values(initialPlan.exercises).flatMap((entry) => entry.exerciseKeys).every((key) => available.has(key))).toBe(true);
  });
});
