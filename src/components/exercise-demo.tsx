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
          <p className="media-credit">Lokales Creative-Commons-Video · Herkunft, Autor, Lizenz und Bearbeitung sind in <code>public/media/ATTRIBUTION.json</code> dokumentiert. Technikhinweise ersetzen keine persönliche Einweisung.</p>
        </div>
      </dialog>
    </>
  );
}

function ExerciseMedia({ slug }: { slug: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      video.current?.pause();
      return;
    }
    void video.current?.play().catch(() => {
      // Browser may still require an explicit play gesture; native controls remain available.
    });
  }, [reducedMotion]);

  if (!hasLocalExerciseVideo(slug) || videoFailed) {
    return (
      <div className="exercise-media-error" role="status">
        <Info aria-hidden="true" size={22} />
        <p><strong>Demonstration nicht verfügbar</strong><span>Nutze die Technikhinweise unterhalb.</span></p>
      </div>
    );
  }

  return (
    <video
      ref={video}
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
