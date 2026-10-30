import asyncio
import datetime
import json
import logging
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from database import (
    init_db, get_all_settings, get_setting, update_setting,
    get_all_devices, get_device, save_device,
    get_recent_history, get_weekly_stats, log_history_reading, get_db
)
from simulator import DeviceSimulator
from tuya_client import TuyaCloudClient

# Official Tuya Device Sharing SDK (Home Assistant Standard QR Flow)
try:
    from tuya_sharing import LoginControl, Manager, CustomerApi
    TUYA_SHARING_AVAILABLE = True
except ImportError:
    TUYA_SHARING_AVAILABLE = False

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SmartWatt")

simulator = DeviceSimulator()
tuya_client: Optional[TuyaCloudClient] = None
sharing_manager: Optional[Any] = None
polling_active = True

TUYA_CLIENT_ID = "HA_3y9q4ak7g4ephrvke"
TUYA_SCHEMA = "haauthorize"

def get_configured_tuya_client() -> Optional[TuyaCloudClient]:
    access_id = get_setting("tuya_access_id", "")
    access_secret = get_setting("tuya_access_secret", "")
    endpoint = get_setting("tuya_endpoint", "https://openapi.tuyaeu.com")
    uid = get_setting("tuya_uid", "")
    if access_id and access_secret:
        return TuyaCloudClient(access_id, access_secret, endpoint, uid)
    return None

def get_configured_sharing_manager() -> Optional[Any]:
    global sharing_manager
    if sharing_manager is not None:
        return sharing_manager

    if not TUYA_SHARING_AVAILABLE:
        return None

    user_code = get_setting("tuya_user_code", "")
    terminal_id = get_setting("tuya_terminal_id", "")
    endpoint = get_setting("tuya_endpoint", "")
    token_json_str = get_setting("tuya_token_json", "")

    if user_code and terminal_id and token_json_str:
        try:
            token_info = json.loads(token_json_str)
            sharing_manager = Manager(TUYA_CLIENT_ID, user_code, terminal_id, endpoint, token_info)
            return sharing_manager
        except Exception as e:
            logger.error(f"Failed to re-initialize Tuya Sharing Manager: {e}")
    return None

async def background_poller():
    global polling_active
    logger.info("SmartWatt background poller started.")
    tick = 0
    while polling_active:
        try:
            sim_mode = get_setting("simulation_mode", "true").lower() == "true"
            kwh_price = float(get_setting("kwh_price", "0.34"))

            if sim_mode:
                simulator.update()
            else:
                # 1. Try modern QR Sharing Manager first
                mgr = get_configured_sharing_manager()
                if mgr:
                    try:
                        mgr.update_device_cache()
                        for dev_id, cust_dev in mgr.device_map.items():
                            existing = get_device(dev_id)
                            if existing and not existing.get("is_simulated"):
                                raw_status = cust_dev.status or {}
                                raw_power = float(raw_status.get("cur_power", 0.0))
                                power_w = (raw_power / 10.0) if raw_power > 5000 else raw_power
                                raw_v = float(raw_status.get("cur_voltage", 2300))
                                voltage_v = (raw_v / 10.0) if raw_v > 500 else raw_v
                                current_ma = float(raw_status.get("cur_current", 0.0))
                                is_on = 1 if raw_status.get("switch_1", True) else 0

                                existing["is_on"] = is_on
                                existing["power_w"] = power_w
                                existing["voltage_v"] = voltage_v
                                existing["current_ma"] = current_ma
                                existing["last_seen"] = datetime.datetime.now().isoformat()
                                if power_w > existing.get("peak_power_w", 0.0):
                                    existing["peak_power_w"] = power_w
                                save_device(existing)

                                if tick % 6 == 0:
                                    cost = (power_w / 1000.0) * kwh_price
                                    log_history_reading(dev_id, power_w, existing.get("energy_today_kwh", 0.0), cost)
                    except Exception as err:
                        logger.warning(f"Error polling via Tuya Sharing Manager: {err}")

                # 2. Or fallback to classic Tuya Developer Client
                else:
                    client = get_configured_tuya_client()
                    if client:
                        devices = get_all_devices()
                        for dev in devices:
                            if dev.get("is_simulated"):
                                continue
                            dev_id = dev["id"]
                            status = client.get_device_status(dev_id)
                            if status:
                                parsed = client.parse_energy_status(status)
                                dev["is_on"] = parsed["is_on"]
                                dev["power_w"] = parsed["power_w"]
                                dev["voltage_v"] = parsed["voltage_v"]
                                dev["current_ma"] = parsed["current_ma"]
                                dev["last_seen"] = datetime.datetime.now().isoformat()
                                if dev["power_w"] > dev.get("peak_power_w", 0.0):
                                    dev["peak_power_w"] = dev["power_w"]
                                save_device(dev)

                                if tick % 6 == 0:
                                    cost = (dev["power_w"] / 1000.0) * kwh_price
                                    log_history_reading(dev_id, dev["power_w"], dev.get("energy_today_kwh", 0.0), cost)

            tick += 1
        except Exception as e:
            logger.error(f"Error in poller: {e}")
        await asyncio.sleep(4)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global polling_active
    init_db()
    poller_task = asyncio.create_task(background_poller())
    yield
    polling_active = False
    poller_task.cancel()

app = FastAPI(title="SmartWatt", description="Smart Life Power & Cost Dashboard", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class SettingUpdate(BaseModel):
    settings: Dict[str, Any]

class DeviceToggle(BaseModel):
    is_on: Optional[bool] = None

class DeviceTimer(BaseModel):
    minutes: int

class DeviceEdit(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None

class TuyaCreds(BaseModel):
    access_id: str
    access_secret: str
    endpoint: Optional[str] = "https://openapi.tuyaeu.com"
    uid: Optional[str] = ""

class TuyaQRRequest(BaseModel):
    user_code: str

class TuyaQRPoll(BaseModel):
    token: str
    user_code: str

class JsonImportPayload(BaseModel):
    devices: List[Dict[str, Any]]

# API Endpoints
@app.get("/api/settings")
def api_get_settings():
    return get_all_settings()

@app.post("/api/settings")
def api_update_settings(data: SettingUpdate):
    for k, v in data.settings.items():
        update_setting(k, str(v))
    return {"status": "ok", "settings": get_all_settings()}

@app.get("/api/devices")
def api_get_devices():
    devices = get_all_devices()
    kwh_price = float(get_setting("kwh_price", "0.34"))
    standby_th = float(get_setting("standby_threshold_w", "12.0"))
    overload_th = float(get_setting("overload_threshold_w", "2500.0"))
    co2_factor = float(get_setting("co2_factor", "380.0"))

    enriched = []
    for d in devices:
        power = float(d.get("power_w", 0.0))
        is_on = bool(d.get("is_on", 1))
        energy_today = float(d.get("energy_today_kwh", 0.0))
        energy_total = float(d.get("energy_total_kwh", 0.0))

        burn_rate_h = (power / 1000.0) * kwh_price if is_on else 0.0
        cost_day_rate = burn_rate_h * 24.0
        cost_month_rate = cost_day_rate * 30.0
        cost_year_rate = cost_day_rate * 365.0

        cost_today = energy_today * kwh_price
        cost_total = energy_total * kwh_price
        co2_today_g = energy_today * co2_factor

        is_standby = is_on and (0.5 <= power <= standby_th)
        standby_annual_eur = ((power / 1000.0) * 24.0 * 365.0 * kwh_price) if is_standby else 0.0
        is_overloaded = power >= overload_th

        time_left_sec = 0
        if d.get("auto_off_target_time"):
            try:
                target = datetime.datetime.fromisoformat(d["auto_off_target_time"])
                diff = (target - datetime.datetime.now()).total_seconds()
                time_left_sec = max(0, int(diff))
            except Exception:
                pass

        enriched.append({
            **d,
            "burn_rate_eur_h": round(burn_rate_h, 4),
            "cost_day_rate_eur": round(cost_day_rate, 2),
            "cost_month_rate_eur": round(cost_month_rate, 2),
            "cost_year_rate_eur": round(cost_year_rate, 2),
            "cost_today_eur": round(cost_today, 2),
            "cost_total_eur": round(cost_total, 2),
            "co2_today_g": round(co2_today_g, 1),
            "is_standby": is_standby,
            "standby_annual_eur": round(standby_annual_eur, 2),
            "is_overloaded": is_overloaded,
            "timer_seconds_left": time_left_sec
        })

    return enriched

@app.get("/api/summary")
def api_get_summary():
    devices = api_get_devices()
    kwh_price = float(get_setting("kwh_price", "0.34"))
    co2_factor = float(get_setting("co2_factor", "380.0"))

    total_power = sum(d["power_w"] for d in devices if d["is_on"])
    total_burn_rate_h = (total_power / 1000.0) * kwh_price
    total_cost_day_rate = total_burn_rate_h * 24.0
    total_cost_month_rate = total_burn_rate_h * 24.0 * 30.0
    total_cost_year_rate = total_burn_rate_h * 24.0 * 365.0

    total_energy_today = sum(d["energy_today_kwh"] for d in devices)
    total_cost_today = total_energy_today * kwh_price
    total_co2_today_kg = (total_energy_today * co2_factor) / 1000.0

    standby_devices = [d for d in devices if d["is_standby"]]
    standby_potential_annual_eur = sum(d["standby_annual_eur"] for d in standby_devices)
    active_count = sum(1 for d in devices if d["is_on"] and d["power_w"] > 0.5)

    return {
        "total_power_w": round(total_power, 1),
        "total_burn_rate_eur_h": round(total_burn_rate_h, 4),
        "total_cost_day_rate_eur": round(total_cost_day_rate, 2),
        "total_cost_month_rate_eur": round(total_cost_month_rate, 2),
        "total_cost_year_rate_eur": round(total_cost_year_rate, 2),
        "total_energy_today_kwh": round(total_energy_today, 3),
        "total_cost_today_eur": round(total_cost_today, 2),
        "total_co2_today_kg": round(total_co2_today_kg, 2),
        "device_count": len(devices),
        "active_devices_count": active_count,
        "standby_vampire_count": len(standby_devices),
        "standby_potential_annual_eur": round(standby_potential_annual_eur, 2),
        "simulation_mode": get_setting("simulation_mode", "true").lower() == "true",
        "kwh_price": kwh_price
    }

@app.post("/api/devices/{device_id}/toggle")
def api_toggle_device(device_id: str, payload: Optional[DeviceToggle] = None):
    dev = get_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")

    new_state = 1 if (payload.is_on if payload and payload.is_on is not None else not dev["is_on"]) else 0
    dev["is_on"] = new_state
    if not new_state:
        dev["power_w"] = 0.0
        dev["current_ma"] = 0.0

    # If it's a real device, send command
    if not dev.get("is_simulated"):
        mgr = get_configured_sharing_manager()
        if mgr:
            try:
                mgr.send_commands(device_id, [{"code": "switch_1", "value": bool(new_state)}])
            except Exception as e:
                logger.error(f"Error sending command via Sharing Manager: {e}")
        else:
            client = get_configured_tuya_client()
            if client:
                client.send_command(device_id, [{"code": "switch_1", "value": bool(new_state)}])

    save_device(dev)
    return {"status": "ok", "id": device_id, "is_on": new_state}

@app.post("/api/devices/{device_id}/timer")
def api_set_timer(device_id: str, payload: DeviceTimer):
    dev = get_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")

    if payload.minutes <= 0:
        dev["auto_off_timer_min"] = 0
        dev["auto_off_target_time"] = None
    else:
        target = datetime.datetime.now() + datetime.timedelta(minutes=payload.minutes)
        dev["auto_off_timer_min"] = payload.minutes
        dev["auto_off_target_time"] = target.isoformat()

    save_device(dev)
    return {"status": "ok", "auto_off_timer_min": dev["auto_off_timer_min"]}

@app.delete("/api/devices/{device_id}")
def api_delete_device(device_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM devices WHERE id = ?", (device_id,))
    cursor.execute("DELETE FROM history WHERE device_id = ?", (device_id,))
    conn.commit()
    conn.close()
    return {"status": "ok", "deleted": device_id}

@app.get("/api/history")
def api_get_history(hours: int = 24, device_id: Optional[str] = None):
    return get_recent_history(hours, device_id)

@app.get("/api/weekly")
def api_get_weekly():
    return get_weekly_stats()

# ========================================================
# SUPER-EASY SMART LIFE QR CODE IMPORT FLOW
# ========================================================

@app.post("/api/tuya/qr-request")
def api_tuya_qr_request(req: TuyaQRRequest):
    if not TUYA_SHARING_AVAILABLE:
        raise HTTPException(status_code=500, detail="tuya-device-sharing-sdk ist nicht verfügbar.")

    user_code = req.user_code.strip()
    if not user_code:
        raise HTTPException(status_code=400, detail="Bitte gib deinen Benutzer-Code (User Code) aus der Smart Life App ein.")

    lc = LoginControl()
    res = lc.qr_code(TUYA_CLIENT_ID, TUYA_SCHEMA, user_code)

    if not res.get("success"):
        return JSONResponse(status_code=400, content={
            "status": "error",
            "message": res.get("msg", "Ungültiger Benutzer-Code. Bitte prüfe Groß-/Kleinschreibung in Smart Life.")
        })

    token = res.get("result", {}).get("qrcode")
    qr_data = f"tuyaSmart--qrLogin?token={token}"

    return {
        "status": "success",
        "token": token,
        "qr_data": qr_data,
        "qr_image_url": f"https://api.qrserver.com/v1/create-qr-code/?size=240x240&data={qr_data}&bgcolor=060911&color=10b981",
        "user_code": user_code
    }

@app.post("/api/tuya/qr-poll")
def api_tuya_qr_poll(req: TuyaQRPoll):
    global sharing_manager
    if not TUYA_SHARING_AVAILABLE:
        raise HTTPException(status_code=500, detail="tuya-device-sharing-sdk ist nicht verfügbar.")

    lc = LoginControl()
    success, info = lc.login_result(req.token, TUYA_CLIENT_ID, req.user_code)

    if not success:
        return {"status": "waiting", "message": info.get("msg", "Warten auf Scan...")}

    logger.info("Tuya Smart Life login successfully confirmed via QR scan!")
    terminal_id = info.get("terminal_id", "")
    endpoint = info.get("endpoint", "https://openapi.tuyaeu.com")

    # Persist credentials
    update_setting("tuya_user_code", req.user_code)
    update_setting("tuya_terminal_id", terminal_id)
    update_setting("tuya_endpoint", endpoint)
    update_setting("tuya_token_json", json.dumps(info))
    update_setting("simulation_mode", "false")

    # Initialize manager and query real devices
    sharing_manager = Manager(TUYA_CLIENT_ID, req.user_code, terminal_id, endpoint, info)
    sharing_manager.update_device_cache()

    imported_devices = []
    now = datetime.datetime.now().isoformat()

    for dev_id, dev in sharing_manager.device_map.items():
        raw_status = dev.status or {}
        raw_p = float(raw_status.get("cur_power", 0.0))
        power_w = (raw_p / 10.0) if raw_p > 5000 else raw_p
        raw_v = float(raw_status.get("cur_voltage", 2300))
        voltage_v = (raw_v / 10.0) if raw_v > 500 else raw_v
        current_ma = float(raw_status.get("cur_current", 0.0))
        is_on = 1 if raw_status.get("switch_1", True) else 0

        name_lower = dev.name.lower()
        category = "entertainment"
        if any(w in name_lower for w in ["küche", "kaffee", "fridge", "kühlschrank", "ofen", "wasser"]):
            category = "kitchen"
        elif any(w in name_lower for w in ["bad", "wasch", "trockner", "pumpe", "boiler", "heiz"]):
            category = "utility"

        new_dev = {
            "id": dev_id,
            "name": dev.name,
            "icon": "coffee" if category == "kitchen" else ("washing-machine" if category == "utility" else "plug"),
            "category": category,
            "room_name": "Smart Life",
            "is_on": is_on,
            "power_w": power_w,
            "voltage_v": voltage_v,
            "current_ma": current_ma,
            "energy_today_kwh": 0.0,
            "energy_total_kwh": 0.0,
            "peak_power_w": power_w,
            "auto_off_timer_min": 0,
            "auto_off_target_time": None,
            "last_seen": now,
            "is_simulated": 0
        }
        save_device(new_dev)
        imported_devices.append(new_dev)

    return {
        "status": "success",
        "imported": len(imported_devices),
        "devices": imported_devices
    }

# ========================================================
# JSON EXPORT & IMPORT (For Instant Sync Across Devices)
# ========================================================

@app.get("/api/devices/export-json")
def api_export_devices_json():
    devices = get_all_devices()
    settings = get_all_settings()
    return {
        "export_date": datetime.datetime.now().isoformat(),
        "settings": settings,
        "devices": devices
    }

@app.post("/api/devices/import-json")
def api_import_devices_json(payload: JsonImportPayload):
    imported_count = 0
    for dev in payload.devices:
        if not dev.get("id"):
            dev["id"] = f"plug-{int(datetime.datetime.now().timestamp()*1000)}"
        save_device(dev)
        imported_count += 1
    return {"status": "ok", "imported": imported_count}

# Legacy Tuya Developer API Endpoints
@app.post("/api/tuya/test")
def api_test_tuya(creds: TuyaCreds):
    client = TuyaCloudClient(creds.access_id, creds.access_secret, creds.endpoint or "https://openapi.tuyaeu.com", creds.uid or "")
    success = client.get_token()
    if not success:
        return JSONResponse(status_code=400, content={"status": "error", "message": "Tuya Verbindung fehlgeschlagen! Bitte Access ID und Secret prüfen."})
    
    devices = client.get_devices()
    return {
        "status": "success",
        "message": f"Verbindung erfolgreich! {len(devices)} Gerät(e) in Smart Life / Tuya gefunden.",
        "device_count": len(devices),
        "sample_devices": [{"id": d.get("id"), "name": d.get("name"), "product_name": d.get("product_name")} for d in devices[:5]]
    }

@app.post("/api/tuya/sync")
def api_sync_tuya():
    client = get_configured_tuya_client()
    if not client:
        raise HTTPException(status_code=400, detail="Keine Tuya Zugangsdaten in den Einstellungen hinterlegt.")

    devices_raw = client.get_devices()
    if not devices_raw:
        return {"status": "ok", "imported": 0, "message": "Keine neuen Geräte gefunden."}

    imported_count = 0
    now = datetime.datetime.now().isoformat()
    for d in devices_raw:
        dev_id = d.get("id")
        if not dev_id:
            continue
        existing = get_device(dev_id)
        if not existing:
            new_dev = {
                "id": dev_id,
                "name": d.get("name") or d.get("product_name") or f"Steckdose {dev_id[:6]}",
                "icon": "plug",
                "category": "tuya",
                "is_on": 1,
                "power_w": 0.0,
                "voltage_v": 230.0,
                "current_ma": 0.0,
                "energy_today_kwh": 0.0,
                "energy_total_kwh": 0.0,
                "peak_power_w": 0.0,
                "auto_off_timer_min": 0,
                "auto_off_target_time": None,
                "last_seen": now,
                "is_simulated": 0
            }
            save_device(new_dev)
            imported_count += 1

    return {"status": "ok", "imported": imported_count, "total_found": len(devices_raw)}

@app.post("/api/tuya/toggle-mode")
def api_toggle_mode():
    current = get_setting("simulation_mode", "true").lower() == "true"
    new_val = "false" if current else "true"
    update_setting("simulation_mode", new_val)
    return {"simulation_mode": new_val == "true"}

# Static Web App
STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
def serve_root():
    return FileResponse(STATIC_DIR / "index.html")

@app.get("/style.css")
def serve_css():
    return FileResponse(STATIC_DIR / "style.css")

@app.get("/app.js")
def serve_js():
    return FileResponse(STATIC_DIR / "app.js")

@app.get("/manifest.json")
def serve_manifest():
    return FileResponse(STATIC_DIR / "manifest.json")

@app.get("/sw.js")
def serve_sw():
    return FileResponse(STATIC_DIR / "sw.js")
