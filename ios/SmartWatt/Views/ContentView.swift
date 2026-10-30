import SwiftUI

public struct ContentView: View {
    @StateObject private var store = DeviceStore()
    @State private var selectedDeviceId: String?
    @State private var showTuyaScanner = false
    @State private var showSettings = false
    @State private var selectedTab = 0
    
    private let categories = [
        ("all", "Alle"),
        ("entertainment", "Wohnbereich"),
        ("kitchen", "Küche"),
        ("utility", "Haushalt")
    ]
    
    public var body: some View {
        TabView(selection: $selectedTab) {
            // TAB 1: ÜBERSICHT (HOME)
            NavigationStack {
                ScrollView {
                    VStack(spacing: 20) {
                        // Apple iOS 18 Hero Status Card
                        VStack(spacing: 12) {
                            HStack {
                                HStack(spacing: 6) {
                                    Circle()
                                        .fill(Color.green)
                                        .frame(width: 8, height: 8)
                                    Text("Echtzeit-Gesamtlast")
                                        .font(.system(size: 12, weight: .semibold))
                                        .foregroundColor(.secondary)
                                        .textCase(.uppercase)
                                }
                                Spacer()
                                Text(String(format: "Tarif: %.2f €/kWh", store.kwhPrice))
                                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                                    .foregroundColor(.green)
                            }
                            
                            HStack(alignment: .firstTextBaseline) {
                                Text(String(format: "%.0f", store.totalPowerW))
                                    .font(.system(size: 52, weight: .heavy, design: .rounded))
                                    .foregroundColor(.primary)
                                Text("Watt")
                                    .font(.system(size: 20, weight: .bold))
                                    .foregroundColor(.secondary)
                                
                                Spacer()
                                
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text(String(format: "%.2f € / Std.", store.totalBurnRatePerHour))
                                        .font(.system(size: 16, weight: .bold, design: .monospaced))
                                        .foregroundColor(.green)
                                    Text(String(format: "ca. %.2f € / Tag", store.totalCostPerDay))
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                        .padding(20)
                        .background(
                            RoundedRectangle(cornerRadius: 24, style: .continuous)
                                .fill(Color(UIColor.secondarySystemBackground))
                        )
                        
                        // Category Filter Pills
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 10) {
                                ForEach(categories, id: \.0) { cat in
                                    Button(action: {
                                        store.selectedCategory = cat.0
                                    }) {
                                        Text(cat.1)
                                            .font(.system(size: 13, weight: .semibold))
                                            .padding(.horizontal, 16)
                                            .padding(.vertical, 8)
                                            .background(
                                                Capsule()
                                                    .fill(store.selectedCategory == cat.0 ? Color.green : Color(UIColor.secondarySystemBackground))
                                            )
                                            .foregroundColor(store.selectedCategory == cat.0 ? .black : .primary)
                                    }
                                }
                            }
                        }
                        
                        // Device Grid (Apple Home style)
                        LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)], spacing: 14) {
                            ForEach(store.filteredDevices) { dev in
                                DeviceCardView(store: store, device: dev) {
                                    selectedDeviceId = dev.id
                                }
                            }
                        }
                        
                        // Smart Life QR Pairing Banner
                        Button(action: {
                            showTuyaScanner = true
                        }) {
                            HStack(spacing: 14) {
                                ZStack {
                                    Circle().fill(Color.green.opacity(0.2)).frame(width: 44, height: 44)
                                    Image(systemName: "qrcode.viewfinder").font(.title3).foregroundColor(.green)
                                }
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Smart Life Steckdosen koppeln")
                                        .font(.system(size: 15, weight: .bold))
                                        .foregroundColor(.primary)
                                    Text("Echte Geräte sekundenschnell per Scan importieren")
                                        .font(.system(size: 12))
                                        .foregroundColor(.secondary)
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption.weight(.bold))
                                    .foregroundColor(.secondary)
                            }
                            .padding(16)
                            .background(
                                RoundedRectangle(cornerRadius: 20, style: .continuous)
                                    .fill(Color(UIColor.secondarySystemBackground))
                            )
                        }
                        .buttonStyle(SquishyButtonStyle())
                        .padding(.top, 4)
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 24)
                }
                .navigationTitle("SmartWatt")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button(action: { showSettings = true }) {
                            Image(systemName: "gearshape.fill")
                                .foregroundColor(.primary)
                        }
                    }
                }
                .sheet(item: Binding<DeviceSheetItem?>(
                    get: { selectedDeviceId.map { DeviceSheetItem(id: $0) } },
                    set: { selectedDeviceId = $0?.id }
                )) { item in
                    DeviceDetailSheet(store: store, deviceId: item.id)
                }
                .sheet(isPresented: $showTuyaScanner) {
                    TuyaScannerView(store: store)
                }
                .sheet(isPresented: $showSettings) {
                    SettingsView(store: store)
                }
            }
            .tabItem {
                Label("Zuhause", systemImage: "house.fill")
            }
            .tag(0)
            
            // TAB 2: STROMRECHNER
            CostCalculatorView(store: store)
                .tabItem {
                    Label("Rechner", systemImage: "eurosign.circle.fill")
                }
                .tag(1)
            
            // TAB 3: EINSTELLUNGEN
            SettingsView(store: store)
                .tabItem {
                    Label("Einstellungen", systemImage: "slider.horizontal.3")
                }
                .tag(2)
        }
        .tint(.green)
    }
}

public struct DeviceSheetItem: Identifiable {
    public let id: String
}
