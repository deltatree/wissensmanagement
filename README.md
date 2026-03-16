# wissensmanagement

## Azure OpenAI Confluence Prototype

Die Datei `index.html` ist ein reiner HTML+JavaScript Prototyp fuer einen Chat gegen einen Azure OpenAI Endpoint.

### Start lokal

1. Datei `index.html` im Browser oeffnen.
2. Konfigurieren:
   - Endpoint, z. B. `https://<resource>.openai.azure.com`
   - Model/Deployment
   - API-Key
   - API-Modus (`v1` oder `deployment`)
3. Nachricht eingeben und senden.

### Confluence Durchstich

- Wenn JavaScript in deiner Confluence-Instanz im HTML-Makro erlaubt ist: Inhalt aus `index.html` einbetten.
- Wenn JavaScript blockiert ist (haeufig in Confluence Cloud): `index.html` extern hosten und per IFrame einbinden.

### Wichtiger Hinweis

Der Prototyp sendet den API-Key direkt aus dem Browser. Das ist nur fuer Testzwecke geeignet, nicht fuer Produktion.
