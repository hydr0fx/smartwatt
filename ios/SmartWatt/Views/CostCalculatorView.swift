import SwiftUI

public struct CostCalculatorView: View {
    @ObservedObject var store: DeviceStore
    @State private var wattage: Double = 400.0
    @State private var hoursPerDay: Double = 24.0
    @State private var customPrice: Double = 0.34
    
    private var isSolar: Bool {
        wattage < 0
    }
    
    private var absWatt: Double {
        abs(wattage)
    }
    
    private var costPerHour: Double {
        (absWatt / 1000.0) * customPrice
    }
    
    private var costPerDay: Double {
        costPerHour * hoursPerDay
    }
    
    private var costPerMonth: Double {
        costPerDay * 30.0
    }
    
    private var costPerYear: Double {
        costPerDay * 365.0
    }
    
    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    // Header / Display Card
                    VStack(spacing: 12) {
                        Text(isSolar ? "Ersparnis durch Solar-Einspeisung" : "Berechnete Stromkosten")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(isSolar ? .orange : .secondary)
                            .textCase(.uppercase)
                        
                        HStack(alignment: .firstTextBaseline, spacing: 4) {
                            Text(String(format: "%.2f €", costPerYear))
                                .font(.system(size: 44, weight: .heavy, design: .rounded))
                                .foregroundColor(isSolar ? .orange : .green)
                            Text("/ Jahr")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.secondary)
                        }
                        
                        Text(String(format: "bei %.0f Watt und %.0f Std. Betrieb pro Tag", absWatt, hoursPerDay))
                            .font(.system(size: 13))
                            .foregroundColor(.secondary)
                    }
                    .padding(24)
                    .frame(maxWidth: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: 24, style: .continuous)
                            .fill(Color(UIColor.secondarySystemBackground))
                    )
                    
                    // Live Cost Breakdown Grid
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        calcTile(title: "Pro Stunde", val: String(format: "%.3f €", costPerHour), sub: "\(String(format: "%.0f", absWatt)) Wh")
                        calcTile(title: "Pro Tag (\(Int(hoursPerDay))h)", val: String(format: "%.2f €", costPerDay), sub: "\(String(format: "%.2f", (absWatt * hoursPerDay)/1000.0)) kWh")
                        calcTile(title: "Pro Monat (30 T.)", val: String(format: "%.2f €", costPerMonth), sub: "\(String(format: "%.1f", (absWatt * hoursPerDay * 30)/1000.0)) kWh")
                        calcTile(title: "Pro Jahr (365 T.)", val: String(format: "%.2f €", costPerYear), sub: "\(String(format: "%.0f", (absWatt * hoursPerDay * 365)/1000.0)) kWh")
                    }
                    
                    // Sliders & Controls
                    VStack(alignment: .leading, spacing: 18) {
                        // Wattage Slider
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Leistung (Watt)")
                                    .font(.system(size: 14, weight: .semibold))
                                Spacer()
                                Text("\(Int(wattage)) W")
                                    .font(.system(size: 15, weight: .bold, design: .monospaced))
                                    .foregroundColor(.green)
                            }
                            Slider(value: $wattage, in: -800...3500, step: 10)
                                .tint(.green)
                        }
                        
                        // Operating Hours Slider
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Laufzeit pro Tag")
                                    .font(.system(size: 14, weight: .semibold))
                                Spacer()
                                Text("\(Int(hoursPerDay)) Std. / Tag")
                                    .font(.system(size: 15, weight: .bold, design: .monospaced))
                                    .foregroundColor(.blue)
                            }
                            Slider(value: $hoursPerDay, in: 1...24, step: 1)
                                .tint(.blue)
                        }
                        
                        // Electricity Price Slider
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Strompreis")
                                    .font(.system(size: 14, weight: .semibold))
                                Spacer()
                                Text(String(format: "%.2f € / kWh", customPrice))
                                    .font(.system(size: 15, weight: .bold, design: .monospaced))
                                    .foregroundColor(.orange)
                            }
                            Slider(value: $customPrice, in: 0.15...0.70, step: 0.01)
                                .tint(.orange)
                        }
                    }
                    .padding(20)
                    .background(
                        RoundedRectangle(cornerRadius: 22, style: .continuous)
                            .fill(Color(UIColor.secondarySystemBackground))
                    )
                    
                    // 1-Click Presets
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Schnell-Vorlagen:")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.secondary)
                            .textCase(.uppercase)
                        
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 10) {
                                presetPill(name: "Gaming-PC", w: 420, h: 6)
                                presetPill(name: "Kühlschrank", w: 85, h: 24)
                                presetPill(name: "Waschmaschine", w: 1950, h: 1.5)
                                presetPill(name: "OLED TV", w: 120, h: 5)
                                presetPill(name: "Balkonkraftwerk", w: -600, h: 5)
                                presetPill(name: "WLAN-Router", w: 12, h: 24)
                            }
                        }
                    }
                }
                .padding(20)
            }
            .navigationTitle("Stromrechner")
        }
    }
    
    private func calcTile(title: String, val: String, sub: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.secondary)
            Text(val)
                .font(.system(size: 18, weight: .heavy, design: .monospaced))
                .foregroundColor(.primary)
            Text(sub)
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundColor(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(UIColor.secondarySystemBackground))
        )
    }
    
    private func presetPill(name: String, w: Double, h: Double) -> some View {
        Button(action: {
            wattage = w
            hoursPerDay = h
        }) {
            VStack(spacing: 4) {
                Text(name)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.primary)
                Text("\(Int(w)) W • \(String(format: "%.0f", h))h")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                Capsule()
                    .fill(Color(UIColor.secondarySystemBackground))
                    .overlay(Capsule().stroke(Color.white.opacity(0.1), lineWidth: 1))
            )
        }
    }
}
