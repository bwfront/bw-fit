import { ArrowRight, Check, History, Play, TrendingUp } from "lucide-react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { applySuggestion, dismissSuggestion, startWorkout } from "@/lib/actions";
import { formatExerciseLoad, formatKg, resolveVariant } from "@/lib/domain";
import { getActivePlan, getActiveWorkout, getBodyWeights, getCompletedWorkoutCount, getPendingSuggestions, getRecentWorkouts, getSettings } from "@/lib/data";
import { exerciseMap } from "@/lib/seed";

function germanDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short" }).format(new Date(value));
}

export default function TodayPage() {
  const plan = getActivePlan();
  const activeWorkout = getActiveWorkout();
  const count = getCompletedWorkoutCount();
  const recent = getRecentWorkouts(1)[0];
  const weights = getBodyWeights(1);
  const settings = getSettings();
  const suggestions = getPendingSuggestions();
  const nextVariants = plan.snapshot.exercises.filter((item) => item.variantMode === "alternate").map((item) => exerciseMap.get(resolveVariant(item.exerciseKeys, count))?.shortName).filter(Boolean);
  const latestWeight = weights[0]?.weightGrams;
  const goalProgress = latestWeight ? Math.min(100, Math.round((latestWeight / settings.targetWeightGrams) * 100)) : 0;

  return (
    <>
      <AppHeader />
      <main>
        <p className="eyebrow">Sonntag · Trainingszyklus {String(count + 1).padStart(2, "0")}</p>
        <section className="hero-workout">
          <div className="hero-top"><span className="status-tag">{activeWorkout ? "Training läuft" : "Plan bereit"}</span><span className="hero-count">8 Übungen</span></div>
          <h1>{activeWorkout ? "Training fortsetzen" : "Heutiges Training"}</h1>
          <p className="variant">Heute: {nextVariants.join(" · ")}</p>
          <div className="hero-actions">
            {activeWorkout ? (
              <Link className="button resume" href={`/training/${activeWorkout.id}`}><Play size={18} fill="currentColor" />Fortsetzen</Link>
            ) : (
              <form action={startWorkout}><button className="button resume" type="submit"><Play size={18} fill="currentColor" />Training starten</button></form>
            )}
          </div>
        </section>

        <div className="metric-grid">
          <section className="card metric-card">
            <span className="metric-label">Körpergewicht</span>
            <div className="metric-value">{latestWeight ? formatKg(latestWeight) : "Noch offen"}</div>
            <p className="metric-sub">Ziel {formatKg(settings.targetWeightGrams)} · 19.07.27</p>
            <div className="goal-track" aria-label={`${goalProgress} Prozent des Zielgewichts`}><span style={{ width: `${goalProgress}%` }} /></div>
          </section>
          <section className="card metric-card orange">
            <span className="metric-label">Letzter Eintrag</span>
            <div className="metric-value">{recent ? germanDate(recent.completedAt ?? recent.startedAt) : "–"}</div>
            <p className="metric-sub">{recent ? `${(recent.totalVolumeGrams / 1_000_000).toFixed(1)} t Volumen` : "Noch kein Training gespeichert"}</p>
          </section>
        </div>

        {suggestions.length > 0 && <>
          <div className="section-head"><h2 className="section-title">Nächster Schritt</h2><TrendingUp size={20} /></div>
          <div className="list-stack">{suggestions.slice(0, 2).map((suggestion) => (
            <article className="card suggestion" key={suggestion.id}>
              <div><strong>{exerciseMap.get(suggestion.exerciseKey)?.shortName}</strong><p>Ziel erreicht: {formatExerciseLoad(suggestion.exerciseKey, suggestion.fromWeightGrams)} → {formatExerciseLoad(suggestion.exerciseKey, suggestion.toWeightGrams)}</p></div>
              <div className="suggestion-actions">
                <form action={applySuggestion.bind(null, suggestion.id)}><button className="button small steel"><Check size={15} />Übernehmen</button></form>
                <form action={dismissSuggestion.bind(null, suggestion.id)}><button className="button small">Später</button></form>
              </div>
            </article>
          ))}</div>
        </>}

        <div className="section-head"><h2 className="section-title">Dein Plan</h2><Link href="/plan">Bearbeiten <ArrowRight size={14} /></Link></div>
        <section className="card card-pad plan-glance">
          <div><span className="pill"><History size={12} />Version {plan.id.slice(0, 7)}</span><h3>{plan.snapshot.name}</h3><p>{plan.snapshot.goal}</p></div>
          <div className="plan-sequence">{plan.snapshot.exercises.map((item, index) => <span key={item.slotId}>{String(index + 1).padStart(2, "0")}</span>)}</div>
        </section>
      </main>
    </>
  );
}
