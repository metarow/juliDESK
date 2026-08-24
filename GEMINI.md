# juliDESK - Projektkontext & Entwicklungsrichtlinien

## 1. Projektübersicht
**juliDESK** ist eine schlanke, native Desktop-Anwendung, die **JupyterLite** (eine im Browser via WebAssembly/Pyodide laufende JupyterLab-Umgebung) über **Tauri v2** kapselt.

* **Hauptziel:** Eine sofort einsatzbereite Jupyter-Notebook-Umgebung als native Desktop-App bereitstellen – ohne die Notwendigkeit eines lokalen Python-Server-Prozesses oder der Ressourcenlast von Electron.
* **Architektur:**
  * **Frontend & Execution:** JupyterLite (JupyterLab UI) + Pyodide Kernel (Python-Ausführung in WebAssembly direkt in der WebView).
  * **Desktop Shell & Backend:** Rust + Tauri v2 (Fenstermanagement, native Integration, Dateisystem-Brücke, Multiplattform-Packaging).
  * **Asset & Python-Management:** `uv` für Python-Abhängigkeiten und das Generieren der statischen JupyterLite-Assets.

---

## 2. Verzeichnisstruktur

```text
juliDESK/
├── GEMINI.md                      # Zentrale Wissensbasis & Projektkontext für agy
├── README.md                      # Allgemeine Projektinformationen
├── .gitignore                     # Git-Ignore-Regeln für Rust, Python, OS
├── src/                           # JupyterLite Build- & Konfigurationsbereich
│   ├── pyproject.toml             # Python-Abhängigkeiten (jupyterlite-core, jupyterlite-pyodide-kernel)
│   ├── uv.lock                    # uv Lockfile
│   └── _output/                   # Kompilierte statische JupyterLite-Web-Assets (frontendDist)
│       ├── index.html             # Einstiegspunkt für die Webview
│       ├── jupyter-lite.json      # Konfiguration von JupyterLite & Pyodide
│       ├── lab/                   # Vollständige JupyterLab-Oberfläche
│       └── extensions/            # Pyodide Kernel & Erweiterungen
└── src-tauri/                     # Tauri Desktop-Applikation (Rust)
    ├── Cargo.toml                 # Rust Manifest (Tauri 2, tauri-plugin-opener, serde)
    ├── Cargo.lock                 # Rust Lockfile
    ├── tauri.conf.json            # Tauri-Konfiguration (frontendDist -> ../src/_output)
    ├── capabilities/              # Tauri 2 Permission- & Security-Manifeste
    ├── icons/                     # Desktop-Icons für Windows/macOS/Linux
    └── src/
        ├── main.rs                # App-Einstiegspunkt
        └── lib.rs                 # Tauri-Initialisierung & Command-Handler
```

---

## 3. Wichtige Befehle (Workflow & Build)

### A. JupyterLite Assets neu bauen (Python / uv)
Wenn neue JupyterLab-Erweiterungen oder Pakete zu JupyterLite hinzugefügt werden:
```powershell
cd src
uv run jupyter lite build --output-dir _output
```

### B. Tauri Entwicklungsmodus starten
```powershell
cd src-tauri
cargo tauri dev
```

### C. Release-Build & Installer erzeugen
```powershell
cd src-tauri
cargo tauri build
```
*Erzeugte Artefakte liegen unter `src-tauri/target/release/` (Standalone `julidesk.exe`) bzw. `src-tauri/target/release/bundle/` (NSIS / MSI Installer).*

---

## 4. Aktueller Entwicklungsstand & Roadmap

### Bereits umgesetzt:
- [x] Initiales Tauri-2-Gerüst mit statischer Einbindung von JupyterLite (`frontendDist: "../src/_output"`).
- [x] Aktualisierung aller Tauri-Crates auf **Tauri v2.11.x** und `tauri-cli v2.11.x`.
- [x] Erfolgreicher Release-Build und Verifikation der `.exe` und Installer unter Windows.

### Geplante Meilensteine / Offene Aufgaben:
- [ ] **Natives Dateisystem-Handling:** Implementierung eines Tauri-Plugins / Content-Managers, damit Notebooks (`.ipynb`) direkt auf dem lokalen Dateisystem geöffnet und gespeichert werden können (statt nur im Browser-IndexedDB).
- [ ] **App-Menüs & Shortcuts:** Natives Menüband (Datei -> Öffnen, Speichern, Neu, Einstellungen).
- [ ] **Erweiterter Python-Support:** Vorinstallierte wissenschaftliche Python-Bibliotheken (NumPy, Pandas, Matplotlib) im Pyodide-Preload konfigurieren.
- [ ] **Cross-Platform Builds:** GitHub Actions CI/CD für automatische Windows-, macOS- und Linux-Releases.

---

## 5. Multi-Device Synchronisations-Konventionen (agy)

1. **Single Source of Truth:** Änderungen an Architektur, neuen Features oder Abhängigkeiten immer in dieser `GEMINI.md` nachführen.
2. **Session-Handoff:** Vor dem Wechsel zu einem anderen Rechner:
   - Offene Punkte oder neue Erkenntnisse in `GEMINI.md` festhalten.
   - Änderungen committen und zu Git pushen (`git commit -am "..." && git push`).
3. **Auf dem Zielrechner:**
   - `git pull` ausführen.
   - `agy` starten (der Agent liest automatisch `GEMINI.md` und ist sofort auf dem aktuellen Stand).
