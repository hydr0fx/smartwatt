import sqlite3
import json
import os
import datetime
from pathlib import Path

DB_DIR = Path(__file__).parent / "data"
DB_PATH = DB_DIR / "smartwatt.db"

def get_db():
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Settings table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)

    # Devices table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT DEFAULT 'plug',
            category TEXT DEFAULT 'general',
            is_on INTEGER DEFAULT 1,
            power_w REAL DEFAULT 0.0,
            voltage_v REAL DEFAULT 230.0,
            current_ma REAL DEFAULT 0.0,
            energy_today_kwh REAL DEFAULT 0.0,
            energy_total_kwh REAL DEFAULT 0.0,
            peak_power_w REAL DEFAULT 0.0,
            auto_off_timer_min INTEGER DEFAULT 0,
            auto_off_target_time TEXT,
            last_seen TEXT,
            is_simulated INTEGER DEFAULT 0,
            custom_order INTEGER DEFAULT 0
        )
    """)

    # History readings (periodic snapshots)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            power_w REAL NOT NULL,
            energy_kwh REAL NOT NULL,
            cost_eur REAL NOT NULL,
            FOREIGN KEY (device_id) REFERENCES devices (id)
        )
    """)

    # Daily summarized stats
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_stats (
            date TEXT NOT NULL,
            device_id TEXT NOT NULL,
            energy_kwh REAL DEFAULT 0.0,
            cost_eur REAL DEFAULT 0.0,
            runtime_minutes INTEGER DEFAULT 0,
            peak_power_w REAL DEFAULT 0.0,
            PRIMARY KEY (date, device_id)
        )
    """)

    # Default settings
    default_settings = {
        "kwh_price": "0.34",                # 34 Cent / kWh
        "currency": "€",
        "base_fee_monthly": "0.0",          # Optional monthly base fee
        "co2_factor": "380",                # 380 g CO2 / kWh (German mix)
        "standby_threshold_w": "12.0",      # Watts below which device is in standby
        "overload_threshold_w": "2500.0",   # Watts threshold for warning
        "simulation_mode": "true",          # Starts in demo mode so user sees instant live data!
        "tuya_access_id": "",
        "tuya_access_secret": "",
        "tuya_endpoint": "https://openapi.tuyaeu.com",
        "tuya_uid": "",
        "poll_interval_sec": "5"
    }

    for key, val in default_settings.items():
        cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (key, val))

    # Seed demo devices if no devices exist
    cursor.execute("SELECT COUNT(*) FROM devices")
    if cursor.fetchone()[0] == 0:
        seed_demo_devices(cursor)

    conn.commit()
    conn.close()

def seed_demo_devices(cursor):
    now = datetime.datetime.now().isoformat()
    demo_devices = [
        {
            "id": "demo-gaming-pc",
            "name": "Gaming PC & Triple-Monitor",
            "icon": "monitor",
            "category": "entertainment",
            "is_on": 1,
            "power_w": 412.5,
            "voltage_v": 231.4,
            "current_ma": 1782.0,
            "energy_today_kwh": 2.45,
            "energy_total_kwh": 48.2,
            "peak_power_w": 580.0,
            "is_simulated": 1,
            "custom_order": 1
        },
        {
            "id": "demo-fridge",
            "name": "Kühlschrank (Küche)",
            "icon": "refrigerator",
            "category": "kitchen",
            "is_on": 1,
            "power_w": 78.4,
            "voltage_v": 230.8,
            "current_ma": 340.0,
            "energy_today_kwh": 0.88,
            "energy_total_kwh": 29.5,
            "peak_power_w": 140.0,
            "is_simulated": 1,
            "custom_order": 2
        },
        {
            "id": "demo-washing",
            "name": "Waschmaschine (Bad)",
            "icon": "washing-machine",
            "category": "utility",
            "is_on": 1,
            "power_w": 1850.0,
            "voltage_v": 229.6,
            "current_ma": 8057.0,
            "energy_today_kwh": 1.95,
            "energy_total_kwh": 84.1,
            "peak_power_w": 2150.0,
            "is_simulated": 1,
            "custom_order": 3
        },
        {
            "id": "demo-tv",
            "name": "Wohnzimmer TV & Soundbar",
            "icon": "tv",
            "category": "entertainment",
            "is_on": 1,
            "power_w": 6.8,  # In Standby to showcase vampire detector!
            "voltage_v": 232.0,
            "current_ma": 29.0,
            "energy_today_kwh": 0.32,
            "energy_total_kwh": 19.3,
            "peak_power_w": 135.0,
            "is_simulated": 1,
            "custom_order": 4
        }
    ]

    for d in demo_devices:
        cursor.execute("""
            INSERT INTO devices (
                id, name, icon, category, is_on, power_w, voltage_v, current_ma,
                energy_today_kwh, energy_total_kwh, peak_power_w, last_seen, is_simulated, custom_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            d["id"], d["name"], d["icon"], d["category"], d["is_on"],
            d["power_w"], d["voltage_v"], d["current_ma"], d["energy_today_kwh"],
            d["energy_total_kwh"], d["peak_power_w"], now, d["is_simulated"], d["custom_order"]
        ))

    # Generate synthetic 24h history for demo charts
    today = datetime.date.today()
    base_time = datetime.datetime.now() - datetime.timedelta(hours=24)
    for hour_offset in range(25):
        t = base_time + datetime.timedelta(hours=hour_offset)
        t_str = t.strftime("%Y-%m-%d %H:%M:%S")
        # PC
        pc_power = 380.0 + (hour_offset % 5) * 25.0 if 16 <= t.hour <= 23 else (4.0 if t.hour < 8 else 65.0)
        cursor.execute("INSERT INTO history (device_id, timestamp, power_w, energy_kwh, cost_eur) VALUES (?, ?, ?, ?, ?)",
                       ("demo-gaming-pc", t_str, pc_power, pc_power / 1000.0, (pc_power / 1000.0) * 0.34))
        # Fridge
        fridge_power = 85.0 if (hour_offset % 2 == 0) else 1.5
        cursor.execute("INSERT INTO history (device_id, timestamp, power_w, energy_kwh, cost_eur) VALUES (?, ?, ?, ?, ?)",
                       ("demo-fridge", t_str, fridge_power, fridge_power / 1000.0, (fridge_power / 1000.0) * 0.34))
        # TV
        tv_power = 120.0 if 19 <= t.hour <= 22 else 6.8
        cursor.execute("INSERT INTO history (device_id, timestamp, power_w, energy_kwh, cost_eur) VALUES (?, ?, ?, ?, ?)",
                       ("demo-tv", t_str, tv_power, tv_power / 1000.0, (tv_power / 1000.0) * 0.34))

    # Generate last 7 days stats
    for i in range(7):
        d_date = (today - datetime.timedelta(days=6 - i)).strftime("%Y-%m-%d")
        cursor.execute("INSERT OR REPLACE INTO daily_stats (date, device_id, energy_kwh, cost_eur, runtime_minutes, peak_power_w) VALUES (?, ?, ?, ?, ?, ?)",
                       (d_date, "demo-gaming-pc", round(2.1 + (i % 3) * 0.7, 2), round((2.1 + (i % 3) * 0.7) * 0.34, 2), 320, 520.0))
        cursor.execute("INSERT OR REPLACE INTO daily_stats (date, device_id, energy_kwh, cost_eur, runtime_minutes, peak_power_w) VALUES (?, ?, ?, ?, ?, ?)",
                       (d_date, "demo-fridge", round(0.85 + (i % 2) * 0.1, 2), round((0.85 + (i % 2) * 0.1) * 0.34, 2), 1440, 140.0))
        cursor.execute("INSERT OR REPLACE INTO daily_stats (date, device_id, energy_kwh, cost_eur, runtime_minutes, peak_power_w) VALUES (?, ?, ?, ?, ?, ?)",
                       (d_date, "demo-washing", round(1.6 if i in [2, 5] else 0.0, 2), round((1.6 if i in [2, 5] else 0.0) * 0.34, 2), 90 if i in [2, 5] else 0, 2150.0))
        cursor.execute("INSERT OR REPLACE INTO daily_stats (date, device_id, energy_kwh, cost_eur, runtime_minutes, peak_power_w) VALUES (?, ?, ?, ?, ?, ?)",
                       (d_date, "demo-tv", round(0.45 + (i % 3) * 0.15, 2), round((0.45 + (i % 3) * 0.15) * 0.34, 2), 240, 135.0))

def get_setting(key: str, default: str = "") -> str:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    return row["value"] if row else default

def get_all_settings() -> dict:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM settings")
    rows = cursor.fetchall()
    conn.close()
    return {row["key"]: row["value"] for row in rows}

def update_setting(key: str, value: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, str(value)))
    conn.commit()
    conn.close()

def get_all_devices():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM devices ORDER BY custom_order ASC, name ASC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_device(device_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM devices WHERE id = ?", (device_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def save_device(device: dict):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO devices (
            id, name, icon, category, is_on, power_w, voltage_v, current_ma,
            energy_today_kwh, energy_total_kwh, peak_power_w, auto_off_timer_min,
            auto_off_target_time, last_seen, is_simulated, custom_order
        ) VALUES (
            :id, :name, :icon, :category, :is_on, :power_w, :voltage_v, :current_ma,
            :energy_today_kwh, :energy_total_kwh, :peak_power_w, :auto_off_timer_min,
            :auto_off_target_time, :last_seen, :is_simulated, :custom_order
        )
    """, device)
    conn.commit()
    conn.close()

def log_history_reading(device_id: str, power_w: float, energy_kwh: float, cost_eur: float):
    conn = get_db()
    cursor = conn.cursor()
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        INSERT INTO history (device_id, timestamp, power_w, energy_kwh, cost_eur)
        VALUES (?, ?, ?, ?, ?)
    """, (device_id, now_str, power_w, energy_kwh, cost_eur))

    # Keep history bounded (e.g., max 5000 readings per device to prevent unlimited growth)
    cursor.execute("""
        DELETE FROM history WHERE id IN (
            SELECT id FROM history WHERE device_id = ? ORDER BY id DESC LIMIT -1 OFFSET 5000
        )
    """, (device_id,))

    conn.commit()
    conn.close()

def get_recent_history(hours: int = 24, device_id: str = None):
    conn = get_db()
    cursor = conn.cursor()
    since = (datetime.datetime.now() - datetime.timedelta(hours=hours)).strftime("%Y-%m-%d %H:%M:%S")

    if device_id:
        cursor.execute("""
            SELECT device_id, timestamp, power_w, energy_kwh, cost_eur
            FROM history
            WHERE timestamp >= ? AND device_id = ?
            ORDER BY timestamp ASC
        """, (since, device_id))
    else:
        cursor.execute("""
            SELECT device_id, timestamp, power_w, energy_kwh, cost_eur
            FROM history
            WHERE timestamp >= ?
            ORDER BY timestamp ASC
        """, (since,))

    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_weekly_stats():
    conn = get_db()
    cursor = conn.cursor()
    seven_days_ago = (datetime.date.today() - datetime.timedelta(days=6)).strftime("%Y-%m-%d")
    cursor.execute("""
        SELECT date, SUM(energy_kwh) as total_kwh, SUM(cost_eur) as total_cost
        FROM daily_stats
        WHERE date >= ?
        GROUP BY date
        ORDER BY date ASC
    """, (seven_days_ago,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]
