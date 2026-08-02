"use client";

import { Camera, Check, ImagePlus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addProgressPhotos, deleteProgressPhoto } from "@/lib/actions";
import { prepareProgressPhotos, type PreparedProgressPhoto } from "@/lib/progress-photo-client";
import type { ProgressPhoto } from "@/lib/types";

function formatPhotoDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function ProgressPhotoCapture({ workoutSessionId, existingCount = 0 }: { workoutSessionId?: string; existingCount?: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [preparing, setPreparing] = useState(false);
  const [items, setItems] = useState<PreparedProgressPhoto[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(existingCount);

  useEffect(() => () => {
    for (const item of items) URL.revokeObjectURL(item.previewUrl);
  }, [items]);

  function clearItems() {
    setItems((current) => {
      for (const item of current) URL.revokeObjectURL(item.previewUrl);
      return [];
    });
  }

  async function onPick(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    setPreparing(true);
    try {
      const prepared = await prepareProgressPhotos(list);
      setItems((current) => {
        for (const item of current) URL.revokeObjectURL(item.previewUrl);
        return prepared;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Fotos konnten nicht vorbereitet werden.");
    } finally {
      setPreparing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeItem(index: number) {
    setItems((current) => {
      const next = [...current];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }

  function save() {
    if (!items.length) {
      setError("Bitte zuerst Fotos wählen.");
      return;
    }
    const data = new FormData();
    for (const item of items) data.append("photos", item.file);
    if (note.trim()) data.set("note", note.trim());
    if (workoutSessionId) data.set("workoutSessionId", workoutSessionId);
    startTransition(async () => {
      try {
        const result = await addProgressPhotos(data);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSavedCount((count) => count + result.count);
        setError(null);
        clearItems();
        setNote("");
        router.refresh();
      } catch {
        setError("Speichern fehlgeschlagen. Bitte erneut versuchen.");
      }
    });
  }

  return (
    <section className="photo-capture card card-pad">
      <div className="photo-capture-head">
        <div>
          <span className="metric-label">Bilderbuch</span>
          <h2>Fortschrittsfotos</h2>
          <p>{savedCount > 0 ? `${savedCount} gespeichert. Weitere Fotos möglich.` : "Ein oder mehrere Fotos für später speichern."}</p>
        </div>
        <Camera size={22} />
      </div>

      {items.length ? (
        <div className="photo-preview-grid">
          {items.map((item, index) => (
            <div className="photo-preview" key={item.previewUrl}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.previewUrl} alt={`Vorschau ${index + 1}`} />
              <button type="button" className="icon-button mini photo-preview-clear" aria-label={`Foto ${index + 1} entfernen`} onClick={() => removeItem(index)}><X size={16} /></button>
            </div>
          ))}
        </div>
      ) : (
        <button type="button" className="photo-pick" disabled={preparing || pending} onClick={() => inputRef.current?.click()}>
          <ImagePlus size={22} />
          <span>{preparing ? "Bereitet vor…" : "Fotos aufnehmen oder wählen"}</span>
        </button>
      )}

      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        onChange={(event) => void onPick(event.target.files)}
      />

      {items.length > 0 && (
        <>
          <div className="photo-capture-actions">
            <button type="button" className="button" disabled={preparing || pending} onClick={() => inputRef.current?.click()}>Weitere wählen</button>
            <button type="button" className="button" disabled={preparing || pending} onClick={clearItems}>Leeren</button>
          </div>
          <label className="photo-note-label">Notiz (optional, für alle)
            <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} placeholder="z. B. Front, Seiten, Licht" />
          </label>
          <button type="button" className="button steel" disabled={pending || preparing} onClick={save}>
            {pending ? "Speichert…" : <><Check size={16} />{items.length === 1 ? "1 Foto speichern" : `${items.length} Fotos speichern`}</>}
          </button>
        </>
      )}

      {error && <p className="photo-error" role="alert">{error}</p>}
      {savedCount > 0 && !items.length && <p className="photo-saved"><Check size={15} />Im Bilderbuch unter Fortschritt</p>}
    </section>
  );
}

export function ProgressPhotoBook({ photos }: { photos: ProgressPhoto[] }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const active = photos.find((photo) => photo.id === activeId) ?? null;
  const activeIndex = active ? photos.findIndex((photo) => photo.id === active.id) : -1;

  function remove(id: string) {
    if (!window.confirm("Dieses Fortschrittsfoto wirklich löschen?")) return;
    startTransition(async () => {
      try {
        const result = await deleteProgressPhoto(id);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setError(null);
        setActiveId(null);
        router.refresh();
      } catch {
        setError("Löschen fehlgeschlagen. Bitte erneut versuchen.");
      }
    });
  }

  if (!photos.length) {
    return <div className="empty-card">Nach dem Training kannst du Fotos speichern. Hier entsteht dann dein Bilderbuch.</div>;
  }

  return (
    <>
      {error && <p className="photo-error" role="alert">{error}</p>}
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
                <span className="eyebrow">Fortschrittsfoto {activeIndex + 1}/{photos.length}</span>
                <h2>{formatPhotoDate(active.capturedAt)}</h2>
                {active.note && <p>{active.note}</p>}
              </div>
              <button type="button" className="icon-button" aria-label="Schließen" onClick={() => setActiveId(null)}><X size={20} /></button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/progress-photos/${active.id}`} alt={`Fortschrittsfoto vom ${formatPhotoDate(active.capturedAt)}`} />
            <div className="photo-dialog-nav">
              <button type="button" className="button" disabled={activeIndex <= 0} onClick={() => setActiveId(photos[activeIndex - 1]?.id ?? null)}>Zurück</button>
              <button type="button" className="button" disabled={activeIndex >= photos.length - 1} onClick={() => setActiveId(photos[activeIndex + 1]?.id ?? null)}>Weiter</button>
            </div>
            {error && <p className="photo-error" role="alert">{error}</p>}
            <button type="button" className="button" disabled={pending} onClick={() => remove(active.id)}>
              <Trash2 size={16} />{pending ? "Löscht…" : "Foto löschen"}
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
