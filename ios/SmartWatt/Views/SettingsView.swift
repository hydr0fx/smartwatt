import SwiftUI

public struct SettingsView: View {
    @ObservedObject var store: DeviceStore
    @Environment(\.dismiss) private var dismiss
    
    public var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("Strompreis & Tarif")) {
                    HStack {
                        Text("Preis pro Kilowattstunde")
                        Spacer()
                        Text(String(format: "%.2f € / kWh", store.kwhPrice))
                            .foregroundColor(.green)
                            .font(.system(.body, design: .monospaced))
                    }
                    Slider(value: $store.kwhPrice, in: 0.15...0.70, step: 0.01)
                        .tint(.green)
                }
                
                Section(header: Text("SmartWatt Server Verbindung")) {
                    TextField("Server Adresse", text: $store.serverUrl)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .font(.system(.body, design: .monospaced))
                    
                    HStack {
                        Text("Status")
                        Spacer()
                        HStack(spacing: 6) {
                            Circle()
                                .fill(store.isOnlineBackend ? Color.green : Color.orange)
                                .frame(width: 8, height: 8)
                            Text(store.isOnlineBackend ? "Lokal Verbunden" : "Offline / Demo-Modus")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(store.isOnlineBackend ? .green : .orange)
                        }
                    }
                    
                    Button("Verbindung testen") {
                        Task {
                            await store.pollAndUpdate()
                        }
                    }
                }
                
                Section(header: Text("Über SmartWatt")) {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("2.5 (Apple iOS 18)")
                            .foregroundColor(.secondary)
                    }
                    HStack {
                        Text("Entwickelt für")
                        Spacer()
                        Text("Smart Life & Tuya Steckdosen")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Einstellungen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fertig") {
                        dismiss()
                    }
                }
            }
        }
    }
}
