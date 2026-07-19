export const localVideoDemoSlugs = [
  "flat-bench-press",
  "incline-bench-press",
  "seated-shoulder-press",
  "dumbbell-curl",
  "hammer-curl",
  "overhead-triceps-extension",
  "lateral-raise",
] as const;

export const codeNativeExerciseDiagramSlugs = [
  "goblet-squat",
  "bent-over-row",
  "lying-leg-raise",
] as const;

const localVideoDemos = new Set<string>(localVideoDemoSlugs);
const codeNativeExerciseDiagrams = new Set<string>(codeNativeExerciseDiagramSlugs);

export function hasLocalExerciseVideo(slug: string) {
  return localVideoDemos.has(slug);
}

export function hasCodeNativeExerciseDiagram(slug: string) {
  return codeNativeExerciseDiagrams.has(slug);
}
