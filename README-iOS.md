# SmartWatt für Apple iOS 📱

SmartWatt steht dir in zwei vollwertigen Varianten zur Verfügung:

---

## ⚡ Option 1: Sofortige Installation auf dem iPhone (0 Sekunden, Ohne Mac)
SmartWatt ist als native **Apple Progressive Web App (PWA)** konfiguriert. Nach der Installation läuft sie auf deinem iPhone als **eigenständige Vollbild-App** (ohne Safari-Suchleiste, mit Apple Touch Icon, Statusleisten-Integration und haptischem Feedback):

1. Öffne auf deinem iPhone **Safari** und rufe die URL auf:  
   **[https://hydr0fx.github.io/smartwatt/](https://hydr0fx.github.io/smartwatt/)**  
   *(oder lokal in deinem WLAN: `http://192.168.178.21:8000`)*
2. Tippe unten in Safari auf das **Teilen-Symbol** (Viereck mit Pfeil nach oben).
3. Scrolle etwas nach unten und wähle **"Zum Home-Bildschirm"** `[+]`.
4. Bestätige oben rechts mit **"Hinzufügen"**.
5. **Fertig!** SmartWatt liegt nun mit offiziellem App-Icon auf deinem iPhone-Homescreen und öffnet sich wie jede App aus dem App Store im echten Vollbild!

---

## 🛠️ Option 2: Nativer Xcode / SwiftUI Quellcode
Im Ordner [`ios/`](./ios/) findest du das vollständige native iOS-Projekt:

* **Frameworks:** SwiftUI, Combine, Charts, AVFoundation (für QR-Scan)
* **Design:** Apple iOS 18 Designsprache, `.ultraThinMaterial` Liquid Glass, SF Symbols
* **Xcode Projekt:** [`ios/SmartWatt.xcodeproj`](./ios/SmartWatt.xcodeproj)
* **Dateien:**
  * `SmartWattApp.swift` - App Entrypoint
  * `Views/ContentView.swift` - Apple Home Grid & TabView
  * `Views/DeviceCardView.swift` - Interaktive Kacheln
  * `Views/DeviceDetailSheet.swift` - Apple Device Inspector Bottom Sheet
  * `Views/CostCalculatorView.swift` - Interaktiver Stromkostenrechner
  * `Views/TuyaScannerView.swift` - Smart Life QR-Kopplung
  * `Views/SettingsView.swift` - Tarif & Backend-Verbindung
  * `Services/DeviceStore.swift` - Reaktives State-Management mit Live-Polling

### Kompilieren:
```bash
cd ios
xcodebuild clean build -project SmartWatt.xcodeproj -scheme SmartWatt -destination "generic/platform=iOS"
```
Oder direkt in Xcode öffnen:
```bash
open ios/SmartWatt.xcodeproj
```
