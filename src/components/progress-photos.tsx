"use client";

import { Camera, Check, ImagePlus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addProgressPhoto, deleteProgressPhoto } from "@/lib/actions";
import type { ProgressPhoto } from "@/lib/types";

function formatPhotoDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function ProgressPhotoCapture({ workoutSessionId, existingCount = 0 }: { workoutSessionId?: string; existingCount?: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(existingCount > 0);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function onPick(next: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setError(null);
    setSaved(false);
    if (!next) {
      setFile(null);
      setPreview(null);
      return;
    }
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  function save() {
    if (!file) {
      setError("Bitte zuerst ein Foto wählen.");
      return;
    }
    const data = new FormData();
    data.set("photo", file);
    if (note.trim()) data.set("note", note.trim());
    if (workoutSessionId) data.set("workoutSessionId", workoutSessionId);
    startTransition(async () => {
      try {
        await addProgressPhoto(data);
        setSaved(true);
        setError(null);
        onPick(null);
        setNote("");
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Foto konnte nicht gespeichert werden.");
      }
    });
  }

  return (
    <section className="photo-capture card card-pad">
      <div className="photo-capture-head">
        <div>
          <span className="metric-label">Bilderbuch</span>
          <h2>Fortschrittsfoto</h2>
          <p>{saved ? "Gespeichert. Du kannst noch ein weiteres Foto hinzufügen." : "Optional ein Foto für später speichern."}</p>
        </div>
        <Camera size={22} />
      </div>

      {preview ? (
        <div className="photo-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Vorschau des Fortschrittsfotos" />
          <button type="button" className="icon-button mini photo-preview-clear" aria-label="Foto verwerfen" onClick={() => onPick(null)}><X size={16} /></button>
        </div>
      ) : (
        <button type="button" className="photo-pick" onClick={() => inputRef.current?.click()}>
          <ImagePlus size={22} />
          <span>Foto aufnehmen oder wählen</span>
        </button>
      )}

      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={(event) => onPick(event.target.files?.[0] ?? null)}
      />

      {file && (
        <>
          <label className="photo-note-label">Notiz (optional)
            <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} placeholder="z. B. Front, Licht, Tagesform" />
          </label>
          <button type="button" className="button steel" disabled={pending} onClick={save}>
            {pending ? "Speichert…" : <><Check size={16} />Im Bilderbuch speichern</>}
          </button>
        </>
      )}

      {error && <p className="photo-error" role="alert">{error}</p>}
      {saved && !file && <p className="photo-saved"><Check size={15} />Im Bilderbuch unter Fortschritt</p>}
    </section>
  );
}

export function ProgressPhotoBook({ photos }: { photos: ProgressPhoto[] }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const active = photos.find((photo) => photo.id === activeId) ?? null;

  function remove(id: string) {
    if (!window.confirm("Dieses Fortschrittsfoto wirklich löschen?")) return;
    startTransition(async () => {
      await deleteProgressPhoto(id);
      setActiveId(null);
      router.refresh();
    });
  }

  if (!photos.length) {
    return <div className="empty-card">Nach dem Training kannst du ein Foto speichern. Hier entsteht dann dein Bilderbuch.</div>;
  }

  return (
    <>
      <div className="photo-book-grid">
        {photos.map((photo) => (
          <button type="button" className="photo-book-tile" key={photo.id} onClick={() => setActiveId(photo.id)} aria-label={`Fortschrittsfoto vom ${formatPhotoDate(photo.capturedAt)}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/progress-photos/${photo.id}`} alt="" loading="lazy" />
            <span>{formatPhotoDate(photo.capturedAt)}</span>
          </button>
        ))}
      </div>

      {active && (
        <dialog className="photo-dialog" open onClick={(event) => { if (event.target === event.currentTarget) setActiveId(null); }}>
          <div className="photo-dialog-sheet">
            <div className="photo-dialog-head">
              <div>
                <span className="eyebrow">Fortschrittsfoto</span>
                <h2>{formatPhotoDate(active.capturedAt)}</h2>
                {active.note && <p>{active.note}</p>}
              </div>
              <button type="button" className="icon-button" aria-label="Schließen" onClick={() => setActiveId(null)}><X size={20} /></button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/progress-photos/${active.id}`} alt={`Fortschrittsfoto vom ${formatPhotoDate(active.capturedAt)}`} />
            <button type="button" className="button" disabled={pending} onClick={() => remove(active.id)}>
              <Trash2 size={16} />{pending ? "Löscht…" : "Foto löschen"}
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
