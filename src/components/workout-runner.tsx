"use client";

import { Check, ChevronLeft, ChevronRight, Clock3, Flag, Minus, Plus, RotateCcw, SkipForward, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ExerciseDemoButton } from "@/components/exercise-demo";
import { cancelWorkout, completeWorkout, saveWorkoutNote, setExerciseSkipped, updateSet, updateSetNote } from "@/lib/actions";
import { formatExerciseLoad, totalExternalLoadGrams } from "@/lib/domain";
import { exerciseMap } from "@/lib/seed";
import type { WorkoutSession } from "@/lib/types";

type Previous = Record<string, { weightGrams: number; reps: number }[]>;
type SetPatch = { weightGrams?: number; reps?: number; completed?: boolean };

export function WorkoutRunner({ initial, restSeconds, previous }: { initial: WorkoutSession; restSeconds: number; previous: Previous }) {
  const [workout, setWorkout] = useState(initial);
  const firstOpen = Math.max(0, workout.exercises.findIndex((entry) => !entry.skipped && entry.sets.some((set) => !set.completed)));
  const [activeIndex, setActiveIndex] = useState(firstOpen);
  const [timer, setTimer] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const item = workout.exercises[activeIndex];
  const exercise = exerciseMap.get(item.exerciseKey)!;
  const activeSet = item.sets.find((set) => !set.completed);
  const completedSets = workout.exercises.flatMap((entry) => entry.sets).filter((set) => set.completed).length;
  const totalSets = workout.exercises.flatMap((entry) => entry.sets).length;
  const completedExerciseSets = item.sets.filter((set) => set.completed).length;
  const hasOpenSets = workout.exercises.some((entry) => !entry.skipped && entry.sets.some((set) => !set.completed));
  const nextOpenExercise = workout.exercises.findIndex((entry, index) => index > activeIndex && !entry.skipped && entry.sets.some((set) => !set.completed));
  const previousExercise = [...workout.exercises].map((_, index) => index).reverse().find((index) => index < activeIndex && !workout.exercises[index].skipped);

  useEffect(() => {
    if (timer === null || timer <= 0) return;
    const interval = window.setInterval(() => setTimer((current) => current === null ? null : Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(interval);
  }, [timer]);

  const formattedTimer = useMemo(() => timer === null ? null : `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, "0")}`, [timer]);

  function moveToNextOpenExercise() {
    const nextIndex = workout.exercises.findIndex((entry, index) => index > activeIndex && !entry.skipped && entry.sets.some((set) => !set.completed));
    if (nextIndex >= 0) setActiveIndex(nextIndex);
  }

  function changeSet(setId: string, patch: SetPatch, startRest = false) {
    let payload: { setId: string; weightKg: number; reps: number; completed: boolean } | null = null;
    setWorkout((current) => ({
      ...current,
      exercises: current.exercises.map((entry) => {
        const currentSet = entry.sets.find((set) => set.id === setId);
        if (!currentSet) return entry;
        const nextSet = { ...currentSet, ...patch };
        payload = { setId, weightKg: nextSet.weightGrams / 1000, reps: nextSet.reps ?? 0, completed: nextSet.completed };
        const propagate = patch.weightGrams !== undefined || patch.reps !== undefined;
        return {
          ...entry,
          sets: entry.sets.map((set) => {
            if (set.id === setId) return nextSet;
            if (!propagate || set.setNumber <= currentSet.setNumber || set.completed) return set;
            return {
              ...set,
              weightGrams: nextSet.weightGrams,
              reps: nextSet.reps,
              targetReps: nextSet.reps,
            };
          }),
        };
      }),
    }));
    window.setTimeout(() => {
      if (payload) startTransition(() => updateSet(payload!));
    }, 0);

    if (!startRest) return;
    setTimer(restSeconds);
    if (!item.sets.some((set) => set.id !== setId && !set.completed)) moveToNextOpenExercise();
  }

  function skip() {
    const nextValue = !item.skipped;
    setWorkout((current) => ({ ...current, exercises: current.exercises.map((entry) => entry.id === item.id ? { ...entry, skipped: nextValue } : entry) }));
    startTransition(() => setExerciseSkipped(item.id, nextValue));
    if (nextValue) moveToNextOpenExercise();
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

        {activeSet && !item.skipped ? (
          <section className="focus-set" aria-labelledby="focus-set-title">
            <div className="focus-set-head"><div><span className="focus-kicker">Nächster Satz</span><h2 id="focus-set-title">Satz {activeSet.setNumber} <span>von {item.sets.length}</span></h2></div><span className="focus-target">{activeSet.targetReps ? `Ziel ${activeSet.targetReps} Wdh.` : "Freie Wiederholungen"}</span></div>
            <div className="focus-controls">
              <div className="focus-control">
                <span> {exercise.dumbbellCount === 0 ? "Widerstand" : "Scheiben je Hantel"}</span>
                {exercise.dumbbellCount === 0 ? <div className="focus-static-value"><b>Körpergewicht</b><small>ohne Zusatzlast</small></div> : <div className="focus-stepper"><button aria-label="Scheibengewicht verringern" onClick={() => changeSet(activeSet.id, { weightGrams: Math.max(0, activeSet.weightGrams - 500) })}><Minus size={20} /></button><div><b className="mono">{activeSet.weightGrams / 1000}</b><small>kg · {totalExternalLoadGrams(item.exerciseKey, activeSet.weightGrams) / 1000} kg ges.</small></div><button aria-label="Scheibengewicht erhöhen" onClick={() => changeSet(activeSet.id, { weightGrams: activeSet.weightGrams + 500 })}><Plus size={20} /></button></div>}
              </div>
              <div className="focus-control">
                <span>Wiederholungen</span>
                <div className="focus-stepper"><button aria-label="Wiederholungen verringern" onClick={() => changeSet(activeSet.id, { reps: Math.max(0, (activeSet.reps ?? 0) - 1) })}><Minus size={20} /></button><div><b className="mono">{activeSet.reps ?? 0}</b><small>{activeSet.targetReps ? `von ${activeSet.targetReps} geplant` : "frei gewählt"}</small></div><button aria-label="Wiederholungen erhöhen" onClick={() => changeSet(activeSet.id, { reps: (activeSet.reps ?? 0) + 1 })}><Plus size={20} /></button></div>
              </div>
            </div>
            <button className="focus-complete" aria-label={`Satz ${activeSet.setNumber} abschließen`} onClick={() => changeSet(activeSet.id, { completed: true }, true)}><Check size={21} strokeWidth={3} />Satz abschließen</button>
            <details className="focus-note" open={Boolean(activeSet.note)}><summary>Notiz{activeSet.note ? " vorhanden" : " hinzufügen"}</summary><input className="set-note" aria-label={`Notiz zu Satz ${activeSet.setNumber}`} defaultValue={activeSet.note ?? ""} maxLength={500} placeholder="Zum Beispiel Technik oder Tagesform" onBlur={(event) => startTransition(() => updateSetNote(activeSet.id, event.target.value))} /></details>
          </section>
        ) : <section className="exercise-finished"><Check size={20} /><div><strong>{item.skipped ? "Übung übersprungen" : "Übung erledigt"}</strong><span>{item.skipped ? "Du kannst sie bei Bedarf wieder aufnehmen." : "Alle Sätze sind gespeichert."}</span></div></section>}

        <section className="set-overview" aria-label="Satzübersicht">
          <div className="set-overview-head"><span>Satzübersicht</span><strong className="mono">{completedExerciseSets}/{item.sets.length}</strong></div>
          <div className={`set-overview-list ${item.skipped ? "is-skipped" : ""}`}>
            {item.sets.map((set) => <article className={`set-overview-row ${set.completed ? "complete" : ""} ${set.id === activeSet?.id ? "current" : ""}`} key={set.id}>
              <span className="set-overview-number">{String(set.setNumber).padStart(2, "0")}</span>
              <div><strong>{exercise.dumbbellCount === 0 ? "Körpergewicht" : `${formatExerciseLoad(item.exerciseKey, set.weightGrams)} · `}{set.reps ?? 0} Wdh.</strong><span>{set.completed ? "Erledigt" : set.id === activeSet?.id ? "Jetzt dran" : `Satz ${set.setNumber} folgt`}</span></div>
              {set.completed ? <button className="overview-reopen" aria-label={`Satz ${set.setNumber} öffnen`} onClick={() => changeSet(set.id, { completed: false })}><RotateCcw size={15} /></button> : <span className="overview-state" aria-hidden="true" />}
              <details className="overview-note" open={Boolean(set.note)}><summary>Notiz{set.note ? " vorhanden" : " hinzufügen"}</summary><input className="set-note" aria-label={`Notiz zu Satz ${set.setNumber}`} defaultValue={set.note ?? ""} maxLength={500} placeholder="Zum Beispiel Technik oder Tagesform" onBlur={(event) => startTransition(() => updateSetNote(set.id, event.target.value))} /></details>
            </article>)}
          </div>
        </section>

        <button className="skip-button" onClick={skip}><SkipForward size={16} />{item.skipped ? "Übung wieder aufnehmen" : "Übung überspringen"}</button>
        <details className="workout-note" open={Boolean(workout.note)}><summary>Trainingsnotiz{workout.note ? " vorhanden" : " hinzufügen"}</summary><label>Notiz zu diesem Training<textarea defaultValue={workout.note ?? ""} onBlur={(event) => startTransition(() => saveWorkoutNote(workout.id, event.target.value))} placeholder="Form, Energie, Besonderheiten" /></label></details>
        <details className="workout-more"><summary>Weitere Aktionen</summary><button type="button" className="cancel-workout" onClick={() => { if (window.confirm("Dieses Training wirklich verwerfen? Die Einheit bleibt als abgebrochen markiert.")) startTransition(() => cancelWorkout(workout.id)); }}>Training verwerfen</button></details>
      </section>

      <footer className="workout-footer">
        <button className="button" onClick={() => previousExercise !== undefined && setActiveIndex(previousExercise)} disabled={previousExercise === undefined}><ChevronLeft size={18} />Zurück</button>
        {hasOpenSets ? <button className="button steel" onClick={() => nextOpenExercise >= 0 && setActiveIndex(nextOpenExercise)} disabled={nextOpenExercise < 0}>Nächste Übung<ChevronRight size={18} /></button> : <form action={completeWorkout.bind(null, workout.id)}><button className="button primary"><Flag size={17} />Abschließen</button></form>}
      </footer>
    </main>
  );
}
