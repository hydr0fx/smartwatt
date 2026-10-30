import SwiftUI

public struct DeviceDetailSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: DeviceStore
    let deviceId: String
    
    private var device: SmartDevice? {
        store.devices.first(where: { $0.id == deviceId })
    }
    
    public var body: some View {
        NavigationStack {
            ScrollView {
                if let dev = device {
                    VStack(spacing: 20) {
                        // Top Hero Card with Gauge
                        VStack(spacing: 12) {
                            ZStack {
                                Circle()
                                    .fill(dev.isOnBool ? Color.green.opacity(0.15) : Color.white.opacity(0.05))
                                    .frame(width: 80, height: 80)
                                
                                Image(systemName: dev.sfSymbol)
                                    .font(.system(size: 38, weight: .semibold))
                                    .foregroundColor(dev.isOnBool ? .green : .secondary)
                            }
                            
                            Text(dev.name)
                                .font(.system(size: 22, weight: .bold))
                                .multilineTextAlignment(.center)
                            
                            HStack(spacing: 8) {
                                Circle()
                                    .fill(dev.isOnBool ? Color.green : Color.secondary)
                                    .frame(width: 8, height: 8)
                                Text(dev.isOnBool ? "In Betrieb" : "Ausgeschaltet")
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundColor(.secondary)
                            }
                            
                            // Power Value Hero
                            HStack(alignment: .firstTextBaseline, spacing: 4) {
                                Text(dev.isOnBool ? String(format: "%.1f", dev.power_w) : "0.0")
                                    .font(.system(size: 46, weight: .heavy, design: .rounded))
                                    .foregroundColor(dev.isOnBool ? .primary : .secondary)
                                Text("Watt")
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding(.vertical, 12)
                        
                        // Live Telemetry Grid
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                            metricCard(title: "Spannung", value: String(format: "%.1f V", dev.voltage_v), icon: "bolt.fill", tint: .blue)
                            metricCard(title: "Stromstärke", value: String(format: "%.0f mA", dev.current_ma), icon: "gauge.with.needle.fill", tint: .purple)
                            metricCard(title: "Verbrauch Heute", value: String(format: "%.2f kWh", dev.energy_today_kwh), icon: "chart.bar.fill", tint: .orange)
                            metricCard(title: "Kosten Heute", value: String(format: "%.2f €", dev.costToday(pricePerKwh: store.kwhPrice)), icon: "eurosign.circle.fill", tint: .green)
                        }
                        
                        // 24/7 Cost Projection Card
                        VStack(alignment: .leading, spacing: 14) {
                            HStack {
                                Image(systemName: "clock.arrow.circlepath")
                                    .foregroundColor(.green)
                                Text("Dauerbetrieb Hochrechnung (bei 24/7)")
                                    .font(.system(size: 14, weight: .bold))
                            }
                            
                            HStack(spacing: 0) {
                                costCol(title: "Stunde", value: String(format: "%.3f €", dev.burnRatePerHour(pricePerKwh: store.kwhPrice)))
                                Divider().frame(height: 36)
                                costCol(title: "24 Std.", value: String(format: "%.2f €", dev.costPerDay(pricePerKwh: store.kwhPrice)))
                                Divider().frame(height: 36)
                                costCol(title: "Monat", value: String(format: "%.2f €", dev.costPerMonth(pricePerKwh: store.kwhPrice)))
                                Divider().frame(height: 36)
                                costCol(title: "Jahr", value: String(format: "%.2f €", dev.costPerYear(pricePerKwh: store.kwhPrice)), isHigh: true)
                            }
                        }
                        .padding(16)
                        .background(
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .fill(Color(UIColor.secondarySystemBackground))
                        )
                        
                        // Standby Alert if applicable
                        if dev.isStandby() {
                            HStack(spacing: 12) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.orange)
                                    .font(.title2)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Heimlicher Standby-Fresser")
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(.orange)
                                    Text(String(format: "Verbraucht %.1f W im Leerlauf = ca. %.2f € pro Jahr!", dev.power_w, dev.standbyAnnualCost(pricePerKwh: store.kwhPrice)))
                                        .font(.system(size: 12))
                                        .foregroundColor(.secondary)
                                }
                                Spacer()
                            }
                            .padding(14)
                            .background(
                                RoundedRectangle(cornerRadius: 16)
                                    .fill(Color.orange.opacity(0.12))
                                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.orange.opacity(0.3), lineWidth: 1))
                            )
                        }
                        
                        // Power Switch Button
                        Button(action: {
                            store.toggleDevice(id: dev.id)
                        }) {
                            HStack {
                                Image(systemName: "power")
                                    .font(.headline)
                                Text(dev.isOnBool ? "Steckdose Ausschalten" : "Steckdose Einschalten")
                                    .font(.system(size: 16, weight: .bold))
                            }
                            .foregroundColor(dev.isOnBool ? .white : .black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(
                                RoundedRectangle(cornerRadius: 18, style: .continuous)
                                    .fill(dev.isOnBool ? Color.red : Color.green)
                            )
                        }
                        .buttonStyle(SquishyButtonStyle())
                        .padding(.top, 8)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Gerätedetails")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fertig") {
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }
    
    private func metricCard(title: String, value: String, icon: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: icon)
                    .font(.caption)
                    .foregroundColor(tint)
                Text(title)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.secondary)
            }
            Text(value)
                .font(.system(size: 16, weight: .bold, design: .rounded))
                .foregroundColor(.primary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(UIColor.secondarySystemBackground))
        )
    }
    
    private func costCol(title: String, value: String, isHigh: Bool = false) -> some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.secondary)
            Text(value)
                .font(.system(size: 14, weight: .bold, design: .monospaced))
                .foregroundColor(isHigh ? .green : .primary)
        }
        .frame(maxWidth: .infinity)
    }
}
