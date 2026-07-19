import { Settings } from "lucide-react";
import Link from "next/link";

export function AppHeader({ eyebrow = "Persönliches Logbuch", title }: { eyebrow?: string; title?: string }) {
  return (
    <header className="app-header">
      <Link href="/" className="wordmark" aria-label="Kraftbuch Startseite"><span className="wordmark-bar" />KRAFTBUCH</Link>
      <div>
        {title && <div className="header-context"><span>{eyebrow}</span><strong>{title}</strong></div>}
        <Link href="/einstellungen" className="icon-button" aria-label="Einstellungen"><Settings size={21} /></Link>
      </div>
    </header>
  );
}
