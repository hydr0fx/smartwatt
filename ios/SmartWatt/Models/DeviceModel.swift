import Foundation

public struct SmartDevice: Identifiable, Codable, Equatable {
    public let id: String
    public var name: String
    public var icon: String
    public var category: String
    public var is_on: Int
    public var power_w: Double
    public var voltage_v: Double
    public var current_ma: Double
    public var energy_today_kwh: Double
    public var energy_total_kwh: Double
    public var peak_power_w: Double
    public var auto_off_timer_min: Int
    public var auto_off_target_time: String?
    public var is_simulated: Int
    public var custom_order: Int
    
    public var isOnBool: Bool {
        get { is_on == 1 }
        set { is_on = newValue ? 1 : 0 }
    }
    
    public func burnRatePerHour(pricePerKwh: Double) -> Double {
        guard isOnBool else { return 0.0 }
        return (power_w / 1000.0) * pricePerKwh
    }
    
    public func costPerDay(pricePerKwh: Double) -> Double {
        burnRatePerHour(pricePerKwh: pricePerKwh) * 24.0
    }
    
    public func costPerMonth(pricePerKwh: Double) -> Double {
        costPerDay(pricePerKwh: pricePerKwh) * 30.0
    }
    
    public func costPerYear(pricePerKwh: Double) -> Double {
        costPerDay(pricePerKwh: pricePerKwh) * 365.0
    }
    
    public func costToday(pricePerKwh: Double) -> Double {
        energy_today_kwh * pricePerKwh
    }
    
    public func isStandby(threshold: Double = 15.0) -> Bool {
        isOnBool && power_w >= 0.5 && power_w <= threshold
    }
    
    public func standbyAnnualCost(pricePerKwh: Double, threshold: Double = 15.0) -> Double {
        isStandby(threshold: threshold) ? (power_w / 1000.0) * 24.0 * 365.0 * pricePerKwh : 0.0
    }
    
    public var sfSymbol: String {
        switch icon.lowercased() {
        case "monitor", "pc": return "desktopcomputer"
        case "refrigerator", "fridge": return "refrigerator"
        case "washing-machine", "washer": return "washer"
        case "tv": return "tv"
        case "lamp", "light": return "lightbulb.fill"
        case "coffee": return "cup.and.saucer.fill"
        case "solar", "sun": return "sun.max.fill"
        case "router", "wifi": return "wifi.router"
        default: return "powerplug.fill"
        }
    }
}

public struct SmartWattSummary: Codable {
    public var total_devices: Int
    public var active_devices: Int
    public var total_power_w: Double
    public var total_energy_today_kwh: Double
    public var total_burn_rate_eur_h: Double
    public var total_cost_day_rate_eur: Double
    public var total_cost_month_rate_eur: Double
    public var total_cost_year_rate_eur: Double
    public var kwh_price: Double
}
