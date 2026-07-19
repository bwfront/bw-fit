import { notFound, redirect } from "next/navigation";
import { WorkoutRunner } from "@/components/workout-runner";
import { getPreviousExercisePerformance, getSettings, getWorkoutSession } from "@/lib/data";

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workout = getWorkoutSession(id);
  if (!workout) notFound();
  if (workout.status === "completed") redirect(`/training/${id}/abschluss`);
  if (workout.status === "cancelled") redirect("/");
  const previous = Object.fromEntries(workout.exercises.map((item) => [item.exerciseKey, getPreviousExercisePerformance(item.exerciseKey, workout.startedAt)]));
  return <WorkoutRunner initial={workout} restSeconds={getSettings().restSeconds} previous={previous} />;
}
