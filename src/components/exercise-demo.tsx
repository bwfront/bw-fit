"use client";

import { Info, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { hasCodeNativeExerciseDiagram, hasLocalExerciseVideo } from "@/lib/media";
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

  if (hasCodeNativeExerciseDiagram(slug)) return <ExerciseDiagram slug={slug} />;

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

const diagramNames = {
  "goblet-squat": "Goblet Squat: aufrecht stehen und mit der Hantel vor der Brust tief in die Kniebeuge gehen",
  "bent-over-row": "Vorgebeugtes Rudern: mit neutralem Rücken die Hanteln aus gestreckten Armen zu den Rippen ziehen",
  "lying-leg-raise": "Beinheben im Liegen: gestreckte Beine vom Boden bis über die Hüfte anheben",
} as const;

type DiagramSlug = keyof typeof diagramNames;

function Dumbbell({ x, y, rotate = 0 }: { x: number; y: number; rotate?: number }) {
  return (
    <g className="diagram-weight" transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect x="-10" y="-3" width="20" height="6" rx="3" />
      <rect x="-15" y="-7" width="6" height="14" rx="2" />
      <rect x="9" y="-7" width="6" height="14" rx="2" />
    </g>
  );
}

function GobletSquatDiagram() {
  return (
    <>
      <g className="diagram-person">
        <circle cx="98" cy="34" r="13" />
        <path d="M98 49 L98 116 M98 61 L82 78 L95 86 M98 61 L114 78 L101 86 M98 116 L78 158 L73 202 M98 116 L119 158 L124 202" />
        <Dumbbell x={98} y={86} rotate={90} />
      </g>
      <g className="diagram-person">
        <circle cx="322" cy="55" r="13" />
        <path d="M322 70 L316 133 M320 82 L302 98 L314 106 M320 82 L338 98 L318 106 M316 133 L277 151 L274 201 M316 133 L355 151 L358 201" />
        <Dumbbell x={317} y={106} rotate={90} />
      </g>
    </>
  );
}

function BentOverRowDiagram() {
  return (
    <>
      <g className="diagram-person">
        <circle cx="132" cy="61" r="13" />
        <path d="M120 76 L76 124 M76 124 L92 162 L106 202 M76 124 L57 163 L46 202 M113 84 L130 122 L130 164" />
        <Dumbbell x={130} y={171} />
      </g>
      <g className="diagram-person">
        <circle cx="356" cy="61" r="13" />
        <path d="M344 76 L300 124 M300 124 L316 162 L330 202 M300 124 L281 163 L270 202 M337 84 L312 104 L328 139" />
        <Dumbbell x={331} y={146} rotate={74} />
      </g>
    </>
  );
}

function LyingLegRaiseDiagram() {
  return (
    <>
      <g className="diagram-person">
        <circle cx="38" cy="151" r="13" />
        <path d="M52 158 L126 158 L184 158 L203 158 M63 161 L116 177" />
      </g>
      <g className="diagram-person">
        <circle cx="250" cy="151" r="13" />
        <path d="M264 158 L322 158 L322 99 L322 57 M275 161 L316 177" />
      </g>
      <path className="diagram-core" d="M86 158 L126 158 M282 158 L322 158" />
    </>
  );
}

export function ExerciseDiagram({ slug }: { slug: string }) {
  if (!hasCodeNativeExerciseDiagram(slug)) return null;
  const diagramSlug = slug as DiagramSlug;
  return (
    <div className="exercise-diagram" data-exercise={diagramSlug} role="img" aria-label={diagramNames[diagramSlug]}>
      <svg viewBox="0 0 420 220" aria-hidden="true" focusable="false">
        <path className="diagram-floor" d={diagramSlug === "lying-leg-raise" ? "M20 184 H200 M220 184 H400" : "M20 205 H200 M220 205 H400"} />
        {diagramSlug === "goblet-squat" && <GobletSquatDiagram />}
        {diagramSlug === "bent-over-row" && <BentOverRowDiagram />}
        {diagramSlug === "lying-leg-raise" && <LyingLegRaiseDiagram />}
        <path className="diagram-arrow" d="M193 108 H227 M219 100 L227 108 L219 116" />
      </svg>
      <span className="diagram-label">START</span><span className="diagram-label end">ENDE</span>
    </div>
  );
}
