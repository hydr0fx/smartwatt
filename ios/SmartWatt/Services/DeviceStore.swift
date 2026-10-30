import Foundation
import Combine
import SwiftUI

@MainActor
public class DeviceStore: ObservableObject {
    @Published public var devices: [SmartDevice] = []
    @Published public var kwhPrice: Double = 0.34
    @Published public var serverUrl: String = "http://192.168.178.21:8000"
    @Published public var isOnlineBackend: Bool = false
    @Published public var selectedCategory: String = "all"
    @Published public var isLoading: Bool = false
    @Published public var alertMessage: String?
    
    private var timer: Timer?
    
    public init() {
        loadInitialData()
        startLivePolling()
    }
    
    deinit {
        timer?.invalidate()
    }
    
    public var filteredDevices: [SmartDevice] {
        if selectedCategory == "all" {
            return devices
        }
        return devices.filter { $0.category.lowercased() == selectedCategory.lowercased() }
    }
    
    public var totalPowerW: Double {
        devices.filter { $0.isOnBool }.reduce(0.0) { $0 + $1.power_w }
    }
    
    public var totalBurnRatePerHour: Double {
        (totalPowerW / 1000.0) * kwhPrice
    }
    
    public var totalCostPerDay: Double {
        totalBurnRatePerHour * 24.0
    }
    
    public var totalCostPerMonth: Double {
        totalCostPerDay * 30.0
    }
    
    public var totalCostPerYear: Double {
        totalCostPerDay * 365.0
    }
    
    public var activeCount: Int {
        devices.filter { $0.isOnBool }.count
    }
    
    public func loadInitialData() {
        self.devices = [
            SmartDevice(
                id: "demo-gaming-pc",
                name: "Gaming PC & Triple-Monitor",
                icon: "monitor",
                category: "entertainment",
                is_on: 1,
                power_w: 418.5,
                voltage_v: 231.2,
                current_ma: 1810.0,
                energy_today_kwh: 2.91,
                energy_total_kwh: 48.65,
                peak_power_w: 580.0,
                auto_off_timer_min: 0,
                auto_off_target_time: nil,
                is_simulated: 1,
                custom_order: 1
            ),
            SmartDevice(
                id: "demo-fridge",
                name: "Kühlschrank (Küche)",
                icon: "refrigerator",
                category: "kitchen",
                is_on: 1,
                power_w: 80.2,
                voltage_v: 230.8,
                current_ma: 348.0,
                energy_today_kwh: 0.94,
                energy_total_kwh: 29.56,
                peak_power_w: 140.0,
                auto_off_timer_min: 0,
                auto_off_target_time: nil,
                is_simulated: 1,
                custom_order: 2
            ),
            SmartDevice(
                id: "demo-washing",
                name: "Waschmaschine (Bad)",
                icon: "washing-machine",
                category: "utility",
                is_on: 1,
                power_w: 1960.0,
                voltage_v: 228.6,
                current_ma: 8574.0,
                energy_today_kwh: 2.95,
                energy_total_kwh: 85.10,
                peak_power_w: 2150.0,
                auto_off_timer_min: 0,
                auto_off_target_time: nil,
                is_simulated: 1,
                custom_order: 3
            ),
            SmartDevice(
                id: "demo-tv",
                name: "Wohnzimmer TV & Soundbar",
                icon: "tv",
                category: "entertainment",
                is_on: 1,
                power_w: 6.5,
                voltage_v: 232.0,
                current_ma: 28.0,
                energy_today_kwh: 0.32,
                energy_total_kwh: 19.30,
                peak_power_w: 135.0,
                auto_off_timer_min: 0,
                auto_off_target_time: nil,
                is_simulated: 1,
                custom_order: 4
            )
        ]
    }
    
    public func startLivePolling() {
        timer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.pollAndUpdate()
            }
        }
    }
    
    public func pollAndUpdate() async {
        // Try fetching from local server if accessible
        guard let url = URL(string: "\(serverUrl)/api/devices") else {
            simulateFluctuation()
            return
        }
        
        do {
            var request = URLRequest(url: url)
            request.timeoutInterval = 1.5
            let (data, response) = try await URLSession.shared.data(for: request)
            if let httpRes = response as? HTTPURLResponse, httpRes.statusCode == 200 {
                let decoded = try JSONDecoder().decode([SmartDevice].self, from: data)
                self.devices = decoded
                self.isOnlineBackend = true
                return
            }
        } catch {
            // Server offline / remote: apply realistic local micro-simulation
            self.isOnlineBackend = false
            simulateFluctuation()
        }
    }
    
    private func simulateFluctuation() {
        for i in 0..<devices.count {
            guard devices[i].isOnBool else {
                devices[i].power_w = 0.0
                devices[i].current_ma = 0.0
                continue
            }
            let jitter = Double.random(in: -1.2...1.2)
            if devices[i].id == "demo-gaming-pc" {
                devices[i].power_w = max(380.0, min(520.0, devices[i].power_w + jitter * 3.0))
            } else if devices[i].id == "demo-fridge" {
                devices[i].power_w = max(70.0, min(95.0, devices[i].power_w + jitter * 0.8))
            } else if devices[i].id == "demo-washing" {
                devices[i].power_w = max(1800.0, min(2100.0, devices[i].power_w + jitter * 10.0))
            } else if devices[i].id == "demo-tv" {
                devices[i].power_w = max(5.0, min(8.0, devices[i].power_w + jitter * 0.2))
            }
            devices[i].current_ma = (devices[i].power_w / max(1.0, devices[i].voltage_v)) * 1000.0
        }
    }
    
    public func toggleDevice(id: String) {
        guard let idx = devices.firstIndex(where: { $0.id == id }) else { return }
        let newState = !devices[idx].isOnBool
        devices[idx].isOnBool = newState
        if !newState {
            devices[idx].power_w = 0.0
            devices[idx].current_ma = 0.0
        } else {
            if devices[idx].id == "demo-gaming-pc" { devices[idx].power_w = 415.0 }
            else if devices[idx].id == "demo-fridge" { devices[idx].power_w = 80.0 }
            else if devices[idx].id == "demo-washing" { devices[idx].power_w = 1950.0 }
            else if devices[idx].id == "demo-tv" { devices[idx].power_w = 6.5 }
            else { devices[idx].power_w = 45.0 }
        }
        
        // Haptic feedback
        #if canImport(UIKit)
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()
        #endif
        
        // Sync with backend if connected
        if isOnlineBackend, let url = URL(string: "\(serverUrl)/api/devices/\(id)/toggle") {
            Task {
                var req = URLRequest(url: url)
                req.httpMethod = "POST"
                req.timeoutInterval = 2.0
                _ = try? await URLSession.shared.data(for: req)
            }
        }
    }
    
    public func addDevice(name: String, icon: String, category: String, powerW: Double) {
        let newDevice = SmartDevice(
            id: "device-\(UUID().uuidString.prefix(8))",
            name: name,
            icon: icon,
            category: category,
            is_on: 1,
            power_w: powerW,
            voltage_v: 230.0,
            current_ma: (powerW / 230.0) * 1000.0,
            energy_today_kwh: (powerW / 1000.0) * 2.0,
            energy_total_kwh: (powerW / 1000.0) * 20.0,
            peak_power_w: powerW * 1.25,
            auto_off_timer_min: 0,
            auto_off_target_time: nil,
            is_simulated: 1,
            custom_order: devices.count + 1
        )
        devices.append(newDevice)
    }
    
    public func deleteDevice(id: String) {
        devices.removeAll { $0.id == id }
    }
}
