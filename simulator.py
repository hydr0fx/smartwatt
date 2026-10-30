import time
import math
import random
import datetime
from database import get_all_devices, save_device, log_history_reading, get_setting

class DeviceSimulator:
    def __init__(self):
        self.last_tick = time.time()
        self.tick_counter = 0

    def update(self):
        now = time.time()
        dt = now - self.last_tick
        self.last_tick = now
        self.tick_counter += 1

        kwh_price = float(get_setting("kwh_price", "0.34"))
        devices = get_all_devices()

        for dev in devices:
            if not dev.get("is_simulated"):
                continue

            # Check auto off timer
            if dev.get("auto_off_target_time"):
                try:
                    target_dt = datetime.datetime.fromisoformat(dev["auto_off_target_time"])
                    if datetime.datetime.now() >= target_dt:
                        dev["is_on"] = 0
                        dev["auto_off_target_time"] = None
                        dev["auto_off_timer_min"] = 0
                except Exception:
                    pass

            is_on = bool(dev.get("is_on", 1))
            dev_id = dev["id"]

            if not is_on:
                # Totally turned off at socket
                dev["power_w"] = 0.0
                dev["current_ma"] = 0.0
                dev["voltage_v"] = round(230.0 + random.uniform(-0.5, 0.5), 1)
            else:
                # Device specific realistic simulation
                if dev_id == "demo-gaming-pc":
                    # Heavy load e.g. 390 - 440W (User specifically mentioned 400W!)
                    base = 405.0
                    jitter = math.sin(self.tick_counter * 0.3) * 25.0 + random.uniform(-10.0, 10.0)
                    dev["power_w"] = round(max(350.0, base + jitter), 1)
                    dev["voltage_v"] = round(231.2 + random.uniform(-0.8, 0.8), 1)
                    dev["current_ma"] = round((dev["power_w"] / dev["voltage_v"]) * 1000, 0)

                elif dev_id == "demo-fridge":
                    # Compressor cycles every ~40 ticks
                    phase = (self.tick_counter % 60)
                    if phase < 35:
                        dev["power_w"] = round(78.0 + random.uniform(-3.0, 5.0), 1)
                    else:
                        dev["power_w"] = round(1.2 + random.uniform(0.0, 0.5), 1)
                    dev["voltage_v"] = round(230.5 + random.uniform(-0.6, 0.6), 1)
                    dev["current_ma"] = round((dev["power_w"] / dev["voltage_v"]) * 1000, 0)

                elif dev_id == "demo-washing":
                    # High power cycle
                    step = (self.tick_counter % 80)
                    if step < 25:
                        dev["power_w"] = round(1950.0 + random.uniform(-60.0, 80.0), 1) # Heating
                    elif step < 55:
                        dev["power_w"] = round(320.0 + random.uniform(-40.0, 50.0), 1)  # Tumbling
                    elif step < 70:
                        dev["power_w"] = round(650.0 + random.uniform(-20.0, 30.0), 1)  # Spinning
                    else:
                        dev["power_w"] = 0.9 # Finished/Standby
                    dev["voltage_v"] = round(229.4 + random.uniform(-1.0, 1.0), 1)
                    dev["current_ma"] = round((dev["power_w"] / dev["voltage_v"]) * 1000, 0)

                elif dev_id == "demo-tv":
                    # Standby vampire demonstration (shows user ~6.5W vampire drain)
                    dev["power_w"] = round(6.5 + random.uniform(-0.4, 0.4), 1)
                    dev["voltage_v"] = round(232.0 + random.uniform(-0.5, 0.5), 1)
                    dev["current_ma"] = round((dev["power_w"] / dev["voltage_v"]) * 1000, 0)

                else:
                    # Generic plug
                    dev["power_w"] = round(max(0.0, dev.get("power_w", 50.0) + random.uniform(-2.0, 2.0)), 1)
                    dev["voltage_v"] = 230.0
                    dev["current_ma"] = round((dev["power_w"] / 230.0) * 1000, 0)

            # Update peak power
            if dev["power_w"] > dev.get("peak_power_w", 0.0):
                dev["peak_power_w"] = dev["power_w"]

            # Energy accumulation: dt hours * kW
            dt_hours = dt / 3600.0
            added_kwh = (dev["power_w"] / 1000.0) * dt_hours
            dev["energy_today_kwh"] = round(dev.get("energy_today_kwh", 0.0) + added_kwh, 4)
            dev["energy_total_kwh"] = round(dev.get("energy_total_kwh", 0.0) + added_kwh, 4)
            dev["last_seen"] = datetime.datetime.now().isoformat()

            save_device(dev)

            # Log to history periodically (every ~10 ticks or ~30s)
            if self.tick_counter % 6 == 0:
                cost = (dev["power_w"] / 1000.0) * kwh_price
                log_history_reading(dev_id, dev["power_w"], dev["energy_today_kwh"], round(cost, 5))
