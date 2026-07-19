"use client";

import { Check, ChevronLeft, ChevronRight, Clock3, Flag, Minus, Plus, SkipForward, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ExerciseDemoButton } from "@/components/exercise-demo";
import { cancelWorkout, completeWorkout, saveWorkoutNote, setExerciseSkipped, updateSet, updateSetNote } from "@/lib/actions";
import { formatExerciseLoad, totalExternalLoadGrams } from "@/lib/domain";
import { exerciseMap } from "@/lib/seed";
import type { WorkoutSession } from "@/lib/types";

type Previous = Record<string, { weightGrams: number; reps: number }[]>;

export function WorkoutRunner({ initial, restSeconds, previous }: { initial: WorkoutSession; restSeconds: number; previous: Previous }) {
  const [workout, setWorkout] = useState(initial);
  const firstOpen = Math.max(0, workout.exercises.findIndex((item) => !item.skipped && item.sets.some((set) => !set.completed)));
  const [activeIndex, setActiveIndex] = useState(firstOpen);
  const [timer, setTimer] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const item = workout.exercises[activeIndex];
  const exercise = exerciseMap.get(item.exerciseKey)!;
  const activeSetId = item.sets.find((set) => !set.completed)?.id;
  const completedSets = workout.exercises.flatMap((entry) => entry.sets).filter((set) => set.completed).length;
  const totalSets = workout.exercises.flatMap((entry) => entry.sets).length;

  useEffect(() => {
    if (timer === null || timer <= 0) return;
    const interval = window.setInterval(() => setTimer((current) => current === null ? null : Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(interval);
  }, [timer]);

  const formattedTimer = useMemo(() => timer === null ? null : `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, "0")}`, [timer]);

  function changeSet(setId: string, patch: { weightGrams?: number; reps?: number; completed?: boolean }, startRest = false) {
    let payload: { setId: string; weightKg: number; reps: number; completed: boolean } | null = null;
    setWorkout((current) => ({
      ...current,
      exercises: current.exercises.map((entry) => ({
        ...entry,
        sets: entry.sets.map((set) => {
          if (set.id !== setId) return set;
          const next = { ...set, ...patch };
          payload = { setId, weightKg: next.weightGrams / 1000, reps: next.reps ?? 0, completed: next.completed };
          return next;
        }),
      })),
    }));
    window.setTimeout(() => {
      if (payload) startTransition(() => updateSet(payload!));
    }, 0);
    if (startRest) setTimer(restSeconds);
  }

  function skip() {
    const nextValue = !item.skipped;
    setWorkout((current) => ({ ...current, exercises: current.exercises.map((entry) => entry.id === item.id ? { ...entry, skipped: nextValue } : entry) }));
    startTransition(() => setExerciseSkipped(item.id, nextValue));
    if (!nextValue) return;
    setActiveIndex((current) => Math.min(workout.exercises.length - 1, current + 1));
  }

  return (
    <main className="workout-shell">
      <header className="workout-topbar">
        <Link href="/" className="icon-button" aria-label="Training verlassen"><X size={20} /></Link>
        <div><span className="mono">{completedSets}/{totalSets} SÄTZE</span><div className="workout-progress"><span style={{ width: `${(completedSets / totalSets) * 100}%` }} /></div></div>
        <span className={`save-state ${pending ? "saving" : ""}`}>{pending ? "sichert" : "gesichert"}</span>
      </header>

      {timer !== null && <aside className={`rest-timer ${timer === 0 ? "done" : ""}`}><Clock3 size={20} /><div><span>Pause</span><strong className="mono">{formattedTimer}</strong></div><button onClick={() => setTimer(null)}>Beenden</button></aside>}

      <section className="exercise-stage">
        <div className="exercise-index"><span>{String(activeIndex + 1).padStart(2, "0")}</span><i />{String(workout.exercises.length).padStart(2, "0")}</div>
        <div className="exercise-title-row"><div><p className="eyebrow">{exercise.equipment} · {item.skipped ? "Übersprungen" : "Aktiv"}</p><h1>{exercise.name}</h1></div><ExerciseDemoButton exercise={exercise} /></div>
        <p className="previous-line">Zuletzt: {previous[item.exerciseKey]?.length ? previous[item.exerciseKey].map((set) => `${formatExerciseLoad(item.exerciseKey, set.weightGrams)} × ${set.reps}`).join(" · ") : "Noch keine Werte"}</p>

        <div className={`set-stack ${item.skipped ? "is-skipped" : ""}`}>
          <div className="set-labels"><span>Satz</span><span>{exercise.dumbbellCount === 0 ? "Körper" : "Scheiben"}</span><span>Wdh.</span><span>Fertig</span></div>
          {item.sets.map((set) => (
            <div className={`set-row ${set.completed ? "complete" : ""} ${set.id === activeSetId ? "current" : ""}`} key={set.id}>
              <strong className="mono">{String(set.setNumber).padStart(2, "0")}</strong>
              <div className="stepper weight-stepper"><button aria-label="Scheibengewicht verringern" disabled={exercise.dumbbellCount === 0} onClick={() => changeSet(set.id, { weightGrams: Math.max(0, set.weightGrams - 500) })}><Minus size={14} /></button><span><b className="mono">{exercise.dumbbellCount === 0 ? "–" : set.weightGrams / 1000}</b><small>{exercise.dumbbellCount === 0 ? "Körpergewicht" : `kg · ${totalExternalLoadGrams(item.exerciseKey, set.weightGrams) / 1000} ges.`}</small></span><button aria-label="Scheibengewicht erhöhen" disabled={exercise.dumbbellCount === 0} onClick={() => changeSet(set.id, { weightGrams: set.weightGrams + 500 })}><Plus size={14} /></button></div>
              <div className="stepper rep-stepper"><button aria-label="Wiederholungen verringern" onClick={() => changeSet(set.id, { reps: Math.max(0, (set.reps ?? 0) - 1) })}><Minus size={14} /></button><span><b className="mono">{set.reps ?? 0}</b><small>{set.targetReps ? `/${set.targetReps}` : "frei"}</small></span><button aria-label="Wiederholungen erhöhen" onClick={() => changeSet(set.id, { reps: (set.reps ?? 0) + 1 })}><Plus size={14} /></button></div>
              <button className="set-check" aria-label={`Satz ${set.setNumber} ${set.completed ? "öffnen" : "abschließen"}`} aria-pressed={set.completed} onClick={() => changeSet(set.id, { completed: !set.completed }, !set.completed)}><Check size={22} strokeWidth={3} /></button>
              <details className="set-note-details" open={Boolean(set.note)}>
                <summary>Notiz{set.note ? " vorhanden" : " hinzufügen"}</summary>
                <input className="set-note" aria-label={`Notiz zu Satz ${set.setNumber}`} defaultValue={set.note ?? ""} maxLength={500} placeholder="Zum Beispiel Technik oder Tagesform" onBlur={(event) => startTransition(() => updateSetNote(set.id, event.target.value))} />
              </details>
            </div>
          ))}
        </div>

        <button className="skip-button" onClick={skip}><SkipForward size={16} />{item.skipped ? "Übung wieder aufnehmen" : "Übung überspringen"}</button>
        <details className="workout-note" open={Boolean(workout.note)}>
          <summary>Trainingsnotiz{workout.note ? " vorhanden" : " hinzufügen"}</summary>
          <label>Notiz zu diesem Training<textarea defaultValue={workout.note ?? ""} onBlur={(event) => startTransition(() => saveWorkoutNote(workout.id, event.target.value))} placeholder="Form, Energie, Besonderheiten" /></label>
        </details>
        <details className="workout-more">
          <summary>Weitere Aktionen</summary>
          <button type="button" className="cancel-workout" onClick={() => { if (window.confirm("Dieses Training wirklich verwerfen? Die Einheit bleibt als abgebrochen markiert.")) startTransition(() => cancelWorkout(workout.id)); }}>Training verwerfen</button>
        </details>
      </section>

      <footer className="workout-footer">
        <button className="button" onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} disabled={activeIndex === 0}><ChevronLeft size={18} />Zurück</button>
        {activeIndex < workout.exercises.length - 1 ? <button className="button steel" onClick={() => setActiveIndex((index) => Math.min(workout.exercises.length - 1, index + 1))}>Weiter<ChevronRight size={18} /></button> : <form action={completeWorkout.bind(null, workout.id)}><button className="button primary"><Flag size={17} />Abschließen</button></form>}
      </footer>
    </main>
  );
}
