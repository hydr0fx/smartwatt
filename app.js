// SmartWatt - Apple iOS 18 Design Architecture
let isStandaloneMode = false;
let currentDevices = [];
let currentRoomFilter = 'all';
let currentSettings = {
  kwh_price: "0.34",
  standby_threshold_w: "12.0",
  overload_threshold_w: "2500.0",
  simulation_mode: "true",
  tuya_access_id: "",
  tuya_access_secret: "",
  tuya_endpoint: "https://openapi.tuyaeu.com",
  tuya_uid: ""
};

let activeTimerDeviceId = null;
let activeCalcDeviceId = null;
let activeSheetDeviceId = null;
let activeChartTab = 'power';
let powerChartInstance = null;
let distributionChartInstance = null;
let weeklyChartInstance = null;
let pollingTimer = null;
let tickCount = 0;
let isQuickPriceOpen = false;

// Default initial devices (Clean Smart Life Real-World Profiles)
const defaultInitialDevices = [
  {
    id: "demo-gaming-pc",
    name: "Gaming-PC & Setup",
    icon: "monitor",
    category: "entertainment",
    room: "entertainment",
    room_name: "Gaming & TV",
    is_on: 1,
    power_w: 408.0,
    voltage_v: 231.4,
    current_ma: 1763.0,
    energy_today_kwh: 2.45,
    energy_total_kwh: 48.2,
    peak_power_w: 580.0,
    is_simulated: 1,
    timer_seconds_left: 0,
    _saved_power_w: 408.0
  },
  {
    id: "demo-fridge",
    name: "Kühlschrank",
    icon: "refrigerator",
    category: "kitchen",
    room: "kitchen",
    room_name: "Küche",
    is_on: 1,
    power_w: 78.5,
    voltage_v: 230.8,
    current_ma: 340.0,
    energy_today_kwh: 0.88,
    energy_total_kwh: 29.5,
    peak_power_w: 140.0,
    is_simulated: 1,
    timer_seconds_left: 0,
    _saved_power_w: 78.5
  },
  {
    id: "demo-washing",
    name: "Waschmaschine",
    icon: "washing-machine",
    category: "utility",
    room: "utility",
    room_name: "Bad & Technik",
    is_on: 1,
    power_w: 1850.0,
    voltage_v: 229.6,
    current_ma: 8057.0,
    energy_today_kwh: 1.95,
    energy_total_kwh: 84.1,
    peak_power_w: 2150.0,
    is_simulated: 1,
    timer_seconds_left: 0,
    _saved_power_w: 1850.0
  },
  {
    id: "demo-tv",
    name: "Wohnzimmer TV & Soundbar",
    icon: "tv",
    category: "entertainment",
    room: "entertainment",
    room_name: "Gaming & TV",
    is_on: 1,
    power_w: 6.8, // Standby demonstration
    voltage_v: 232.0,
    current_ma: 29.0,
    energy_today_kwh: 0.32,
    energy_total_kwh: 19.3,
    peak_power_w: 135.0,
    is_simulated: 1,
    timer_seconds_left: 0,
    _saved_power_w: 6.8
  }
];

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW reg error:', err));
  }

  await checkBackendAvailability();
  await loadSettings();
  await updateAll(true);
  await initCharts();

  // Polling loop
  pollingTimer = setInterval(async () => {
    tickCount++;
    if (isStandaloneMode) {
      runStandaloneTick();
    }
    await updateAll(false);
  }, 3000);
});

async function checkBackendAvailability() {
  try {
    const res = await fetch('/api/summary', { method: 'GET', signal: AbortSignal.timeout(1200) });
    if (res.ok) {
      isStandaloneMode = false;
      return;
    }
  } catch (e) {}
  
  isStandaloneMode = true;

  const savedDevs = localStorage.getItem('smartwatt_devices_v4');
  if (savedDevs) {
    try {
      const parsed = JSON.parse(savedDevs);
      currentDevices = Array.isArray(parsed) && parsed.length > 0 ? parsed : JSON.parse(JSON.stringify(defaultInitialDevices));
    } catch (e) {
      currentDevices = JSON.parse(JSON.stringify(defaultInitialDevices));
    }
  } else {
    currentDevices = JSON.parse(JSON.stringify(defaultInitialDevices));
  }

  const savedSettings = localStorage.getItem('smartwatt_settings_v4');
  if (savedSettings) {
    try { Object.assign(currentSettings, JSON.parse(savedSettings)); } catch (e) {}
  }
}

// In-Browser Live Physics Simulation
function runStandaloneTick() {
  currentDevices.forEach(d => {
    if (d.timer_seconds_left > 0) {
      d.timer_seconds_left -= 3;
      if (d.timer_seconds_left <= 0) {
        d.timer_seconds_left = 0;
        d.is_on = 0;
        d._saved_power_w = d.power_w;
        d.power_w = 0.0;
        d.current_ma = 0.0;
      }
    }

    if (!d.is_on) {
      d.power_w = 0.0;
      d.current_ma = 0.0;
      d.voltage_v = 230.0 + (Math.random() * 0.4 - 0.2);
    } else {
      if (d.id === 'demo-gaming-pc') {
        const base = 405.0;
        const jitter = Math.sin(tickCount * 0.3) * 22.0 + (Math.random() * 10 - 5);
        d.power_w = Math.max(350.0, base + jitter);
        d.voltage_v = 231.2 + (Math.random() * 0.8 - 0.4);
      } else if (d.id === 'demo-fridge') {
        const phase = tickCount % 50;
        d.power_w = phase < 30 ? (78.0 + (Math.random() * 4 - 2)) : 1.2;
        d.voltage_v = 230.5;
      } else if (d.id === 'demo-washing') {
        const step = tickCount % 60;
        if (step < 20) d.power_w = 1920.0 + (Math.random() * 80 - 40);
        else if (step < 45) d.power_w = 340.0 + (Math.random() * 40 - 20);
        else d.power_w = 0.9;
        d.voltage_v = 229.4;
      } else if (d.id === 'demo-tv') {
        d.power_w = 6.8 + (Math.random() * 0.4 - 0.2);
        d.voltage_v = 232.0;
      } else {
        const p = d._saved_power_w || d.power_w || 100.0;
        d.power_w = Math.max(1.0, p + (Math.random() * 4 - 2));
        d.voltage_v = 230.0;
      }

      d._saved_power_w = d.power_w;
      d.current_ma = (d.power_w / d.voltage_v) * 1000.0;
      if (d.power_w > (d.peak_power_w || 0)) d.peak_power_w = d.power_w;

      const addedKwh = (d.power_w / 1000.0) * (3.0 / 3600.0);
      d.energy_today_kwh = (d.energy_today_kwh || 0.0) + addedKwh;
      d.energy_total_kwh = (d.energy_total_kwh || 0.0) + addedKwh;
    }
  });

  localStorage.setItem('smartwatt_devices_v4', JSON.stringify(currentDevices));
}

// Compute mathematically exact enriched stats
function enrichDevice(d) {
  const kwhPrice = parseFloat(currentSettings.kwh_price || '0.34');
  const standbyTh = parseFloat(currentSettings.standby_threshold_w || '12.0');
  const overloadTh = parseFloat(currentSettings.overload_threshold_w || '2500.0');

  const power = d.is_on ? (d.power_w || 0.0) : 0.0;
  
  const burnRateH = (power / 1000.0) * kwhPrice;
  const costDayRate = burnRateH * 24.0;
  const costMonthRate = costDayRate * 30.0;
  const costYearRate = costDayRate * 365.0;

  const costToday = (d.energy_today_kwh || 0.0) * kwhPrice;
  const costTotal = (d.energy_total_kwh || 0.0) * kwhPrice;

  const isStandby = Boolean(d.is_on && power >= 0.5 && power <= standbyTh);
  const standbyAnnual = isStandby ? ((power / 1000.0) * 24.0 * 365.0 * kwhPrice) : 0.0;
  const isOverloaded = power >= overloadTh;

  return {
    ...d,
    power_w: power,
    burn_rate_eur_h: burnRateH,
    cost_day_rate_eur: costDayRate,
    cost_month_rate_eur: costMonthRate,
    cost_year_rate_eur: costYearRate,
    cost_today_eur: costToday,
    cost_total_eur: costTotal,
    is_standby: isStandby,
    standby_annual_eur: standbyAnnual,
    is_overloaded: isOverloaded
  };
}

// Filter room categories
function filterRoom(room) {
  currentRoomFilter = room;
  
  ['all', 'entertainment', 'kitchen', 'utility'].forEach(r => {
    const btn = document.getElementById(`room-tab-${r}`);
    if (!btn) return;
    if (r === room) {
      btn.className = 'segmented-btn segmented-btn-active';
    } else {
      btn.className = 'segmented-btn';
    }
  });

  updateAll(true);
}

// Master Update Loop
async function updateAll(fullRebuild = false) {
  let devices = [];
  let summary = {};

  if (!isStandaloneMode) {
    try {
      const [devRes, sumRes] = await Promise.all([
        fetch('/api/devices'),
        fetch('/api/summary')
      ]);
      devices = await devRes.json();
      summary = await sumRes.json();
      currentDevices = devices;
    } catch (e) {
      isStandaloneMode = true;
    }
  }

  if (isStandaloneMode) {
    devices = currentDevices.map(enrichDevice);
    const kwhPrice = parseFloat(currentSettings.kwh_price || '0.34');
    const totalPower = devices.reduce((sum, d) => sum + (d.is_on ? d.power_w : 0), 0);
    const totalBurnRateH = (totalPower / 1000.0) * kwhPrice;
    const totalEnergyToday = devices.reduce((sum, d) => sum + (d.energy_today_kwh || 0), 0);
    const standbyDevs = devices.filter(d => d.is_standby);
    const activeCount = devices.filter(d => d.is_on && d.power_w > 0.5).length;

    summary = {
      total_power_w: totalPower,
      total_burn_rate_eur_h: totalBurnRateH,
      total_cost_day_rate_eur: totalBurnRateH * 24.0,
      total_cost_month_rate_eur: totalBurnRateH * 24.0 * 30.0,
      total_cost_today_eur: totalEnergyToday * kwhPrice,
      total_energy_today_kwh: totalEnergyToday,
      total_co2_today_kg: (totalEnergyToday * 380.0) / 1000.0,
      device_count: devices.length,
      active_devices_count: activeCount,
      standby_vampire_count: standbyDevs.length,
      standby_potential_annual_eur: standbyDevs.reduce((sum, d) => sum + d.standby_annual_eur, 0),
      simulation_mode: true
    };
  }

  // Update Top Hero Display
  const totalPowerEl = document.getElementById('kpi-total-power');
  if (totalPowerEl) totalPowerEl.textContent = Math.round(summary.total_power_w).toLocaleString('de-DE');

  const activeDetailEl = document.getElementById('kpi-active-devices-detail');
  if (activeDetailEl) activeDetailEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${summary.total_power_w > 0 ? 'bg-emerald-400' : 'bg-neutral-500'}"></span><span>${summary.active_devices_count} von ${summary.device_count} Steckdosen aktiv</span>`;

  const headerStatusEl = document.getElementById('header-sub-status');
  if (headerStatusEl) headerStatusEl.textContent = `${summary.active_devices_count} aktiv • ${Math.round(summary.total_power_w)} W`;

  const headerDot = document.getElementById('header-pulse-dot');
  if (headerDot) {
    headerDot.className = summary.total_power_w > 0 ? 'w-2 h-2 rounded-full bg-emerald-400 live-pulse shrink-0' : 'w-2 h-2 rounded-full bg-neutral-500 shrink-0';
  }

  const burnEl = document.getElementById('kpi-burn-rate-h');
  if (burnEl) burnEl.textContent = summary.total_burn_rate_eur_h.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const costDayEl = document.getElementById('kpi-cost-day');
  if (costDayEl) costDayEl.textContent = summary.total_cost_day_rate_eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const costMonthEl = document.getElementById('kpi-cost-month');
  if (costMonthEl) costMonthEl.textContent = `Monat: ${summary.total_cost_month_rate_eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  const costTodayEl = document.getElementById('kpi-cost-today');
  if (costTodayEl) costTodayEl.textContent = summary.total_cost_today_eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const kwhTodayEl = document.getElementById('kpi-kwh-today');
  if (kwhTodayEl) kwhTodayEl.textContent = `${summary.total_energy_today_kwh.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh`;

  // Standby Hero Bar
  const vampireHeroBar = document.getElementById('hero-vampire-alert');
  if (vampireHeroBar) {
    if (summary.standby_vampire_count > 0) {
      vampireHeroBar.classList.remove('hidden');
      document.getElementById('kpi-vampire-count').textContent = summary.standby_vampire_count;
      document.getElementById('kpi-vampire-savings').textContent = `~${summary.standby_potential_annual_eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € / Jahr`;
    } else {
      vampireHeroBar.classList.add('hidden');
    }
  }

  // Filter devices by selected room
  let filteredDevices = devices;
  if (currentRoomFilter !== 'all') {
    filteredDevices = devices.filter(d => {
      const matchRoom = (d.room && d.room === currentRoomFilter);
      const matchCategory = (d.category && d.category === currentRoomFilter);
      if (currentRoomFilter === 'entertainment') {
        return matchRoom || matchCategory || d.id.includes('pc') || d.id.includes('tv');
      }
      if (currentRoomFilter === 'kitchen') {
        return matchRoom || matchCategory || d.id.includes('fridge');
      }
      if (currentRoomFilter === 'utility') {
        return matchRoom || matchCategory || d.id.includes('washing');
      }
      return matchRoom || matchCategory;
    });
  }

  updateModeBadge(isStandaloneMode || summary.simulation_mode);
  renderDeviceGrid(filteredDevices, fullRebuild);

  const roomAllBtn = document.getElementById('room-tab-all');
  if (roomAllBtn) roomAllBtn.textContent = `Alle (${devices.length})`;

  if (distributionChartInstance && activeChartTab === 'distribution') {
    updateDistributionChart(false);
  }
}

function updateModeBadge(isSimulation) {
  const badge = document.getElementById('mode-badge');
  if (!badge) return;
  if (isSimulation) {
    badge.textContent = isStandaloneMode ? 'Demo' : 'Demo Modus';
    badge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0';
  } else {
    badge.textContent = 'Live Tuya';
    badge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 shrink-0';
  }
}

// Render Apple Home Appliance Tiles
function renderDeviceGrid(devices, fullRebuild) {
  const container = document.getElementById('devices-container');
  if (!container) return;

  if (fullRebuild || container.children.length !== devices.length) {
    container.innerHTML = devices.length > 0 
      ? devices.map(d => createDeviceCardHtml(d)).join('')
      : `<div class="col-span-full py-12 text-center text-neutral-400 apple-glass"><i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-neutral-500"></i><p>Keine Steckdosen in diesem Raum vorhanden.</p></div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  devices.forEach(d => {
    const card = document.getElementById(`dev-card-${d.id}`);
    if (!card) return;

    if (d.is_on) {
      card.classList.add('tile-on');
      card.classList.remove('tile-off');
    } else {
      card.classList.add('tile-off');
      card.classList.remove('tile-on');
    }

    const iconBox = card.querySelector('.tile-icon-box');
    if (iconBox) {
      iconBox.className = `tile-icon-box ${d.is_on ? 'tile-icon-box-on' : 'tile-icon-box-off'}`;
    }

    const powerEl = card.querySelector('.dev-power-value');
    if (powerEl) {
      powerEl.textContent = d.is_on ? Math.round(d.power_w).toLocaleString('de-DE') : '0';
      powerEl.className = `dev-power-value text-2xl font-black font-mono tracking-tight ${d.is_on ? 'text-white' : 'text-neutral-500'}`;
    }

    const burnEl = card.querySelector('.dev-burn-rate');
    if (burnEl) {
      burnEl.textContent = d.is_on ? `${d.burn_rate_eur_h.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} €/h` : '0,000 €/h';
      burnEl.className = `dev-burn-rate text-[11px] font-mono font-semibold ${d.is_on ? 'text-emerald-400' : 'text-neutral-500'}`;
    }

    const switchEl = card.querySelector('.dev-switch-input');
    if (switchEl && switchEl.checked !== Boolean(d.is_on)) {
      switchEl.checked = Boolean(d.is_on);
    }
  });
}

function createDeviceCardHtml(d) {
  const icon = d.icon || 'plug';
  const tileStateClass = d.is_on ? 'tile-on' : 'tile-off';
  const iconStateClass = d.is_on ? 'tile-icon-box-on' : 'tile-icon-box-off';

  return `
    <div id="dev-card-${d.id}" class="apple-tile ${tileStateClass}" onclick="openDeviceSheet('${d.id}')">
      <!-- Top Row: Icon Badge & Tactile Apple Switch -->
      <div class="flex items-center justify-between mb-3.5">
        <div class="tile-icon-box ${iconStateClass}">
          <i data-lucide="${icon}" class="w-5 h-5"></i>
        </div>
        <div onclick="event.stopPropagation()">
          <label class="switch" title="Umschalten">
            <input type="checkbox" class="dev-switch-input" ${d.is_on ? 'checked' : ''} onchange="toggleDevice('${d.id}', this.checked)">
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <!-- Middle: Name & Room Subtitle -->
      <div class="space-y-0.5">
        <h3 class="text-sm sm:text-base font-bold text-white tracking-tight truncate">${d.name}</h3>
        <p class="text-[11px] text-neutral-400 font-medium truncate">${d.room_name || d.category || 'Smart Life'}</p>
      </div>

      <!-- Bottom: Live Wattage & Cost Rate -->
      <div class="mt-4 pt-3 border-t border-white/[0.06] flex items-baseline justify-between">
        <div class="flex items-baseline gap-1">
          <span class="dev-power-value text-2xl font-black font-mono tracking-tight ${d.is_on ? 'text-white' : 'text-neutral-500'}">
            ${d.is_on ? Math.round(d.power_w).toLocaleString('de-DE') : '0'}
          </span>
          <span class="text-xs font-semibold text-neutral-500">W</span>
        </div>
        <span class="dev-burn-rate text-[11px] font-mono font-semibold ${d.is_on ? 'text-emerald-400' : 'text-neutral-500'}">
          ${d.is_on ? (d.burn_rate_eur_h.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' €/h') : '0,000 €/h'}
        </span>
      </div>
    </div>
  `;
}

// APPLE DEVICE INSPECTOR SHEET (MODAL)
function openDeviceSheet(deviceId) {
  activeSheetDeviceId = deviceId;
  const dev = currentDevices.find(d => d.id === deviceId);
  if (!dev) return;

  const enriched = enrichDevice(dev);

  document.getElementById('sheet-dev-name').textContent = enriched.name;
  document.getElementById('sheet-dev-room').textContent = enriched.room_name || enriched.category || 'Smart Life';
  
  const statusBadge = document.getElementById('sheet-dev-status-badge');
  if (statusBadge) {
    statusBadge.textContent = enriched.is_on ? 'Aktiv (Eingeschaltet)' : 'Ausgeschaltet';
    statusBadge.className = enriched.is_on ? 'text-[10px] font-semibold text-emerald-400 font-mono' : 'text-[10px] font-semibold text-neutral-500 font-mono';
  }

  const iconEl = document.getElementById('sheet-icon');
  if (iconEl) iconEl.setAttribute('data-lucide', enriched.icon || 'plug');

  const wattVal = document.getElementById('sheet-watt-value');
  if (wattVal) wattVal.textContent = enriched.is_on ? Math.round(enriched.power_w).toLocaleString('de-DE') : '0';

  const sheetSwitch = document.getElementById('sheet-switch');
  if (sheetSwitch) sheetSwitch.checked = Boolean(enriched.is_on);

  const teleV = document.getElementById('sheet-tele-v');
  if (teleV) teleV.textContent = `${(enriched.voltage_v || 230).toFixed(1).replace('.', ',')} V`;

  const teleA = document.getElementById('sheet-tele-a');
  if (teleA) teleA.textContent = enriched.current_ma > 1000 ? `${(enriched.current_ma / 1000).toFixed(2).replace('.', ',')} A` : `${Math.round(enriched.current_ma || 0)} mA`;

  const telePeak = document.getElementById('sheet-tele-peak');
  if (telePeak) telePeak.textContent = `${Math.round(enriched.peak_power_w || 0)} W`;

  const teleKwh = document.getElementById('sheet-tele-kwh');
  if (teleKwh) teleKwh.textContent = `${(enriched.energy_today_kwh || 0).toFixed(2).replace('.', ',')} kWh`;

  // Period rates
  const rH = document.getElementById('sheet-rate-h');
  if (rH) rH.textContent = enriched.is_on ? `${enriched.burn_rate_eur_h.toFixed(3).replace('.', ',')} €` : '0,000 €';

  const rD = document.getElementById('sheet-rate-d');
  if (rD) rD.textContent = enriched.is_on ? `${enriched.cost_day_rate_eur.toFixed(2).replace('.', ',')} €` : '0,00 €';

  const rM = document.getElementById('sheet-rate-m');
  if (rM) rM.textContent = enriched.is_on ? `${enriched.cost_month_rate_eur.toFixed(2).replace('.', ',')} €` : '0,00 €';

  const rY = document.getElementById('sheet-rate-y');
  if (rY) rY.textContent = enriched.is_on ? `${enriched.cost_year_rate_eur.toFixed(2).replace('.', ',')} €` : '0,00 €';

  document.getElementById('device-sheet-modal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeDeviceSheetModal() {
  activeSheetDeviceId = null;
  document.getElementById('device-sheet-modal').classList.add('hidden');
}

function toggleDeviceFromSheet(checked) {
  if (activeSheetDeviceId) {
    toggleDevice(activeSheetDeviceId, checked);
    setTimeout(() => openDeviceSheet(activeSheetDeviceId), 60);
  }
}

function openCalcModalFromSheet() {
  const id = activeSheetDeviceId;
  closeDeviceSheetModal();
  if (id) openCalcModal(id);
}

function openTimerModalFromSheet() {
  const dev = currentDevices.find(d => d.id === activeSheetDeviceId);
  const id = activeSheetDeviceId;
  closeDeviceSheetModal();
  if (dev && id) openTimerModal(id, dev.name);
}

function deleteDeviceFromSheet() {
  const id = activeSheetDeviceId;
  closeDeviceSheetModal();
  if (id) deleteDevice(id);
}

// ZERO-LATENCY TOGGLE FUNCTION
async function toggleDevice(deviceId, targetState) {
  const dev = currentDevices.find(d => d.id === deviceId);
  if (!dev) return;

  dev.is_on = targetState ? 1 : 0;
  if (!dev.is_on) {
    dev._saved_power_w = dev.power_w > 0 ? dev.power_w : (dev._saved_power_w || 100);
    dev.power_w = 0.0;
    dev.current_ma = 0.0;
  } else {
    dev.power_w = dev._saved_power_w && dev._saved_power_w > 0 ? dev._saved_power_w : (
      dev.id === 'demo-gaming-pc' ? 408.0 : (
      dev.id === 'demo-fridge' ? 78.5 : (
      dev.id === 'demo-washing' ? 1850.0 : 6.8
    )));
    dev.voltage_v = 230.5;
    dev.current_ma = (dev.power_w / dev.voltage_v) * 1000.0;
  }

  if (isStandaloneMode) {
    localStorage.setItem('smartwatt_devices_v4', JSON.stringify(currentDevices));
  }
  await updateAll(false);

  if (!isStandaloneMode) {
    fetch(`/api/devices/${deviceId}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_on: targetState })
    }).catch(err => console.error('Background toggle error:', err));
  }
}

// BATCH TOGGLE ALL
async function toggleAllDevices() {
  const anyOn = currentDevices.some(d => d.is_on);
  const targetState = !anyOn;

  currentDevices.forEach(d => {
    d.is_on = targetState ? 1 : 0;
    if (!d.is_on) {
      d._saved_power_w = d.power_w > 0 ? d.power_w : (d._saved_power_w || 100);
      d.power_w = 0.0;
      d.current_ma = 0.0;
    } else {
      d.power_w = d._saved_power_w && d._saved_power_w > 0 ? d._saved_power_w : (
        d.id === 'demo-gaming-pc' ? 408.0 : (
        d.id === 'demo-fridge' ? 78.5 : (
        d.id === 'demo-washing' ? 1850.0 : 6.8
      )));
      d.current_ma = (d.power_w / 230.0) * 1000.0;
    }
  });

  if (isStandaloneMode) {
    localStorage.setItem('smartwatt_devices_v4', JSON.stringify(currentDevices));
  }
  await updateAll(false);

  if (!isStandaloneMode) {
    for (const d of currentDevices) {
      fetch(`/api/devices/${d.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_on: targetState })
      }).catch(e => {});
    }
  }
}

function turnOffStandbyDevices() {
  const standbyTh = parseFloat(currentSettings.standby_threshold_w || '12.0');
  currentDevices.forEach(d => {
    if (d.is_on && d.power_w >= 0.5 && d.power_w <= standbyTh) {
      toggleDevice(d.id, false);
    }
  });
}

// ADD MANUAL PLUG
function openAddDeviceModal() {
  document.getElementById('add-device-modal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeAddDeviceModal() {
  document.getElementById('add-device-modal').classList.add('hidden');
}

function submitNewDevice() {
  const name = document.getElementById('add-dev-name').value.trim() || 'Smarte Steckdose';
  const category = document.getElementById('add-dev-category').value;
  const power = parseFloat(document.getElementById('add-dev-power').value) || 120.0;

  const roomNames = {
    'entertainment': 'Gaming & TV',
    'kitchen': 'Küche',
    'utility': 'Bad & Technik',
    'general': 'Wohnzimmer'
  };

  const newDev = {
    id: `plug-${Date.now()}`,
    name: name,
    icon: category === 'kitchen' ? 'coffee' : (category === 'utility' ? 'washing-machine' : 'plug'),
    category: category,
    room: category,
    room_name: roomNames[category] || 'Smart Life',
    is_on: 1,
    power_w: power,
    voltage_v: 230.0,
    current_ma: (power / 230.0) * 1000.0,
    energy_today_kwh: 0.1,
    energy_total_kwh: 0.5,
    peak_power_w: power,
    is_simulated: 1,
    timer_seconds_left: 0,
    _saved_power_w: power
  };

  currentDevices.push(newDev);
  if (isStandaloneMode) {
    localStorage.setItem('smartwatt_devices_v4', JSON.stringify(currentDevices));
  }
  closeAddDeviceModal();
  updateAll(true);
}

// DELETE DEVICE
function deleteDevice(deviceId) {
  const dev = currentDevices.find(d => d.id === deviceId);
  if (!dev) return;
  if (!confirm(`Möchtest du "${dev.name}" wirklich aus SmartWatt entfernen?`)) return;

  currentDevices = currentDevices.filter(d => d.id !== deviceId);
  if (isStandaloneMode) {
    localStorage.setItem('smartwatt_devices_v4', JSON.stringify(currentDevices));
  }
  updateAll(true);
}

// RESET TO DEFAULT
function resetToDefaultDevices() {
  if (!confirm('Möchtest du alle Steckdosen auf die Standard-Demogeräte zurücksetzen?')) return;
  currentDevices = JSON.parse(JSON.stringify(defaultInitialDevices));
  currentSettings.kwh_price = "0.34";
  if (isStandaloneMode) {
    localStorage.setItem('smartwatt_devices_v4', JSON.stringify(currentDevices));
    localStorage.setItem('smartwatt_settings_v4', JSON.stringify(currentSettings));
  }
  closeSettingsModal();
  loadSettings();
  updateAll(true);
}

// QUICK PRICE BAR
function toggleQuickPriceBar() {
  const bar = document.getElementById('quick-price-bar');
  isQuickPriceOpen = !isQuickPriceOpen;
  if (isQuickPriceOpen) {
    bar.classList.remove('hidden');
  } else {
    bar.classList.add('hidden');
  }
}

function onQuickPriceChange(newPriceVal) {
  const num = parseFloat(newPriceVal);
  if (isNaN(num) || num <= 0) return;

  currentSettings.kwh_price = num.toFixed(2);
  document.getElementById('header-price-display').textContent = `${num.toFixed(2).replace('.', ',')} €/kWh`;
  document.getElementById('quick-price-slider').value = num.toFixed(2);
  document.getElementById('quick-price-label').textContent = `${num.toFixed(2).replace('.', ',')} €`;
  document.getElementById('setting-kwh-price').value = num.toFixed(2);

  if (isStandaloneMode) {
    localStorage.setItem('smartwatt_settings_v4', JSON.stringify(currentSettings));
  }

  updateAll(false);
}

// PERIOD COST CALCULATOR
function openCalcModal(deviceId) {
  activeCalcDeviceId = deviceId;
  const dev = currentDevices.find(d => d.id === deviceId);
  if (!dev) return;

  const currentW = dev.is_on ? Math.round(dev.power_w) : Math.round(dev._saved_power_w || 400);
  const currentPrice = parseFloat(currentSettings.kwh_price || '0.34');

  document.getElementById('calc-watt-input').value = currentW > 0 ? currentW : 400;
  document.getElementById('calc-price-input').value = currentPrice.toFixed(2);
  document.getElementById('calc-modal').classList.remove('hidden');

  recalculateCustomCalc();
  if (window.lucide) lucide.createIcons();
}

function closeCalcModal() {
  activeCalcDeviceId = null;
  document.getElementById('calc-modal').classList.add('hidden');
}

function recalculateCustomCalc() {
  const w = parseFloat(document.getElementById('calc-watt-input').value) || 0;
  const price = parseFloat(document.getElementById('calc-price-input').value) || 0;
  const hoursDaily = parseFloat(document.getElementById('calc-hours-slider').value) || 4;

  document.getElementById('calc-slider-hours-label').textContent = `${hoursDaily.toFixed(1).replace('.', ',')} Stunden / Tag`;

  const kwhPerHour = w / 1000.0;
  const costPerHour = kwhPerHour * price;

  const intervals = [
    { id: '1h', hours: 1 },
    { id: '4h', hours: 4 },
    { id: '1d', hours: 24 },
    { id: '1w', hours: 24 * 7 },
    { id: '1m', hours: 24 * 30 },
    { id: '1y', hours: 24 * 365 }
  ];

  intervals.forEach(item => {
    const cost = costPerHour * item.hours;
    const kwh = kwhPerHour * item.hours;
    const resEl = document.getElementById(`calc-res-${item.id}`);
    const kwhEl = document.getElementById(`calc-kwh-${item.id}`);

    if (resEl) {
      resEl.textContent = (item.hours >= 24 
        ? cost.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : cost.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })) + ' €';
    }
    if (kwhEl) {
      kwhEl.textContent = kwh.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kWh';
    }
  });

  const customDayCost = costPerHour * hoursDaily;
  const customMonthCost = customDayCost * 30.0;
  const customYearCost = customDayCost * 365.0;

  document.getElementById('calc-custom-day').textContent = customDayCost.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  document.getElementById('calc-custom-month').textContent = customMonthCost.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  document.getElementById('calc-custom-year').textContent = customYearCost.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// Timer Modal
function openTimerModal(deviceId, deviceName) {
  activeTimerDeviceId = deviceId;
  document.getElementById('timer-modal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeTimerModal() {
  activeTimerDeviceId = null;
  document.getElementById('timer-modal').classList.add('hidden');
}

async function applyTimer(minutes) {
  if (!activeTimerDeviceId) return;

  const dev = currentDevices.find(d => d.id === activeTimerDeviceId);
  if (dev) {
    dev.timer_seconds_left = minutes * 60;
    if (isStandaloneMode) {
      localStorage.setItem('smartwatt_devices_v4', JSON.stringify(currentDevices));
    }
    closeTimerModal();
    await updateAll(false);
  }

  if (!isStandaloneMode) {
    fetch(`/api/devices/${activeTimerDeviceId}/timer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes })
    }).catch(e => {});
  }
}

function openIOSInstallModal() {
  const modal = document.getElementById('ios-install-modal');
  if (modal) modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeIOSInstallModal() {
  const modal = document.getElementById('ios-install-modal');
  if (modal) modal.classList.add('hidden');
}

// Settings & Tuya Modal
function openSettingsModal(targetSection = '') {
  document.getElementById('settings-modal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
  const resBox = document.getElementById('qr-result-box');
  if (resBox) resBox.classList.add('hidden');
}

async function loadSettings() {
  if (!isStandaloneMode) {
    try {
      const res = await fetch('/api/settings');
      currentSettings = await res.json();
    } catch (e) {
      isStandaloneMode = true;
    }
  }

  const price = parseFloat(currentSettings.kwh_price || '0.34');
  document.getElementById('header-price-display').textContent = `${price.toFixed(2).replace('.', ',')} €/kWh`;
  document.getElementById('quick-price-slider').value = price.toFixed(2);
  document.getElementById('quick-price-label').textContent = `${price.toFixed(2).replace('.', ',')} €`;
  document.getElementById('setting-kwh-price').value = price;
  document.getElementById('setting-standby-th').value = currentSettings.standby_threshold_w || '12.0';
}

async function saveSettings() {
  const kwhPrice = document.getElementById('setting-kwh-price').value;
  const standbyTh = document.getElementById('setting-standby-th').value;

  currentSettings.kwh_price = kwhPrice;
  currentSettings.standby_threshold_w = standbyTh;

  if (isStandaloneMode) {
    localStorage.setItem('smartwatt_settings_v4', JSON.stringify(currentSettings));
  } else {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: currentSettings })
      });
    } catch (e) {
      localStorage.setItem('smartwatt_settings_v4', JSON.stringify(currentSettings));
    }
  }

  closeSettingsModal();
  await loadSettings();
  await updateAll(true);
}

// SMART LIFE QR CODE IMPORT FLOW (Home Assistant Standard)
let qrPollInterval = null;

async function requestTuyaQRCode() {
  const userCodeInput = document.getElementById('qr-user-code-input');
  const userCode = userCodeInput ? userCodeInput.value.trim() : '';
  const resultBox = document.getElementById('qr-result-box');
  const displayBox = document.getElementById('qr-display-box');
  const qrImage = document.getElementById('qr-code-image');
  const qrStatusText = document.getElementById('qr-status-text');

  if (!userCode) {
    if (resultBox) {
      resultBox.classList.remove('hidden');
      resultBox.className = 'text-xs p-3 rounded-xl border bg-rose-950/40 text-rose-300 border-rose-800 font-mono';
      resultBox.textContent = '✕ Bitte gib deinen Benutzer-Code ein (in Smart Life: Profil ➔ ⚙️ Einstellungen ➔ Konto & Sicherheit ➔ Benutzer-Code).';
    }
    return;
  }

  if (resultBox) resultBox.classList.add('hidden');
  if (qrPollInterval) clearInterval(qrPollInterval);

  // If in standalone mode (hosted on GitHub Pages without local backend)
  if (isStandaloneMode) {
    if (resultBox) {
      resultBox.classList.remove('hidden');
      resultBox.className = 'text-xs p-3.5 rounded-xl border bg-amber-950/40 text-amber-200 border-amber-800/60 leading-relaxed';
      resultBox.innerHTML = `
        <div class="space-y-2">
          <div class="font-bold text-amber-300 flex items-center gap-1.5">
            <i data-lucide="info" class="w-4 h-4 shrink-0"></i>
            <span>Wichtiger Hinweis zur Online-Webseite:</span>
          </div>
          <p>
            Tuya blockiert direkte Cloud-Verbindungen von statischen Webseiten im Browser (CORS-Schutz). Deshalb führt ein Scan auf der Online-Webseite zu <em>"illegal param error"</em>.
          </p>
          <div class="p-2.5 rounded-lg bg-black/40 border border-white/10 space-y-1 text-slate-300">
            <strong>So funktioniert der echte QR-Scan fehlerfrei:</strong>
            <p>1. Öffne auf deinem PC die Datei <strong>start.bat</strong> im Ordner <code>C:\\Users\\HydroFX\\Downloads\\Software\\SmartWatt</code>.</p>
            <p>2. Öffne im Browser <strong>http://localhost:8000</strong>.</p>
            <p>3. Trage deinen Benutzer-Code ein – dort wird der echte Tuya-Token generiert und deine Steckdosen sofort importiert!</p>
          </div>
          <p class="text-xs text-neutral-400">
            Auf dieser Online-Seite kannst du unten sofort die <strong>1-Klick Schnell-Vorlagen</strong> nutzen oder Geräte manuell anlegen.
          </p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
    }
    return;
  }

  // Live Backend flow: call /api/tuya/qr-request
  try {
    const res = await fetch('/api/tuya/qr-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_code: userCode })
    });
    const data = await res.json();

    if (!res.ok || data.status !== 'success') {
      if (resultBox) {
        resultBox.classList.remove('hidden');
        resultBox.className = 'text-xs p-3 rounded-xl border bg-rose-950/40 text-rose-300 border-rose-800 font-mono';
        resultBox.textContent = `✕ ${data.message || 'Fehler beim Erzeugen des QR-Codes. Bitte prüfe Groß-/Kleinschreibung deines Benutzer-Codes!'}`;
      }
      return;
    }

    if (displayBox && qrImage) {
      qrImage.src = data.qr_image_url;
      displayBox.classList.remove('hidden');
      if (qrStatusText) {
        qrStatusText.innerHTML = `
          <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 live-pulse"></span>
          <span>Warten auf Scan in deiner Smart Life App...</span>
        `;
      }
    }

    const token = data.token;
    qrPollInterval = setInterval(async () => {
      try {
        const pollRes = await fetch('/api/tuya/qr-poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token, user_code: userCode })
        });
        const pollData = await pollRes.json();

        if (pollData.status === 'success') {
          clearInterval(qrPollInterval);
          if (qrStatusText) {
            qrStatusText.innerHTML = `
              <span class="text-emerald-400 font-bold">✓ Scan erfolgreich bestätigt! ${pollData.imported} Steckdose(n) importiert!</span>
            `;
          }
          setTimeout(async () => {
            closeSettingsModal();
            await updateAll(true);
          }, 1500);
        }
      } catch (err) {
        console.error('QR Poll error:', err);
      }
    }, 2500);

  } catch (err) {
    if (resultBox) {
      resultBox.classList.remove('hidden');
      resultBox.className = 'text-xs p-3 rounded-xl border bg-rose-950/40 text-rose-300 border-rose-800 font-mono';
      resultBox.textContent = `✕ Verbindungsfehler: ${err.message}`;
    }
  }
}

// 1-KLICK SCHNELL-VORLAGEN (PRESETS)
function addPresetDevice(name, category, power, icon) {
  const roomNames = {
    'entertainment': 'Gaming & TV',
    'kitchen': 'Küche',
    'utility': 'Bad & Technik',
    'general': 'Wohnzimmer'
  };

  const newDev = {
    id: `preset-${Date.now()}-${Math.floor(Math.random()*1000)}`,
    name: name,
    icon: icon || 'plug',
    category: category,
    room: category,
    room_name: roomNames[category] || 'Smart Life',
    is_on: 1,
    power_w: power,
    voltage_v: 230.0,
    current_ma: (power / 230.0) * 1000.0,
    energy_today_kwh: +(power * 0.003).toFixed(2),
    energy_total_kwh: +(power * 0.05).toFixed(2),
    peak_power_w: Math.round(power * 1.15),
    is_simulated: 1,
    timer_seconds_left: 0,
    _saved_power_w: power
  };

  currentDevices.push(newDev);
  if (isStandaloneMode) {
    localStorage.setItem('smartwatt_devices_v4', JSON.stringify(currentDevices));
  } else {
    fetch('/api/devices/import-json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devices: [newDev] })
    }).catch(e => {});
  }

  updateAll(true);
  alert(`✓ "${name}" (${power}W) hinzugefügt!`);
}

// JSON EXPORT & IMPORT
function exportDevicesJson() {
  const data = {
    app: "SmartWatt",
    version: "2.0",
    export_date: new Date().toISOString(),
    settings: currentSettings,
    devices: currentDevices
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smartwatt-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function triggerImportJson() {
  const fileInput = document.getElementById('json-import-file');
  if (fileInput) fileInput.click();
}

function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      const devices = Array.isArray(data) ? data : (data.devices || []);
      if (!Array.isArray(devices) || devices.length === 0) {
        alert("✕ Keine gültigen Geräte in der JSON-Datei gefunden.");
        return;
      }

      currentDevices = devices;
      if (data.settings) {
        Object.assign(currentSettings, data.settings);
        localStorage.setItem('smartwatt_settings_v4', JSON.stringify(currentSettings));
      }
      localStorage.setItem('smartwatt_devices_v4', JSON.stringify(currentDevices));

      if (!isStandaloneMode) {
        fetch('/api/devices/import-json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ devices: currentDevices })
        }).catch(e => {});
      }

      closeSettingsModal();
      loadSettings();
      updateAll(true);
      alert(`✓ ${devices.length} Steckdose(n) erfolgreich importiert!`);
    } catch (err) {
      alert(`✕ Fehler beim Lesen der JSON-Datei: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

// FLOATING DOCK NAVIGATION
function navigateTo(section) {
  ['dosen', 'analysen', 'tarif', 'tuya'].forEach(s => {
    const btn = document.getElementById(`dock-btn-${s}`);
    if (!btn) return;
    if (s === section) {
      btn.className = 'dock-item dock-item-active';
    } else {
      btn.className = 'dock-item';
    }
  });

  if (section === 'dosen') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (section === 'analysen') {
    const el = document.getElementById('section-charts');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  } else if (section === 'tarif') {
    toggleQuickPriceBar();
  } else if (section === 'tuya') {
    openSettingsModal('tuya');
  }
}

// CHARTS INITIALIZATION & TABS
function switchChartTab(tab) {
  activeChartTab = tab;
  ['power', 'distribution', 'weekly'].forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const view = document.getElementById(`chart-view-${t}`);
    if (!btn || !view) return;
    if (t === tab) {
      btn.className = 'segmented-btn segmented-btn-active';
      view.classList.remove('hidden');
      view.style.display = (t === 'distribution') ? 'flex' : 'block';
    } else {
      btn.className = 'segmented-btn';
      view.classList.add('hidden');
      view.style.display = 'none';
    }
  });

  requestAnimationFrame(() => {
    if (tab === 'power') updatePowerChart();
    if (tab === 'distribution') updateDistributionChart(true);
    if (tab === 'weekly') updateWeeklyChart();
  });
}

async function initCharts() {
  Chart.defaults.color = '#8E8E93';
  Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
  updatePowerChart();
}

function updatePowerChart() {
  const canvas = document.getElementById('canvas-power-history');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (powerChartInstance) powerChartInstance.destroy();

  const labels = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', 'Jetzt'];
  const colors = ['#30D158', '#0A84FF', '#FF9F0A', '#BF5AF2', '#64D2FF'];

  const datasets = currentDevices.map((d, i) => {
    const p = d.is_on ? (d.power_w || 0) : 0;
    return {
      label: d.name,
      data: [p * 0.1, p * 0.15, p * 0.4, p * 0.7, p * 0.85, p * 0.6, p * 0.95, p * 1.05, p],
      borderColor: colors[i % colors.length],
      backgroundColor: colors[i % colors.length] + '15',
      fill: true,
      tension: 0.4,
      borderWidth: 2,
      pointRadius: 2,
      pointBackgroundColor: colors[i % colors.length]
    };
  });

  powerChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { boxWidth: 8, font: { weight: 600 } } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: 'Watt', font: { weight: 600 } } }
      }
    }
  });
}

function updateDistributionChart(rebuild = true) {
  const canvas = document.getElementById('canvas-distribution');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const labels = currentDevices.map(d => d.name);
  const dataValues = currentDevices.map(d => d.is_on ? (d.power_w || 0) : 0);
  const totalP = dataValues.reduce((a, b) => a + b, 0);
  const chartValues = totalP > 0 ? dataValues : currentDevices.map(() => 1);
  const colors = ['#30D158', '#0A84FF', '#FF9F0A', '#BF5AF2', '#64D2FF'];
  const chartColors = totalP > 0 ? colors.slice(0, labels.length) : currentDevices.map(() => '#2C2C2E');

  if (rebuild || !distributionChartInstance) {
    if (distributionChartInstance) distributionChartInstance.destroy();

    distributionChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: chartValues,
          backgroundColor: chartColors,
          borderWidth: 2,
          borderColor: '#000000'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        cutout: '72%'
      }
    });
  } else {
    distributionChartInstance.data.labels = labels;
    distributionChartInstance.data.datasets[0].data = chartValues;
    distributionChartInstance.data.datasets[0].backgroundColor = chartColors;
    distributionChartInstance.update('none');
  }

  const legendEl = document.getElementById('distribution-legend');
  if (legendEl) {
    legendEl.innerHTML = currentDevices.map((d, i) => `
      <div class="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04]">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="w-2.5 h-2.5 rounded-full shadow-sm shrink-0" style="background-color: ${colors[i % colors.length]}"></span>
          <span class="text-neutral-200 font-medium truncate text-xs">${d.name}</span>
        </div>
        <div class="text-right font-mono shrink-0">
          <span class="text-white font-bold text-xs">${(d.energy_today_kwh || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh</span>
          <span class="text-neutral-500 text-[10px] block">~${((d.energy_today_kwh || 0) * parseFloat(currentSettings.kwh_price || '0.34')).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
        </div>
      </div>
    `).join('');
  }
}

function updateWeeklyChart() {
  const canvas = document.getElementById('canvas-weekly');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (weeklyChartInstance) weeklyChartInstance.destroy();

  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const costs = [1.85, 2.10, 1.45, 2.80, 2.25, 3.40, 1.95];

  weeklyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        label: 'Stromkosten (€)',
        data: costs,
        backgroundColor: '#30D158',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: 'Euro (€)', font: { weight: 600 } } }
      }
    }
  });
}
