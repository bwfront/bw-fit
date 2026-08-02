import { Activity, CalendarDays, Camera, Flame, Scale, Target, Trophy, TrendingUp } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { ProgressPhotoBook, ProgressPhotoCapture } from "@/components/progress-photos";
import { SubmitButton } from "@/components/submit-button";
import { addBodyWeight } from "@/lib/actions";
import { formatExerciseLoad, formatKg } from "@/lib/domain";
import { getBodyWeights, getExerciseStats, getProgressOverview, getProgressPhotos, getSettings } from "@/lib/data";

function asDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

function fullDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short", year: "numeric" }).format(asDate(value));
}

function compactDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short" }).format(asDate(value));
}

function BodyWeightChart({ weights, targetWeight }: { weights: ReturnType<typeof getProgressOverview>["bodyWeights"]; targetWeight: number }) {
  if (weights.length < 2) return <div className="chart-empty">Trage noch eine zweite Messung ein. Dann zeigt die Kurve deinen Verlauf.</div>;
  const values = [...weights.map((entry) => entry.weightGrams), targetWeight];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1_000);
  const y = (value: number) => 116 - ((value - min) / range) * 88;
  const points = weights.map((entry, index) => `${22 + (index / (weights.length - 1)) * 276},${y(entry.weightGrams)}`).join(" ");
  const latest = weights.at(-1)!;
  const difference = Math.abs(targetWeight - latest.weightGrams);
  return <>
    <svg className="weight-chart" viewBox="0 0 320 140" role="img" aria-label={`Körpergewichtsverlauf mit ${weights.length} Messungen. Letzte Messung ${formatKg(latest.weightGrams)}, Ziel ${formatKg(targetWeight)}.`}>
      <line className="chart-grid-line" x1="22" x2="298" y1="116" y2="116" />
      <line className="chart-target-line" x1="22" x2="298" y1={y(targetWeight)} y2={y(targetWeight)} />
      <polyline className="weight-chart-line" points={points} />
      {weights.map((entry, index) => <circle className="weight-chart-point" key={entry.id} cx={22 + (index / (weights.length - 1)) * 276} cy={y(entry.weightGrams)} r={index === weights.length - 1 ? 4.5 : 3} />)}
      <text className="chart-target-label" x="298" y={Math.max(15, y(targetWeight) - 6)} textAnchor="end">ZIEL</text>
    </svg>
    <div className="chart-caption"><span>{compactDate(weights[0].measuredAt)}</span><strong>{formatKg(latest.weightGrams)}</strong><span>{difference ? `${formatKg(difference)} bis Ziel` : "Ziel erreicht"}</span></div>
  </>;
}

export default function ProgressPage() {
  const weights = getBodyWeights();
  const stats = getExerciseStats();
  const settings = getSettings();
  const progress = getProgressOverview();
  const photos = getProgressPhotos();
  const maxVolume = Math.max(...stats.map((item) => item.totalVolumeGrams), 1);
  const today = progress.days.find((day) => day.isToday)?.date ?? new Date().toISOString().slice(0, 10);
  const volumeWeeks = progress.weeks.slice(-8);
  const maxWeeklyVolume = Math.max(...volumeWeeks.map((week) => week.volumeGrams), 1);
  const goalReached = progress.currentSessions >= progress.weeklyTarget;

  return (
    <>
      <AppHeader title="Fortschritt" />
      <main>
        <p className="eyebrow">Trainingsdaten und Körpergewicht</p>
        <h1 className="page-title">Fortschritt</h1>

        <section className="card training-pulse" aria-labelledby="pulse-title">
          <div className="pulse-head"><div><span className="metric-label">Diese Woche</span><h2 id="pulse-title">Trainingspuls</h2></div><Activity size={21} /></div>
          <div className="pulse-readout"><strong>{progress.currentSessions}<small>/{progress.weeklyTarget}</small></strong><p>{goalReached ? "Wochenziel erreicht" : `${progress.weeklyTarget - progress.currentSessions} Einheit${progress.weeklyTarget - progress.currentSessions === 1 ? "" : "en"} bis zum Ziel`}</p></div>
          <div className="pulse-track" aria-label={`${progress.currentSessions} von ${progress.weeklyTarget} Trainingseinheiten diese Woche`}>
            {Array.from({ length: progress.weeklyTarget }, (_, index) => <span className={index < progress.currentSessions ? "complete" : ""} key={index} />)}
          </div>
          <div className="pulse-foot"><span><Flame size={15} />{progress.streak ? `${progress.streak} Wochen-Serie` : "Starte deine Serie"}</span><span><Target size={15} />Ziel in Einstellungen ändern</span></div>
        </section>

        <div className="progress-summary">
          <section className="card summary-block"><span className="metric-label">Einheiten</span><strong>{progress.completedCount}</strong><span>abgeschlossen</span></section>
          <section className="card summary-block accent"><span className="metric-label">Zielgewicht</span><strong>{formatKg(settings.targetWeightGrams)}</strong><span>bis {fullDate(settings.targetDate)}</span></section>
        </div>

        <div className="section-head"><h2 className="section-title">Bilderbuch</h2><Camera size={20} /></div>
        <ProgressPhotoBook photos={photos} />
        <ProgressPhotoCapture />

        <div className="section-head"><h2 className="section-title">Aktivität</h2><CalendarDays size={20} /></div>
        <section className="card activity-card">
          <div className="chart-title"><div><strong>Letzte 12 Wochen</strong><span>Ein Feld pro Trainingstag</span></div><span className="activity-legend"><i />Training</span></div>
          <div className="activity-grid" role="img" aria-label={`Trainingskalender der letzten 12 Wochen mit ${progress.completedCount} abgeschlossenen Einheiten insgesamt`}>
            {progress.weeks.map((week, weekIndex) => <div className={`activity-week ${week.reachedGoal ? "goal-reached" : ""}`} key={week.weekStart} aria-label={`Woche ab ${compactDate(week.weekStart)}: ${week.sessions} Einheiten${week.reachedGoal ? ", Ziel erreicht" : ""}`}>
              {progress.days.slice(weekIndex * 7, weekIndex * 7 + 7).map((day) => <span className={`activity-day ${day.sessions ? "trained" : ""} ${day.sessions > 1 ? "multiple" : ""} ${day.isToday ? "today" : ""}`} key={day.date} />)}
            </div>)}
          </div>
          <div className="activity-labels" aria-hidden="true"><span>12 Wochen</span><span>heute</span></div>
        </section>

        <div className="section-head"><h2 className="section-title">Wochenvolumen</h2><TrendingUp size={20} /></div>
        <section className="card volume-card">
          <div className="chart-title"><div><strong>Bewegte Last</strong><span>Abgeschlossene Trainings</span></div><strong className="volume-total">{(volumeWeeks.reduce((sum, week) => sum + week.volumeGrams, 0) / 1_000_000).toFixed(1)} t</strong></div>
          <svg className="volume-chart" viewBox="0 0 320 145" role="img" aria-label={`Wochenvolumen der letzten acht Wochen. Höchster Wert ${(maxWeeklyVolume / 1_000_000).toFixed(1)} Tonnen.`}>
            <line className="chart-grid-line" x1="10" x2="310" y1="116" y2="116" />
            {volumeWeeks.map((week, index) => {
              const height = week.volumeGrams ? Math.max(6, (week.volumeGrams / maxWeeklyVolume) * 91) : 2;
              const x = 15 + index * 38;
              return <g key={week.weekStart}><rect className={`volume-bar ${week.isCurrent ? "current" : ""}`} x={x} y={116 - height} width="23" height={height} rx="4" /><text className="volume-label" x={x + 11.5} y="135" textAnchor="middle">{index + 1}</text></g>;
            })}
          </svg>
          <div className="chart-caption"><span>vor 8 Wochen</span><span>aktuelle Woche</span></div>
        </section>

        <div className="section-head"><h2 className="section-title">Körpergewicht</h2><Scale size={20} /></div>
        <section className="card weight-chart-card"><BodyWeightChart weights={progress.bodyWeights} targetWeight={settings.targetWeightGrams} /></section>
        <form action={addBodyWeight} className="card weight-form">
          <label>Gewicht in kg<input name="weightKg" type="number" step="0.1" min="30" max="300" inputMode="decimal" required placeholder="z. B. 74,5" /></label>
          <label>Datum<input name="date" type="date" defaultValue={today} required /></label>
          <label className="span-two">Notiz (optional)<input name="note" maxLength={300} placeholder="Morgens, nüchtern …" /></label>
          <SubmitButton className="button steel span-two">Messung speichern</SubmitButton>
        </form>

        <div className="section-head"><h2 className="section-title">Persönliche Rekorde</h2><Trophy size={20} /></div>
        {progress.records.length ? <div className="record-grid">{progress.records.map((record) => <section className="card record-card" key={record.exerciseKey}><span className="metric-label">PR · {compactDate(record.achievedAt)}</span><strong>{record.name}</strong><span>{formatExerciseLoad(record.exerciseKey, record.weightGrams)}</span></section>)}</div> : <div className="empty-card">Schließe ein Training mit Gewicht ab. Dann erscheinen hier deine Bestwerte.</div>}

        <div className="section-head"><h2 className="section-title">Kraftprofil</h2><Trophy size={20} /></div>
        {stats.length ? <section className="card stats-chart">{stats.map((item) => (
          <div className="stat-row" key={item.exerciseKey}><div className="stat-meta"><strong>{item.name}</strong><span className="mono">PR {formatExerciseLoad(item.exerciseKey, item.maxWeightGrams)}</span></div><div className="stat-bar"><span style={{ width: `${Math.max(5, (item.totalVolumeGrams / maxVolume) * 100)}%` }} /></div><small>{(item.totalVolumeGrams / 1_000_000).toFixed(1)} t · {item.sessions}×</small></div>
        ))}</section> : <div className="empty-card">Schließe dein erstes Training ab. Dann entsteht hier dein Kraftprofil.</div>}

        <div className="weight-ledger">{weights.map((entry) => <div key={entry.id}><time>{fullDate(entry.measuredAt)}</time><strong className="mono">{formatKg(entry.weightGrams)}</strong><span>{entry.note}</span></div>)}</div>
      </main>
    </>
  );
}
