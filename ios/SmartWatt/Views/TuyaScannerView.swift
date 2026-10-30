import SwiftUI

public struct TuyaScannerView: View {
    @ObservedObject var store: DeviceStore
    @Environment(\.dismiss) private var dismiss
    
    @State private var userCode: String = ""
    @State private var isRequesting: Bool = false
    @State private var qrImageUrl: String?
    @State private var statusMessage: String?
    @State private var isError: Bool = false
    
    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    // Header Banner
                    VStack(spacing: 10) {
                        Image(systemName: "qrcode.viewfinder")
                            .font(.system(size: 44))
                            .foregroundColor(.green)
                        
                        Text("Smart Life verbinden")
                            .font(.system(size: 22, weight: .bold))
                        
                        Text("Importiere deine echten Steckdosen & Energiemessungen sekundenschnell per QR-Code:")
                            .font(.system(size: 14))
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 10)
                    
                    // 3 Easy Steps
                    VStack(alignment: .leading, spacing: 14) {
                        stepRow(nr: "1", title: "Benutzer-Code finden", desc: "In Smart Life: Profil ➔ Zahnrad (Einstellungen) ➔ Konto und Sicherheit ➔ ganz unten auf 'Benutzer-Code'.")
                        stepRow(nr: "2", title: "Hier eingeben", desc: "Code unten eintragen (Groß- und Kleinschreibung beachten!) und auf 'QR-Code generieren' tippen.")
                        stepRow(nr: "3", title: "In Smart Life scannen", desc: "In Smart Life oben rechts auf das Scan-Symbol [-] tippen, QR-Code scannen und Zugriff bestätigen!")
                    }
                    .padding(18)
                    .background(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .fill(Color(UIColor.secondarySystemBackground))
                    )
                    
                    // Input & Button
                    VStack(spacing: 12) {
                        TextField("Benutzer-Code (z.B. AYy789)", text: $userCode)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .font(.system(size: 16, design: .monospaced))
                            .padding(14)
                            .background(
                                RoundedRectangle(cornerRadius: 14)
                                    .fill(Color(UIColor.tertiarySystemBackground))
                                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.1), lineWidth: 1))
                            )
                        
                        Button(action: generateTuyaQR) {
                            HStack {
                                if isRequesting {
                                    ProgressView().tint(.black)
                                } else {
                                    Image(systemName: "qrcode")
                                    Text("QR-Code generieren")
                                        .fontWeight(.bold)
                                }
                            }
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(
                                RoundedRectangle(cornerRadius: 14)
                                    .fill(Color.green)
                            )
                        }
                        .disabled(userCode.isEmpty || isRequesting)
                    }
                    
                    // Status Box
                    if let msg = statusMessage {
                        HStack(spacing: 10) {
                            Image(systemName: isError ? "exclamationmark.circle.fill" : "checkmark.circle.fill")
                                .foregroundColor(isError ? .red : .green)
                            Text(msg)
                                .font(.system(size: 13))
                                .foregroundColor(isError ? .red : .green)
                            Spacer()
                        }
                        .padding(14)
                        .background(
                            RoundedRectangle(cornerRadius: 14)
                                .fill((isError ? Color.red : Color.green).opacity(0.12))
                        )
                    }
                    
                    // QR Code Display
                    if let urlStr = qrImageUrl, let url = URL(string: urlStr) {
                        VStack(spacing: 12) {
                            AsyncImage(url: url) { img in
                                img.resizable()
                                    .interpolation(.none)
                                    .scaledToFit()
                                    .frame(width: 220, height: 220)
                                    .cornerRadius(12)
                            } placeholder: {
                                ProgressView()
                                    .frame(width: 220, height: 220)
                            }
                            
                            HStack(spacing: 6) {
                                Circle().fill(Color.green).frame(width: 8, height: 8)
                                Text("Warte auf Scan in deiner Smart Life App...")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundColor(.green)
                            }
                        }
                        .padding(20)
                        .background(
                            RoundedRectangle(cornerRadius: 22)
                                .fill(Color.black.opacity(0.4))
                        )
                    }
                }
                .padding(20)
            }
            .navigationTitle("Smart Life Koppeln")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Schließen") {
                        dismiss()
                    }
                }
            }
        }
    }
    
    private func stepRow(nr: String, title: String, desc: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                Circle().fill(Color.green.opacity(0.2)).frame(width: 28, height: 28)
                Text(nr).font(.system(size: 13, weight: .bold)).foregroundColor(.green)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 14, weight: .bold))
                Text(desc).font(.system(size: 12)).foregroundColor(.secondary)
            }
        }
    }
    
    private func generateTuyaQR() {
        guard !userCode.isEmpty else { return }
        isRequesting = true
        statusMessage = nil
        isError = false
        
        let targetUrl = "\(store.serverUrl)/api/tuya/qr-request"
        guard let url = URL(string: targetUrl) else {
            statusMessage = "Ungültige Serveradresse."
            isError = true
            isRequesting = false
            return
        }
        
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: String] = ["user_code": userCode.trimmingCharacters(in: .whitespacesAndNewlines)]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        Task {
            do {
                let (data, response) = try await URLSession.shared.data(for: req)
                if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                    if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                       let imgUrl = json["qr_image_url"] as? String {
                        self.qrImageUrl = imgUrl
                        self.statusMessage = "QR-Code erfolgreich erzeugt! Jetzt in Smart Life scannen."
                        self.isError = false
                    }
                } else {
                    let errMsg = String(data: data, encoding: .utf8) ?? "Unbekannter Fehler"
                    self.statusMessage = "Fehler: \(errMsg)"
                    self.isError = true
                }
            } catch {
                self.statusMessage = "Verbindungsfehler zum lokalen SmartWatt Server. Bitte prüfe, ob start.bat auf deinem PC läuft!"
                self.isError = true
            }
            self.isRequesting = false
        }
    }
}
