"use client";

import { Check, Download, Smartphone } from "lucide-react";
import { useState } from "react";
import { usePwa } from "@/components/pwa-provider";

export function PwaInstallCard() {
  const { canInstall, install, isInstalled, isIos } = usePwa();
  const [dismissed, setDismissed] = useState(false);
  const [pending, setPending] = useState(false);

  async function installApp() {
    setPending(true);
    const outcome = await install();
    setDismissed(outcome === "dismissed");
    setPending(false);
  }

  return (
    <section className="card settings-section install-card" aria-labelledby="install-app-title">
      <div className="settings-heading">
        <Smartphone size={20} />
        <div><h2 id="install-app-title">App</h2><p>Ohne Browserleiste starten</p></div>
      </div>
      {isInstalled ? (
        <p className="install-state"><Check size={18} aria-hidden="true" /><span><strong>bw-fit ist als App geöffnet.</strong><small>Interne Seiten bleiben in diesem Fenster.</small></span></p>
      ) : (
        <>
          <p className="install-copy">Installiere bw-fit als App, damit es vom Startbildschirm im eigenen Fenster startet.</p>
          {canInstall && (
            <button className="button primary full" type="button" disabled={pending} onClick={installApp}>
              <Download size={17} aria-hidden="true" />{pending ? "Öffne Installation…" : "bw-fit installieren"}
            </button>
          )}
          {!canInstall && (
            <p className="settings-note install-help">
              {isIos
                ? "Öffne in Safari das Teilen-Menü und wähle „Zum Home-Bildschirm“."
                : "Öffne bw-fit in Chrome über HTTPS und wähle im Browsermenü „App installieren“. Über eine HTTP-/IP-Adresse entsteht nur eine Verknüpfung mit Browserleiste."}
            </p>
          )}
          {dismissed && <p className="form-message" role="status">Installation abgebrochen. Du kannst sie jederzeit erneut über das Browsermenü starten.</p>}
        </>
      )}
    </section>
  );
}
