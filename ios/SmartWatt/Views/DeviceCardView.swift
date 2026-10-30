import SwiftUI

public struct DeviceCardView: View {
    @ObservedObject var store: DeviceStore
    let device: SmartDevice
    let onTap: () -> Void
    
    public var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 14) {
                // Top Row: Icon & Toggle
                HStack(alignment: .top) {
                    ZStack {
                        Circle()
                            .fill(device.isOnBool ? Color.green.opacity(0.2) : Color.white.opacity(0.06))
                            .frame(width: 44, height: 44)
                        
                        Image(systemName: device.sfSymbol)
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundColor(device.isOnBool ? Color.green : Color.secondary)
                    }
                    
                    Spacer()
                    
                    Toggle("", isOn: Binding(
                        get: { device.isOnBool },
                        set: { _ in store.toggleDevice(id: device.id) }
                    ))
                    .labelsHidden()
                    .tint(.green)
                }
                
                Spacer(minLength: 4)
                
                // Bottom: Title & Real-time Metrics
                VStack(alignment: .leading, spacing: 4) {
                    Text(device.name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.primary)
                        .lineLimit(1)
                    
                    HStack(spacing: 6) {
                        if device.isOnBool {
                            Text(String(format: "%.1f W", device.power_w))
                                .font(.system(size: 13, weight: .bold, design: .monospaced))
                                .foregroundColor(.green)
                            
                            Text("•")
                                .foregroundColor(.secondary)
                            
                            Text(String(format: "%.3f €/h", device.burnRatePerHour(pricePerKwh: store.kwhPrice)))
                                .font(.system(size: 12, weight: .medium, design: .monospaced))
                                .foregroundColor(.secondary)
                        } else {
                            Text("Ausgeschaltet")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, minHeight: 130, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Color(UIColor.secondarySystemBackground).opacity(0.85))
                    .overlay(
                        RoundedRectangle(cornerRadius: 22, style: .continuous)
                            .stroke(device.isOnBool ? Color.green.opacity(0.35) : Color.white.opacity(0.08), lineWidth: 1)
                    )
            )
            .shadow(color: device.isOnBool ? Color.green.opacity(0.12) : Color.black.opacity(0.08), radius: 10, x: 0, y: 4)
        }
        .buttonStyle(SquishyButtonStyle())
    }
}

public struct SquishyButtonStyle: ButtonStyle {
    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}
