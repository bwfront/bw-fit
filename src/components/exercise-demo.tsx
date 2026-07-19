"use client";

import { Info, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { hasLocalExerciseVideo } from "@/lib/media";
import type { Exercise } from "@/lib/types";

export function ExerciseDemoButton({ exercise }: { exercise: Exercise }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="demo-button" onClick={() => dialog.current?.showModal()}><Info size={15} />Technik</button>
      <dialog ref={dialog} className="demo-dialog" onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
        <div className="demo-sheet">
          <div className="demo-sheet-head"><div><span className="eyebrow">Bewegungsablauf</span><h2>{exercise.shortName}</h2></div><button className="icon-button" onClick={() => dialog.current?.close()} aria-label="Schließen"><X size={20} /></button></div>
          <ExerciseMedia slug={exercise.demoSlug} />
          <ol className="cue-list">{exercise.cues.map((cue) => <li key={cue}>{cue}</li>)}</ol>
          {hasLocalExerciseVideo(exercise.demoSlug) ? (
            <p className="media-credit">Video: <a href="https://wger.de" target="_blank" rel="noreferrer">wger.de</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0/deed.de" target="_blank" rel="noreferrer">CC BY-SA 3.0</a> · lokal gespeichert. Technikhinweise ersetzen keine persönliche Einweisung.</p>
          ) : (
            <p className="media-credit">Lokale Bewegungsillustration · Technikhinweise ersetzen keine persönliche Einweisung.</p>
          )}
        </div>
      </dialog>
    </>
  );
}

function ExerciseMedia({ slug }: { slug: string }) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  if (!hasLocalExerciseVideo(slug) || videoFailed) return <MotionFigure slug={slug} />;

  return (
    <video
      className="exercise-video"
      src={`/media/exercises/${slug}.mp4`}
      autoPlay={!reducedMotion}
      controls={reducedMotion}
      loop
      muted
      playsInline
      preload="metadata"
      aria-label="Lokale Video-Demonstration der Übung"
      onError={() => setVideoFailed(true)}
    />
  );
}

function MotionFigure({ slug }: { slug: string }) {
  return (
    <div className={`motion-demo motion-${slug}`} aria-label="Animierte Übungsdarstellung" role="img">
      <div className="floor-line" />
      <div className="figure">
        <span className="head" />
        <span className="torso" />
        <span className="arm left" /><span className="arm right" />
        <span className="forearm left" /><span className="forearm right" />
        <span className="leg left" /><span className="leg right" />
        <span className="shin left" /><span className="shin right" />
        <span className="weight left" /><span className="weight right" />
      </div>
      <span className="motion-label">START</span><span className="motion-label end">ENDE</span>
    </div>
  );
}
