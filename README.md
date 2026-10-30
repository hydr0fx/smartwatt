# ⚡ SmartWatt - Dein smarter Energie- & Stromkosten-Hub

Eine moderne, elegante und performante Web- & Mobile-App zur Überwachung und Steuerung deiner **Smart Life** Steckdosen mit sekundengenauer Stromkosten-Kalkulation, Standby-Verlust-Detektor, Überlastungsschutz und Verbrauchsanalysen.

---

## 🌟 Highlights & Features

1. **Echtzeit-Stromkostenrechner:**
   - Einstellbarer Strompreis (z.B. **0,34 € pro kWh**).
   - **Sekundengenaue Kosten-Rate (Burn Rate):**
     - Aktuelle Kosten pro Stunde (`€/h`, z.B. 400 Watt = `0,136 €/h`)
     - Hochrechnung auf 24 Stunden (`€/Tag`, z.B. `3,26 €`)
     - Hochrechnung auf den Monat (`€/Monat`, z.B. `97,92 €`)
     - Hochrechnung aufs ganze Jahr (`€/Jahr`)
   - Bisher angefallene Kosten heute & Gesamt in Euro und kWh.

2. **Detaillierte elektrische Telemetrie:**
   - Aktuelle Wirkleistung (**Watt**)
   - Netzspannung (**Volt**, z.B. 231,4 V)
   - Stromstärke (**Ampere / Milliampere**, z.B. 1,78 A)
   - Höchste gemessene Lastspitze (**Peak Power** in Watt)

3. **Smarte Killer-Features:**
   - **Standby-Vampir Detektor:** Erkennt automatisch, wenn ein Gerät scheinbar ausgeschaltet ist, aber heimlich Strom zieht (z.B. Fernseher im Standby mit 6,8 W). Berechnet sofort die jährlichen Mehrkosten (z.B. *~20,25 € pro Jahr verschwendet*) und bietet einen 1-Klick-Aus-Schalter.
   - **Überlastungsschutz-Warnung:** Visuelle Warnung (rot blinkend), sobald ein Gerät mehr Leistung zieht als erlaubt (z.B. > 2.500 W an einer Steckdose).
   - **Abschalt-Countdown (Timer):** Schaltet eine Steckdose automatisch nach 15, 30, 45, 60 oder 120 Minuten aus.

4. **Interaktive Analysen & Diagramme:**
   - **24-Stunden Lastverlauf:** Live-Liniendiagramm aller Steckdosen.
   - **Kosten-Verteilung:** Donut-Diagramm, wer im Haushalt wie viel Prozent der Stromrechnung ausmacht.
   - **7-Tage Verlauf:** Balkendiagramm der Stromkosten der letzten Tage.

5. **Multi-Plattform & PWA:**
   - Läuft am PC, Tablet und Smartphone.
   - Auf dem Smartphone kann die Web-Oberfläche einfach per **"Zum Startbildschirm hinzufügen"** installiert werden und verhält sich 100% wie eine native App (eigenes Icon, Vollbildmodus, keine störende Adressleiste).

---

## 🚀 Schnellstart

1. Mache einen **Doppelklick auf `start.bat`**.
2. Dein Browser öffnet sich automatisch unter:
   `http://localhost:8000`
3. Die App startet direkt im **Demo- / Simulationsmodus** mit realistischen Verbrauchsdaten (Gaming-PC, Kühlschrank, Waschmaschine, TV), sodass du alle Funktionen, Tacho-Werte und Diagramme sofort ausprobieren kannst!

---

## 📱 Auf dem Smartphone nutzen (PWA)

1. Verbinde dein Smartphone mit demselben Heim-WLAN wie deinen Computer.
2. Finde die lokale IP-Adresse deines PCs heraus (in der Windows-Eingabeaufforderung `ipconfig` eingeben, z.B. `192.168.178.50`).
3. Öffne im Safari (iOS) oder Chrome (Android) auf deinem Handy:
   `http://DEINE-PC-IP:8000` (z.B. `http://192.168.178.50:8000`).
4. **Auf dem iPhone:** Tippe auf das Teilen-Symbol (Viereck mit Pfeil nach oben) und wähle **"Zum Home-Bildschirm"**.
5. **Auf Android:** Tippe auf die drei Punkte oben rechts und wähle **"App installieren"** oder **"Zum Startbildschirm hinzufügen"**.
6. Fertig! Du hast nun ein eigenes App-Icon auf deinem Handy und die App öffnet sich wie eine normale native App.

---

## 🔌 Echte Smart Life Steckdosen verbinden

Smart Life basiert weltweit auf der **Tuya IoT Plattform**. Die Steckdosen müssen **nicht** aus Smart Life gelöscht oder umgeflasht werden! Beide Apps laufen parallel und synchron.

### Schritt-für-Schritt Anleitung (Dauert ca. 3–5 Minuten):

1. **Tuya Cloud Entwicklerkonto erstellen:**
   - Gehe auf [iot.tuya.com](https://iot.tuya.com) und erstelle einen kostenlosen Account.
2. **Cloud-Projekt anlegen:**
   - Klicke im linken Menü auf **Cloud** -> **Development** -> **Create Cloud Project**.
   - Projektname z.B. `SmartWatt`.
   - Wähle als Datenzentrum: **Central Europe Data Center** (für Deutschland/Europa).
3. **Smart Life App verknüpfen:**
   - Klicke in deinem Projekt auf den Reiter **Devices** -> **Link Tuya App Account**.
   - Klicke auf **Add App Account**. Ein QR-Code wird auf dem Bildschirm angezeigt.
   - Öffne auf deinem Smartphone die **Smart Life App**, gehe auf **Profil** (unten rechts) und tippe oben rechts auf das **Scan-Symbol**.
   - Scanne den QR-Code und bestätige die Verknüpfung.
4. **API-Schlüssel in SmartWatt eintragen:**
   - Klicke im Tuya-Portal auf **Project Overview**.
   - Kopiere deine **Access ID / Client ID** und dein **Access Secret**.
   - Öffne in SmartWatt die **Einstellungen** (Zahnrad-Symbol oben rechts).
   - Füge Access ID und Secret ein und klicke auf **"Verbindung testen"** und danach auf **"Geräte aus Smart Life importieren"**.
5. Klicke auf **"Modus umschalten"** (von Simulation auf Live).
6. Deine echten Steckdosen erscheinen nun live im Dashboard!
