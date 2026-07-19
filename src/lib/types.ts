export type Exercise = {
  id: string;
  key: string;
  name: string;
  shortName: string;
  dumbbellCount: 0 | 1 | 2;
  equipment: "Kurzhantel" | "Körpergewicht";
  demoSlug: string;
  cues: string[];
};

export type PlanSetTarget = {
  reps: number | null;
};

export type PlanExercise = {
  slotId: string;
  exerciseKeys: string[];
  variantMode: "fixed" | "alternate";
  /** Scheibengewicht je Hantel; das Stangengewicht wird separat berechnet. */
  weightGrams: number;
  sets: PlanSetTarget[];
};

export type PlanSnapshot = {
  name: string;
  goal: string;
  exercises: PlanExercise[];
};

export type PlanCommit = {
  id: string;
  parentId: string | null;
  message: string;
  snapshot: PlanSnapshot;
  createdAt: string;
};

export type SetLog = {
  id: string;
  workoutExerciseId: string;
  setNumber: number;
  targetReps: number | null;
  /** Scheibengewicht je Hantel; das Stangengewicht wird separat berechnet. */
  weightGrams: number;
  reps: number | null;
  completed: boolean;
  note: string | null;
};

export type WorkoutExercise = {
  id: string;
  sessionId: string;
  exerciseKey: string;
  slotId: string;
  position: number;
  skipped: boolean;
  sets: SetLog[];
};

export type WorkoutSession = {
  id: string;
  planVersionId: string;
  status: "active" | "completed" | "cancelled";
  startedAt: string;
  completedAt: string | null;
  note: string | null;
  totalVolumeGrams: number;
  exercises: WorkoutExercise[];
};

export type BodyWeightEntry = {
  id: string;
  weightGrams: number;
  measuredAt: string;
  note: string | null;
};

export type ProgressWeek = {
  weekStart: string;
  sessions: number;
  volumeGrams: number;
  reachedGoal: boolean;
  isCurrent: boolean;
};

export type ProgressDay = {
  date: string;
  sessions: number;
  isToday: boolean;
};

export type PersonalRecord = {
  exerciseKey: string;
  name: string;
  weightGrams: number;
  achievedAt: string;
};

export type ProgressOverview = {
  weeklyTarget: number;
  completedCount: number;
  currentSessions: number;
  streak: number;
  weeks: ProgressWeek[];
  days: ProgressDay[];
  bodyWeights: BodyWeightEntry[];
  records: PersonalRecord[];
};

export type ProgressionSuggestion = {
  id: string;
  exerciseKey: string;
  slotId: string;
  fromWeightGrams: number;
  toWeightGrams: number;
  status: "pending" | "applied" | "dismissed";
  createdAt: string;
};

export type PlanDiff = {
  slotId: string;
  exerciseName: string;
  changes: string[];
};
