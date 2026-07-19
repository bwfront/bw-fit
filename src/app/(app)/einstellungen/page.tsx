import { DatabaseBackup, Download, KeyRound, Palette, SlidersHorizontal, Upload } from "lucide-react";
import { AccountControls } from "@/components/account-controls";
import { AppHeader } from "@/components/app-header";
import { PwaInstallCard } from "@/components/pwa-install-card";
import { SubmitButton } from "@/components/submit-button";
import { ThemePreferenceControl } from "@/components/theme-preference";
import { importBackup, updateSettings } from "@/lib/actions";
import { getSettings } from "@/lib/data";

export default function SettingsPage() {
  const settings = getSettings();
  return (
    <>
      <AppHeader title="Einstellungen" />
      <main>
        <p className="eyebrow">Training und Anzeige</p>
        <h1 className="page-title">Einstellungen</h1>
        <div className="settings-grid">
          <section className="card settings-section">
            <div className="settings-heading"><Palette size={20} /><div><h2>Darstellung</h2><p>Automatisch oder manuell</p></div></div>
            <ThemePreferenceControl />
            <p className="settings-note">„Automatisch“ folgt der Hell-/Dunkel-Einstellung dieses Geräts.</p>
          </section>
          <section className="card settings-section">
            <div className="settings-heading"><SlidersHorizontal size={20} /><div><h2>Training</h2><p>Ziel und Pausenzeit</p></div></div>
            <form action={updateSettings} className="settings-form">
              <label>Zielgewicht in kg<input name="targetWeightKg" type="number" step="0.1" min="30" max="300" defaultValue={settings.targetWeightGrams / 1000} /></label>
              <label>Zieldatum<input name="targetDate" type="date" defaultValue={settings.targetDate} /></label>
              <label>Standardpause in Sekunden<input name="restSeconds" type="number" step="15" min="15" max="600" defaultValue={settings.restSeconds} /></label>
              <SubmitButton className="button steel">Einstellungen speichern</SubmitButton>
            </form>
          </section>
          <section className="card settings-section">
            <div className="settings-heading"><DatabaseBackup size={20} /><div><h2>Daten</h2><p>Portabel und wiederherstellbar</p></div></div>
            <a className="button full" href="/api/export"><Download size={17} />JSON-Sicherung laden</a>
            <form action={importBackup} className="settings-form import-form">
              <label>Sicherung auswählen<input name="backup" type="file" accept="application/json,.json" required /></label>
              <label className="confirm-check"><input type="checkbox" required />Vorhandene Trainingsdaten durch diese Sicherung ersetzen.</label>
              <SubmitButton className="button full" pending="Prüfe und importiere…"><Upload size={17} />Sicherung importieren</SubmitButton>
            </form>
            <p className="settings-note">Vor jedem Import legt bw-fit automatisch eine Sicherung im Backup-Verzeichnis an.</p>
          </section>
          <section className="card settings-section">
            <div className="settings-heading"><KeyRound size={20} /><div><h2>Zugang</h2><p>Nur ein Besitzer</p></div></div>
            <AccountControls />
          </section>
          <PwaInstallCard />
        </div>
        <section className="credits"><strong>Übungsmedien</strong><p>Sieben Übungsvarianten verwenden lokal gespeicherte wger-Videos unter CC BY-SA 3.0. Für Goblet Squat, Rudern und Beinheben stehen lokale Bewegungsdiagramme bereit. Herkunft, Autor, Lizenz und Bearbeitung sind in <code>public/media/ATTRIBUTION.json</code> dokumentiert.</p></section>
      </main>
    </>
  );
}
