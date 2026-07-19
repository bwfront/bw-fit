# Kraftbuch

Kraftbuch ist ein privates, mobiloptimiertes Trainingsprotokoll für einen einzigen Besitzer. Es speichert Planversionen, Trainings, Sätze, Körpergewicht und Fortschritt lokal in SQLite.

## Start auf Proxmox

Voraussetzungen: eine Linux-VM oder ein unprivilegierter LXC mit Docker Engine und Docker Compose. Eine kleine VM ist meist unkomplizierter als Docker direkt auf dem Proxmox-Host.

```bash
git clone https://github.com/bwfront/bw-fit.git
cd bw-fit
cp .env.example .env
openssl rand -base64 32
```

Den erzeugten Wert als `BETTER_AUTH_SECRET` in `.env` eintragen und `BETTER_AUTH_URL` auf die LAN- oder HTTPS-Adresse setzen. Danach:

```bash
docker compose up -d --build
docker compose ps
```

Beim ersten Öffnen erscheint die einmalige Einrichtung. Nach dem ersten Benutzer ist die Registrierung dauerhaft geschlossen.

## Reverse Proxy und HTTPS

Der Container liefert HTTP auf Port 3000. Für HTTPS Caddy, Traefik oder nginx davorschalten und `BETTER_AUTH_URL` exakt auf die externe `https://`-Adresse setzen. Den Port nur im LAN oder VPN freigeben.

## Aktualisieren

```bash
git pull --ff-only
docker compose up -d --build
docker image prune
```

Versionierte, idempotente Datenbankmigrationen und Seed-Daten laufen beim Containerstart. `docker compose up -d --build` ist damit zugleich der Update- und Migrationsbefehl; bestehende Trainings- und Planwerte werden nicht überschrieben. Der Status lässt sich danach mit `docker compose ps` und `curl http://127.0.0.1:${APP_PORT:-3000}/api/health` prüfen.

## Sicherung

Die App kann unter **Einstellungen → Daten** eine versionierte JSON-Sicherung exportieren und wieder importieren. Vor einem Import entsteht automatisch eine weitere JSON-Sicherung im Backup-Volume. Für eine vollständige SQLite-Sicherung zuerst kurz den Container stoppen und das benannte Daten-Volume sichern:

```bash
docker compose stop kraftbuch
mkdir -p backups
docker run --rm -v bw-fit_kraftbuch-data:/source -v "$PWD/backups:/backup" alpine tar czf /backup/kraftbuch-data.tgz -C /source .
docker compose start kraftbuch
```

Wiederherstellung aus dieser Sicherung (ersetzt den aktuellen Datenbestand):

```bash
docker compose stop kraftbuch
docker run --rm -v bw-fit_kraftbuch-data:/target -v "$PWD/backups:/backup:ro" alpine sh -c 'rm -f /target/kraftbuch.sqlite /target/kraftbuch.sqlite-shm /target/kraftbuch.sqlite-wal && tar xzf /backup/kraftbuch-data.tgz -C /target'
docker compose start kraftbuch
curl http://127.0.0.1:${APP_PORT:-3000}/api/health
```

Alternativ beide Docker-Volumes (`kraftbuch-data` und `kraftbuch-backups`) in die reguläre Proxmox-VM-Sicherung aufnehmen. Der Compose-Projektpräfix `bw-fit_` hängt vom Verzeichnisnamen ab; `docker volume ls` zeigt die tatsächlichen Namen.

## Lokal entwickeln und prüfen

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

Die Datenbank liegt lokal unter `data/kraftbuch.sqlite`. Für einen frischen Entwicklungsstart kann diese Datei bei gestopptem Dev-Server entfernt werden.

## Datenkonventionen

- Gewichte sind das Gesamtgewicht **einer** Kurzhantel.
- Das Trainingsvolumen berücksichtigt, ob eine oder zwei Hanteln verwendet werden.
- Planänderungen erzeugen unveränderliche Versionen; eine Wiederherstellung erzeugt wiederum eine neue Version.
- Varianten wechseln erst nach einer abgeschlossenen Einheit.
