import time
import hmac
import hashlib
import json
import logging
import requests
from typing import Optional, Dict, Any, List

logger = logging.getLogger("SmartWatt.Tuya")

class TuyaCloudClient:
    def __init__(self, access_id: str, access_secret: str, endpoint: str = "https://openapi.tuyaeu.com", uid: str = ""):
        self.access_id = access_id.strip()
        self.access_secret = access_secret.strip()
        self.endpoint = endpoint.strip().rstrip("/")
        self.uid = uid.strip()
        self.access_token = ""
        self.token_expire_time = 0

    def _calc_sign(self, method: str, path: str, params: Optional[Dict] = None, body: Optional[Dict] = None, token: str = "", t: str = "", nonce: str = "") -> str:
        # Build query string
        query_str = ""
        if params:
            sorted_keys = sorted(params.keys())
            query_str = "?" + "&".join(f"{k}={params[k]}" for k in sorted_keys)

        # Body SHA256
        if body:
            body_json = json.dumps(body)
            content_hash = hashlib.sha256(body_json.encode("utf-8")).hexdigest()
        else:
            content_hash = hashlib.sha256("".encode("utf-8")).hexdigest()

        # String to sign: METHOD\nSHA256\n\nURL
        url = path + query_str
        string_to_sign = f"{method.upper()}\n{content_hash}\n\n{url}"

        # Sign payload
        sign_payload = self.access_id + token + t + nonce + string_to_sign
        sign = hmac.new(
            self.access_secret.encode("utf-8"),
            sign_payload.encode("utf-8"),
            hashlib.sha256
        ).hexdigest().upper()

        return sign

    def get_token(self) -> bool:
        if self.access_token and time.time() < self.token_expire_time - 120:
            return True

        if not self.access_id or not self.access_secret:
            logger.warning("Tuya credentials missing.")
            return False

        t = str(int(time.time() * 1000))
        path = "/v1.0/token"
        params = {"grant_type": "1"}
        sign = self._calc_sign("GET", path, params, None, token="", t=t)

        headers = {
            "client_id": self.access_id,
            "sign": sign,
            "t": t,
            "sign_method": "HMAC-SHA256"
        }

        try:
            res = requests.get(f"{self.endpoint}{path}?grant_type=1", headers=headers, timeout=10)
            data = res.json()
            if data.get("success"):
                result = data["result"]
                self.access_token = result["access_token"]
                self.token_expire_time = time.time() + result.get("expire_time", 7200)
                logger.info("Tuya Token successfully obtained.")
                return True
            else:
                logger.error(f"Tuya Token request failed: {data.get('msg')} (Code {data.get('code')})")
                return False
        except Exception as e:
            logger.error(f"Tuya connection error: {e}")
            return False

    def request(self, method: str, path: str, params: Optional[Dict] = None, body: Optional[Dict] = None) -> Optional[Dict[str, Any]]:
        if not self.get_token():
            return None

        t = str(int(time.time() * 1000))
        sign = self._calc_sign(method, path, params, body, token=self.access_token, t=t)

        headers = {
            "client_id": self.access_id,
            "access_token": self.access_token,
            "sign": sign,
            "t": t,
            "sign_method": "HMAC-SHA256",
            "Content-Type": "application/json"
        }

        url = f"{self.endpoint}{path}"
        try:
            if method.upper() == "GET":
                res = requests.get(url, headers=headers, params=params, timeout=10)
            elif method.upper() == "POST":
                res = requests.post(url, headers=headers, json=body, timeout=10)
            elif method.upper() == "PUT":
                res = requests.put(url, headers=headers, json=body, timeout=10)
            else:
                return None
            return res.json()
        except Exception as e:
            logger.error(f"Error calling {path}: {e}")
            return None

    def get_devices(self) -> List[Dict[str, Any]]:
        """Fetch all devices linked to this user/project."""
        devices = []
        if self.uid:
            # Query devices by UID
            res = self.request("GET", f"/v1.0/users/{self.uid}/devices")
            if res and res.get("success"):
                devices = res.get("result", [])
        
        # If no UID specified or no devices found, try querying devices list
        if not devices:
            res = self.request("GET", "/v1.0/devices")
            if res and res.get("success"):
                devices = res.get("result", {}).get("list", [])
                
        return devices

    def get_device_status(self, device_id: str) -> Optional[Dict[str, Any]]:
        """Get live status values (DPS) for a device."""
        res = self.request("GET", f"/v1.0/devices/{device_id}/status")
        if res and res.get("success"):
            status_list = res.get("result", [])
            # Map code -> value
            status_map = {}
            for item in status_list:
                status_map[item.get("code")] = item.get("value")
            return status_map
        return None

    def send_command(self, device_id: str, commands: List[Dict[str, Any]]) -> bool:
        """Send command (e.g. switch on/off) to device."""
        res = self.request("POST", f"/v1.0/devices/{device_id}/commands", body={"commands": commands})
        if res and res.get("success"):
            return True
        logger.warning(f"Failed to send command to {device_id}: {res}")
        return False

    def parse_energy_status(self, status_map: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract Power (W), Voltage (V), Current (mA), and Switch state
        Standard Tuya Smart Plugs usually map:
        - switch_1 / switch: boolean
        - cur_power: integer (usually in 0.1W units or 1W)
        - cur_voltage: integer (usually in 0.1V units, e.g. 2300 = 230V)
        - cur_current: integer (in mA, e.g. 1500 = 1.5A)
        """
        is_on = True
        for key in ["switch_1", "switch", "1"]:
            if key in status_map:
                is_on = bool(status_map[key])
                break

        # Power in Watts
        raw_power = status_map.get("cur_power") or status_map.get("19") or 0.0
        # Typical Tuya format: 4000 = 400W (scaled by 10) or already float
        power_w = float(raw_power)
        if power_w > 10000:
            power_w = power_w / 10.0
        elif power_w > 0 and raw_power > 100:
            # Check if likely scaled by 10
            # If voltage is ~2300 and power is ~4000 for 400W:
            raw_v = float(status_map.get("cur_voltage") or status_map.get("20") or 0.0)
            if raw_v > 1000:
                power_w = power_w / 10.0

        # Voltage in Volts
        raw_v = float(status_map.get("cur_voltage") or status_map.get("20") or 2300.0)
        voltage_v = raw_v / 10.0 if raw_v > 1000 else (raw_v if raw_v > 0 else 230.0)

        # Current in mA
        raw_i = float(status_map.get("cur_current") or status_map.get("18") or 0.0)
        current_ma = raw_i

        return {
            "is_on": 1 if is_on else 0,
            "power_w": round(power_w, 1),
            "voltage_v": round(voltage_v, 1),
            "current_ma": round(current_ma, 0)
        }
