import { ArrowDown, ArrowUp, GitCommitHorizontal, Repeat2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { ExerciseDemoButton } from "@/components/exercise-demo";
import { SubmitButton } from "@/components/submit-button";
import { movePlanSlot, updatePlanSlot } from "@/lib/actions";
import { exercisesForDay, formatExerciseLoad, planHasTrainingDays } from "@/lib/domain";
import { getActivePlan } from "@/lib/data";
import { exerciseMap } from "@/lib/seed";
import type { PlanExercise, TrainingDay } from "@/lib/types";

function PlanSlotCard({ item, index, indexInDay, dayLength }: { item: PlanExercise; index: number; indexInDay: number; dayLength: number }) {
  const variants = item.exerciseKeys.map((key) => exerciseMap.get(key)).filter(Boolean);
  const exercise = variants[0]!;
  return (
    <article className="card plan-item">
      <div className="plan-number">{String(index + 1).padStart(2, "0")}</div>
      <div className="plan-item-main">
        <div className="plan-item-head"><div><h3>{exercise.name}</h3>{item.variantMode === "alternate" && <span className="variant-line"><Repeat2 size={13} />Wechselt mit {variants[1]?.shortName}</span>}</div><ExerciseDemoButton exercise={exercise} /></div>
        <form action={updatePlanSlot} className="plan-edit-form">
          <input type="hidden" name="slotId" value={item.slotId} />
          <label>{exercise.dumbbellCount === 0 ? "Externes Gewicht" : "Scheiben je Hantel (+ 2,5 kg Stange)"}<input name="weightKg" type="number" step="0.5" min="0" defaultValue={item.weightGrams / 1000} readOnly={exercise.dumbbellCount === 0} aria-label={`Scheibengewicht für ${exercise.shortName}`} /></label>
          <label>Wiederholungen<input name="reps" defaultValue={item.sets.map((set) => set.reps ?? "frei").join("/")} aria-label={`Wiederholungen für ${exercise.shortName}`} /></label>
          <SubmitButton className="button small steel" pending="Sichere…">Sichern</SubmitButton>
        </form>
        <div className="plan-item-foot"><span className="mono">{formatExerciseLoad(exercise.key, item.weightGrams)} · {item.sets.map((set) => set.reps ?? "frei").join(" / ")}</span><div><form action={movePlanSlot.bind(null, item.slotId, -1)}><button className="icon-button mini" disabled={indexInDay === 0} aria-label="Nach oben"><ArrowUp size={16} /></button></form><form action={movePlanSlot.bind(null, item.slotId, 1)}><button className="icon-button mini" disabled={indexInDay >= dayLength - 1} aria-label="Nach unten"><ArrowDown size={16} /></button></form></div></div>
      </div>
    </article>
  );
}

export default function PlanPage() {
  const plan = getActivePlan();
  const hasDays = planHasTrainingDays(plan.snapshot);
  const days: TrainingDay[] = ["A", "B"];

  return (
    <>
      <AppHeader title="Plan" />
      <main>
        <p className="eyebrow">Aktive Version · {plan.id.slice(0, 7)}</p>
        <h1 className="page-title">Trainingsplan</h1>
        <section className="plan-intro card card-pad"><div><span className="pill"><GitCommitHorizontal size={12} />{plan.message}</span><h2>{plan.snapshot.name}</h2><p>{plan.snapshot.goal}</p></div><div className="plan-count">{plan.snapshot.exercises.length}<span>Übungen</span></div></section>
        {hasDays ? days.map((day) => {
          const dayExercises = exercisesForDay(plan.snapshot, day);
          return (
            <section className="plan-day" key={day}>
              <div className="section-head"><h2 className="section-title">Tag {day}</h2><span className="plan-day-meta">{dayExercises.length} Übungen</span></div>
              <div className="plan-list">
                {dayExercises.map((item, indexInDay) => {
                  const index = plan.snapshot.exercises.findIndex((entry) => entry.slotId === item.slotId);
                  return <PlanSlotCard dayLength={dayExercises.length} index={index} indexInDay={indexInDay} item={item} key={item.slotId} />;
                })}
              </div>
            </section>
          );
        }) : (
          <div className="plan-list">
            {plan.snapshot.exercises.map((item, index) => (
              <PlanSlotCard dayLength={plan.snapshot.exercises.length} index={index} indexInDay={index} item={item} key={item.slotId} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
