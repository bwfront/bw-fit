import { ArrowRight, CheckCircle2, Dumbbell, TimerReset, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRecentWorkouts, getWorkoutSession } from "@/lib/data";

export default async function WorkoutSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workout = getWorkoutSession(id);
  if (!workout) notFound();
  if (workout.status === "active") redirect(`/training/${id}`);
  const completedSets = workout.exercises.flatMap((item) => item.sets).filter((set) => set.completed).length;
  const earlierWorkouts = getRecentWorkouts(500).filter((entry) => entry.id !== workout.id && new Date(entry.startedAt) < new Date(workout.startedAt));
  const previous = earlierWorkouts[0];
  const earlierBest = new Map<string, number>();
  for (const entry of earlierWorkouts) {
    for (const item of entry.exercises) {
      const best = Math.max(0, ...item.sets.filter((set) => set.completed).map((set) => set.weightGrams));
      earlierBest.set(item.exerciseKey, Math.max(earlierBest.get(item.exerciseKey) ?? 0, best));
    }
  }
  const recordCount = workout.exercises.filter((item) => {
    const best = Math.max(0, ...item.sets.filter((set) => set.completed).map((set) => set.weightGrams));
    return best > 0 && best > (earlierBest.get(item.exerciseKey) ?? 0);
  }).length;
  const volumeDelta = previous ? workout.totalVolumeGrams - previous.totalVolumeGrams : null;
  const durationMinutes = Math.max(1, Math.round(((workout.completedAt ? new Date(workout.completedAt).getTime() : Date.now()) - new Date(workout.startedAt).getTime()) / 60_000));
  return (
    <main className="summary-page">
      <div className="summary-check"><CheckCircle2 size={44} /></div>
      <p className="eyebrow">Abgeschlossen</p>
      <h1>Training<br />gespeichert</h1>
      <div className="summary-metrics">
        <div><Dumbbell size={18} /><strong>{(workout.totalVolumeGrams / 1_000_000).toFixed(1)} t</strong><span>Volumen</span></div>
        <div><Trophy size={18} /><strong>{recordCount}</strong><span>Neue Rekorde</span></div>
        <div><TimerReset size={18} /><strong>{durationMinutes}</strong><span>Minuten</span></div>
      </div>
      <p className="summary-comparison">{volumeDelta === null ? `Erste Referenzeinheit · ${completedSets} Sätze` : `${volumeDelta >= 0 ? "+" : ""}${(volumeDelta / 1_000_000).toFixed(1)} t zur letzten Einheit · ${completedSets} Sätze`}</p>
      {workout.note && <blockquote>„{workout.note}“</blockquote>}
      <Link className="button primary full" href="/">Zur Übersicht <ArrowRight size={17} /></Link>
      <Link className="summary-history-link" href="/verlauf">Eintrag im Verlauf ansehen</Link>
    </main>
  );
}
