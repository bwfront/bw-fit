import { describe, expect, it } from "vitest";
import { hasLocalExerciseVideo, localVideoDemoSlugs } from "@/lib/media";
import { exercises } from "@/lib/seed";

describe("Übungs-Demonstrationsvideos", () => {
  it("stellt für jede Übung des Plans ein lokales Video bereit", () => {
    expect(localVideoDemoSlugs).toHaveLength(exercises.length);
    for (const exercise of exercises) {
      expect(hasLocalExerciseVideo(exercise.demoSlug)).toBe(true);
    }
  });
});
