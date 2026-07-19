import { GitCommitHorizontal, RotateCcw, Trophy } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { SubmitButton } from "@/components/submit-button";
import { revertPlan } from "@/lib/actions";
import { diffPlans } from "@/lib/domain";
import { getPlanVersions, getRecentWorkouts } from "@/lib/data";

function fullDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function HistoryPage() {
  const versions = getPlanVersions();
  const workouts = getRecentWorkouts(30);
  const versionMap = new Map(versions.map((version) => [version.id, version]));
  const timeline = [
    ...versions.map((version) => ({ type: "commit" as const, date: version.createdAt, version })),
    ...workouts.map((workout) => ({ type: "workout" as const, date: workout.completedAt ?? workout.startedAt, workout })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      <AppHeader title="Verlauf" />
      <main>
        <p className="eyebrow">Unverlierbar</p>
        <h1 className="page-title">Jeder Satz hat Geschichte.</h1>
        <div className="commit-list">
          {timeline.map((entry) => {
            if (entry.type === "workout") return (
              <article className="commit-item workout" key={`workout-${entry.workout.id}`}>
                <span className="commit-dot" /><time className="commit-date">{fullDate(entry.date)}</time>
                <div className="card commit-card"><span className="pill"><Trophy size={12} />Training</span><h3>Einheit abgeschlossen</h3><p>{entry.workout.exercises.filter((item) => !item.skipped).length} Übungen · {(entry.workout.totalVolumeGrams / 1_000_000).toFixed(1)} t Volumen</p></div>
              </article>
            );
            const parent = entry.version.parentId ? versionMap.get(entry.version.parentId) : undefined;
            const diffs = parent ? diffPlans(parent.snapshot, entry.version.snapshot) : [];
            return (
              <article className="commit-item" key={`commit-${entry.version.id}`}>
                <span className="commit-dot" /><time className="commit-date">{fullDate(entry.date)}</time>
                <div className="card commit-card">
                  <span className="pill"><GitCommitHorizontal size={12} />{entry.version.id.slice(0, 7)}</span>
                  <h3>{entry.version.message}</h3>
                  {diffs.length ? diffs.map((diff) => <div className="diff-row" key={`${entry.version.id}-${diff.slotId}`}><span>{diff.exerciseName}</span><code>{diff.changes.join(" · ")}</code></div>) : <p>Ausgangspunkt für deinen Trainingsplan.</p>}
                  {entry !== timeline[0] && <form action={revertPlan.bind(null, entry.version.id)} className="commit-action"><SubmitButton pending="Stelle wieder her…" className="button small"><RotateCcw size={14} />Diese Version nutzen</SubmitButton></form>}
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </>
  );
}
