# wissensmanagement

Browser-first Confluence Topic Knowledge System.

## Was ist geliefert?

Die Anwendung ist jetzt ein durchgaengiger vertikaler Slice fuer kollaboratives Wissensmanagement auf Confluence:

- Topic-zentriertes Modell mit Parent/Child-Hierarchie
- Granularitaetsbewertung inkl. Split-Empfehlungen
- Tag-basiertes Quellseiten-Scoping (leer = aktuelle Seite) und Quellseitenauswahl
- KI-gestuetzte Ableitung von Titel, Summary, Scope und Tags aus gewaehlten Quellseiten
- Similarity-Governance: Merge moeglich oder fachliche Abgrenzung verpflichtend bei hoher Aehnlichkeit
- Confluence als Shared Registry (Import + Sync von Topic-Subpages)
- Semantic Search ueber Topic-Chunks mit nachvollziehbarem Kontext
- Provider-Abstraktion:
  - `local-browser` als Default
  - `azure` als optionale Alternative
- Passwort-geschuetzter, lokal verschluesselter Zustand
- UUID-basierte Confluence-Seitentitel fuer konfliktfreie Speicherung

## Projektstruktur

- `index.html` - UI Shell
- `src/app.js` - App-Orchestrierung
- `src/domain.js` - Fachlogik (Topics, Qualitaet, Chunking)
- `src/retrieval.js` - Suche und Ranking
- `src/crypto-store.js` - verschluesselte Speicherung + Migration
- `src/providers/*` - Provider-Implementierungen
- `src/confluence-service.js` - Confluence-API Integration
- `tests/*.test.mjs` - Unit-Tests
- `_bmad-output/*` - BMAD-Artefakte (Baseline, Domain, Epics/Stories, Architektur, Implementierung)

## Start

1. `index.html` im Browser oeffnen (oder in Confluence als HTML-Makro/iframe hosten).
2. Passwort setzen/entsperren.
3. Unter `AI Provider` den aktiven Provider konfigurieren.
4. Unter `Confluence Registry` Root-Page konfigurieren und als Auth standardmaessig `session` nutzen (Confluence Login-Session).
5. Topics anlegen, bewerten und nach Confluence syncen.
6. Unter `Search & Retrieval` Index aufbauen und suchen.

## Tests

```bash
npm test
```

## Single-File Build fuer Confluence (ohne externe Referenzen)

```bash
npm run build:confluence
```

Ergebnis:
- Output-Datei: `dist/confluence-embed.html`
- Build bricht mit Fehler ab, sobald externe Referenzen erkannt werden

GitHub Actions:
- Workflow: `.github/workflows/build-confluence-single-file.yml`
- Fuehrt Tests + Single-File-Build aus und publiziert das HTML als Artifact

## Hinweise zum Modellbetrieb

- Default ist browser-lokale Inferenz mit konfigurierbaren multilingualen Modellen.
- Azure bleibt als optionaler Provider verfuegbar und wird nur bei Auswahl genutzt.
