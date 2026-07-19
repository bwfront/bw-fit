import { Scale, Trophy } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { SubmitButton } from "@/components/submit-button";
import { addBodyWeight } from "@/lib/actions";
import { formatExerciseLoad, formatKg } from "@/lib/domain";
import { getBodyWeights, getExerciseStats, getRecentWorkouts, getSettings } from "@/lib/data";

export default function ProgressPage() {
  const weights = getBodyWeights();
  const stats = getExerciseStats();
  const workouts = getRecentWorkouts(50);
  const settings = getSettings();
  const maxVolume = Math.max(...stats.map((item) => item.totalVolumeGrams), 1);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <AppHeader title="Fortschritt" />
      <main>
        <p className="eyebrow">Trainingsdaten und Körpergewicht</p>
        <h1 className="page-title">Fortschritt</h1>
        <div className="progress-summary">
          <section className="card summary-block"><span className="metric-label">Einheiten</span><strong>{workouts.length}</strong><span>abgeschlossen</span></section>
          <section className="card summary-block accent"><span className="metric-label">Zielgewicht</span><strong>{formatKg(settings.targetWeightGrams)}</strong><span>bis 19.07.27</span></section>
        </div>

        <div className="section-head"><h2 className="section-title">Kraftprofil</h2><Trophy size={20} /></div>
        {stats.length ? <section className="card stats-chart">{stats.map((item) => (
          <div className="stat-row" key={item.exerciseKey}><div className="stat-meta"><strong>{item.name}</strong><span className="mono">PR {formatExerciseLoad(item.exerciseKey, item.maxWeightGrams)}</span></div><div className="stat-bar"><span style={{ width: `${Math.max(5, (item.totalVolumeGrams / maxVolume) * 100)}%` }} /></div><small>{(item.totalVolumeGrams / 1_000_000).toFixed(1)} t · {item.sessions}×</small></div>
        ))}</section> : <div className="empty-card">Schließe dein erstes Training ab. Dann entsteht hier dein Kraftprofil.</div>}

        <div className="section-head"><h2 className="section-title">Körpergewicht</h2><Scale size={20} /></div>
        <form action={addBodyWeight} className="card weight-form">
          <label>Gewicht in kg<input name="weightKg" type="number" step="0.1" min="30" max="300" inputMode="decimal" required placeholder="z. B. 74,5" /></label>
          <label>Datum<input name="date" type="date" defaultValue={today} required /></label>
          <label className="span-two">Notiz (optional)<input name="note" maxLength={300} placeholder="Morgens, nüchtern …" /></label>
          <SubmitButton className="button steel span-two">Messung speichern</SubmitButton>
        </form>
        <div className="weight-ledger">{weights.map((entry) => <div key={entry.id}><time>{new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(entry.measuredAt))}</time><strong className="mono">{formatKg(entry.weightGrams)}</strong><span>{entry.note}</span></div>)}</div>
      </main>
    </>
  );
}
