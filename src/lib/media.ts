export const localVideoDemoSlugs = [
  "flat-bench-press",
  "incline-bench-press",
  "seated-shoulder-press",
  "dumbbell-curl",
  "hammer-curl",
  "overhead-triceps-extension",
  "lateral-raise",
  "goblet-squat",
  "bent-over-row",
  "lying-leg-raise",
] as const;

const localVideoDemos = new Set<string>(localVideoDemoSlugs);

export function hasLocalExerciseVideo(slug: string) {
  return localVideoDemos.has(slug);
}
