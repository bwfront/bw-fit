import { ArrowDown, ArrowUp, GitCommitHorizontal, Repeat2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { ExerciseDemoButton } from "@/components/exercise-demo";
import { SubmitButton } from "@/components/submit-button";
import { movePlanSlot, updatePlanSlot } from "@/lib/actions";
import { formatExerciseLoad } from "@/lib/domain";
import { getActivePlan } from "@/lib/data";
import { exerciseMap } from "@/lib/seed";

export default function PlanPage() {
  const plan = getActivePlan();
  return (
    <>
      <AppHeader title="Plan" />
      <main>
        <p className="eyebrow">Aktive Version · {plan.id.slice(0, 7)}</p>
        <h1 className="page-title">Trainingsplan</h1>
        <section className="plan-intro card card-pad"><div><span className="pill"><GitCommitHorizontal size={12} />{plan.message}</span><h2>{plan.snapshot.name}</h2><p>{plan.snapshot.goal}</p></div><div className="plan-count">{plan.snapshot.exercises.length}<span>Übungen</span></div></section>
        <div className="plan-list">
          {plan.snapshot.exercises.map((item, index) => {
            const variants = item.exerciseKeys.map((key) => exerciseMap.get(key)).filter(Boolean);
            const exercise = variants[0]!;
            return (
              <article className="card plan-item" key={item.slotId}>
                <div className="plan-number">{String(index + 1).padStart(2, "0")}</div>
                <div className="plan-item-main">
                  <div className="plan-item-head"><div><h3>{exercise.name}</h3>{item.variantMode === "alternate" && <span className="variant-line"><Repeat2 size={13} />Wechselt mit {variants[1]?.shortName}</span>}</div><ExerciseDemoButton exercise={exercise} /></div>
                  <form action={updatePlanSlot} className="plan-edit-form">
                    <input type="hidden" name="slotId" value={item.slotId} />
                    <label>{exercise.dumbbellCount === 0 ? "Externes Gewicht" : "Scheiben je Hantel (+ 2,5 kg Stange)"}<input name="weightKg" type="number" step="0.5" min="0" defaultValue={item.weightGrams / 1000} readOnly={exercise.dumbbellCount === 0} aria-label={`Scheibengewicht für ${exercise.shortName}`} /></label>
                    <label>Wiederholungen<input name="reps" defaultValue={item.sets.map((set) => set.reps ?? "frei").join("/")} aria-label={`Wiederholungen für ${exercise.shortName}`} /></label>
                    <SubmitButton className="button small steel" pending="Sichere…">Sichern</SubmitButton>
                  </form>
                  <div className="plan-item-foot"><span className="mono">{formatExerciseLoad(exercise.key, item.weightGrams)} · {item.sets.map((set) => set.reps ?? "frei").join(" / ")}</span><div><form action={movePlanSlot.bind(null, item.slotId, -1)}><button className="icon-button mini" disabled={index === 0} aria-label="Nach oben"><ArrowUp size={16} /></button></form><form action={movePlanSlot.bind(null, item.slotId, 1)}><button className="icon-button mini" disabled={index === plan.snapshot.exercises.length - 1} aria-label="Nach unten"><ArrowDown size={16} /></button></form></div></div>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </>
  );
}
