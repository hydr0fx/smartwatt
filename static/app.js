// SmartWatt - Unified High-Performance Engine (Apple & Smart Life Liquid Glass)
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
let activeChartTab = 'power';
let powerChartInstance = null;
let distributionChartInstance = null;
let weeklyChartInstance = null;
let pollingTimer = null;
let tickCount = 0;
let isQuickPriceOpen = false;

// Default initial device profiles (Smart Life real-world examples)
const defaultInitialDevices = [
  {
    id: "demo-gaming-pc",
    name: "Gaming PC & Setup",
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
    name: "Kühlschrank (Küche)",
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
    name: "Waschmaschine (Bad)",
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
    power_w: 6.8, // Standby killer demonstration
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

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW reg error:', err));
  }

  // Detect backend vs 24/7 autonomous client engine
  await checkBackendAvailability();
  await loadSettings();
  await updateAll(true);
  await initCharts();

  // Background ticker (every 3 seconds)
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
  console.log("Running in 24/7 Autonomous Smart Life Engine");

  // Load from localStorage or initialize with default devices
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

// In-Browser Simulation Loop (Continuous calculation)
function runStandaloneTick() {
  currentDevices.forEach(d => {
    // Handle timer countdown
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
        // Custom added device fluctuation
        const p = d._saved_power_w || d.power_w || 100.0;
        d.power_w = Math.max(1.0, p + (Math.random() * 4 - 2));
        d.voltage_v = 230.0;
      }

      d._saved_power_w = d.power_w;
      d.current_ma = (d.power_w / d.voltage_v) * 1000.0;
      if (d.power_w > (d.peak_power_w || 0)) d.peak_power_w = d.power_w;

      // Real energy accumulation
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
  
  // Exact Burn Rates
  const burnRateH = (power / 1000.0) * kwhPrice;
  const costDayRate = burnRateH * 24.0;
  const costMonthRate = costDayRate * 30.0;  // Standard 30 days
  const costYearRate = costDayRate * 365.0;  // Standard 365 days

  // Accumulated Costs
  const costToday = (d.energy_today_kwh || 0.0) * kwhPrice;
  const costTotal = (d.energy_total_kwh || 0.0) * kwhPrice;

  // Standby & Overload
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

// Room category filter (Smart Life style)
function filterRoom(room) {
  currentRoomFilter = room;
  
  // Update Tab Styling
  ['all', 'entertainment', 'kitchen', 'utility'].forEach(r => {
    const btn = document.getElementById(`room-tab-${r}`);
    if (!btn) return;
    if (r === room) {
      btn.className = 'room-tab px-4 py-2 rounded-full text-xs font-bold transition-all bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 shadow-sm shrink-0 cursor-pointer';
    } else {
      btn.className = 'room-tab px-4 py-2 rounded-full text-xs font-semibold transition-all liquid-glass text-slate-400 hover:text-white shrink-0 cursor-pointer';
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

  // Update Top Hero Display with standard German formatting
  const totalPowerEl = document.getElementById('kpi-total-power');
  if (totalPowerEl) totalPowerEl.textContent = Math.round(summary.total_power_w).toLocaleString('de-DE');

  const activeCountEl = document.getElementById('kpi-active-count');
  if (activeCountEl) activeCountEl.textContent = summary.active_devices_count;

  const activeDetailEl = document.getElementById('kpi-active-devices-detail');
  if (activeDetailEl) activeDetailEl.textContent = `${summary.active_devices_count} von ${summary.device_count} Steckdosen an`;

  const headerStatusEl = document.getElementById('header-sub-status');
  if (headerStatusEl) headerStatusEl.textContent = `${summary.active_devices_count} aktiv • ${Math.round(summary.total_power_w)} W live`;

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
      document.getElementById('kpi-vampire-savings').textContent = `~${summary.standby_potential_annual_eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € / Jahr verschwendet`;
    } else {
      vampireHeroBar.classList.add('hidden');
    }
  }

  // Live Pulse Ring Animation state
  const ring = document.getElementById('kpi-live-ring');
  const dot = document.getElementById('kpi-live-dot');
  if (ring && dot) {
    if (summary.total_power_w > 0) {
      ring.style.animationPlayState = 'running';
      ring.className = 'absolute inset-0 rounded-full border-4 border-emerald-400/30 border-t-emerald-400 animate-spin';
      dot.className = 'inline-block w-2 h-2 rounded-full bg-emerald-400 mb-0.5 pulse-dot';
    } else {
      ring.style.animationPlayState = 'paused';
      ring.className = 'absolute inset-0 rounded-full border-4 border-slate-700/40 border-t-slate-500';
      dot.className = 'inline-block w-2 h-2 rounded-full bg-slate-500 mb-0.5';
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

  // Update room button count text
  const roomAllBtn = document.getElementById('room-tab-all');
  if (roomAllBtn) roomAllBtn.textContent = `Alle (${devices.length})`;

  // Keep charts in sync
  if (distributionChartInstance && activeChartTab === 'distribution') {
    updateDistributionChart(false);
  }
}

function updateModeBadge(isSimulation) {
  const badge = document.getElementById('mode-badge');
  const btnToggle = document.getElementById('btn-toggle-sim');
  if (isSimulation) {
    if (badge) {
      badge.textContent = isStandaloneMode ? '24/7 Demo' : 'Demo Modus';
      badge.className = 'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0';
    }
    if (btnToggle) btnToggle.textContent = 'Zu Live Tuya wechseln';
  } else {
    if (badge) {
      badge.textContent = 'Tuya Live';
      badge.className = 'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shrink-0';
    }
    if (btnToggle) btnToggle.textContent = 'Zu Demo Modus wechseln';
  }
}

// Render Device Grid
function renderDeviceGrid(devices, fullRebuild) {
  const container = document.getElementById('devices-container');
  if (!container) return;

  if (fullRebuild || container.children.length !== devices.length) {
    container.innerHTML = devices.length > 0 
      ? devices.map(d => createDeviceCardHtml(d)).join('')
      : `<div class="col-span-full py-12 text-center text-slate-400 liquid-glass"><i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-500"></i><p>Keine Steckdosen in diesem Raum gefunden.</p></div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  devices.forEach(d => {
    const card = document.getElementById(`dev-card-${d.id}`);
    if (!card) return;

    if (d.is_on) {
      card.classList.add('card-active');
      card.classList.remove('card-inactive');
    } else {
      card.classList.add('card-inactive');
      card.classList.remove('card-active');
    }

    const powerEl = card.querySelector('.dev-power-value');
    if (powerEl) {
      powerEl.textContent = d.is_on ? Math.round(d.power_w).toLocaleString('de-DE') : '0';
      powerEl.className = `dev-power-value text-2xl sm:text-3xl font-black font-mono tracking-tight ${!d.is_on ? 'text-slate-500' : (d.power_w < 100 ? 'text-emerald-400 glow-emerald' : (d.power_w < 1000 ? 'text-amber-400 glow-amber' : 'text-rose-400 glow-rose'))}`;
    }

    const burnEl = card.querySelector('.dev-burn-rate');
    if (burnEl) burnEl.textContent = d.is_on ? `${d.burn_rate_eur_h.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} €/h` : '0,000 €/h';

    const dayEl = card.querySelector('.dev-cost-day');
    if (dayEl) dayEl.textContent = d.is_on ? `${d.cost_day_rate_eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/Tag` : '0,00 €/Tag';

    const monthEl = card.querySelector('.dev-cost-month');
    if (monthEl) monthEl.textContent = d.is_on ? `${d.cost_month_rate_eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/Monat` : '0,00 €/Monat';

    const switchEl = card.querySelector('.dev-switch-input');
    if (switchEl && switchEl.checked !== Boolean(d.is_on)) {
      switchEl.checked = Boolean(d.is_on);
    }

    const vEl = card.querySelector('.dev-voltage');
    if (vEl) vEl.textContent = `${(d.voltage_v || 230).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} V`;

    const iEl = card.querySelector('.dev-current');
    if (iEl) iEl.textContent = d.current_ma > 1000 ? `${(d.current_ma / 1000).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} A` : `${Math.round(d.current_ma || 0)} mA`;

    const todayEl = card.querySelector('.dev-today-stats');
    if (todayEl) todayEl.textContent = `${(d.energy_today_kwh || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh (~${d.cost_today_eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)`;

    const peakEl = card.querySelector('.dev-peak-power');
    if (peakEl) peakEl.textContent = `${Math.round(d.peak_power_w || 0)} W`;

    const timerBtn = card.querySelector('.dev-timer-btn');
    if (timerBtn) {
      if (d.timer_seconds_left > 0) {
        const mins = Math.ceil(d.timer_seconds_left / 60);
        timerBtn.textContent = `⏱ ${mins}m`;
        timerBtn.className = 'dev-timer-btn flex-1 py-1.5 px-2.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold transition text-xs flex items-center justify-center gap-1 cursor-pointer';
      } else {
        timerBtn.textContent = 'Timer';
        timerBtn.className = 'dev-timer-btn flex-1 py-1.5 px-2.5 rounded-full liquid-glass hover:bg-white/15 text-slate-300 font-semibold transition text-xs flex items-center justify-center gap-1 cursor-pointer';
      }
    }

    const vampireEl = card.querySelector('.dev-vampire-banner');
    if (vampireEl) {
      if (d.is_standby) {
        vampireEl.classList.remove('hidden');
        vampireEl.querySelector('.dev-vampire-text').textContent = `Standby: ${d.power_w.toFixed(1)}W (~${d.standby_annual_eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/J)`;
      } else {
        vampireEl.classList.add('hidden');
      }
    }
  });
}

function createDeviceCardHtml(d) {
  const icon = d.icon || 'plug';
  const isOverloaded = d.is_overloaded;
  const isStandby = d.is_standby;
  const powerColor = !d.is_on ? 'text-slate-500' : (d.power_w < 100 ? 'text-emerald-400 glow-emerald' : (d.power_w < 1000 ? 'text-amber-400 glow-amber' : 'text-rose-400 glow-rose'));
  const cardStateClass = d.is_on ? 'card-active' : 'card-inactive';

  const iconGradients = {
    'entertainment': 'from-indigo-500/20 to-purple-500/20 text-indigo-400 border-indigo-400/30',
    'kitchen': 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-400/30',
    'utility': 'from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-400/30'
  };
  const iconStyle = iconGradients[d.category] || 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-400/30';

  return `
    <div id="dev-card-${d.id}" class="liquid-card p-4 sm:p-5 flex flex-col justify-between ${cardStateClass} relative overflow-hidden">
      <div>
        <!-- Top bar: Icon, Name, Room, Delete & Apple Switch -->
        <div class="flex justify-between items-start gap-2.5 mb-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br ${iconStyle} border flex items-center justify-center shadow-lg shrink-0">
              <i data-lucide="${icon}" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0">
              <h3 class="font-bold text-sm text-white tracking-tight leading-snug truncate" title="${d.name}">${d.name}</h3>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span class="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10 truncate">${d.room_name || d.category || 'Smart Life'}</span>
                <span class="text-[9px] uppercase px-1.5 py-0.5 rounded-full ${d.is_on ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-slate-700/30 text-slate-400 border border-white/5'} font-mono shrink-0">${d.is_on ? 'Live' : 'Aus'}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <!-- Delete Button -->
            <button onclick="deleteDevice('${d.id}')" class="w-7 h-7 rounded-full liquid-glass hover:bg-rose-500/20 hover:text-rose-400 text-slate-500 flex items-center justify-center transition text-xs cursor-pointer" title="Steckdose entfernen">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>

            <!-- Tactile Apple Switch -->
            <label class="switch shrink-0" title="Sofort umschalten">
              <input type="checkbox" class="dev-switch-input" ${d.is_on ? 'checked' : ''} onchange="toggleDevice('${d.id}', this.checked)">
              <span class="slider"></span>
            </label>
          </div>
        </div>

        ${isOverloaded ? `
          <div class="mb-2.5 px-2.5 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2 animate-pulse">
            <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-400 shrink-0"></i>
            <span>Überlastung (>2500 Watt)!</span>
          </div>
        ` : ''}

        <div class="dev-vampire-banner mb-2.5 px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-center justify-between gap-1.5 ${isStandby ? '' : 'hidden'}">
          <div class="flex items-center gap-1.5 truncate">
            <i data-lucide="battery-charging" class="w-3.5 h-3.5 text-amber-400 shrink-0"></i>
            <span class="dev-vampire-text text-[11px] truncate">Standby: ${d.power_w.toFixed(1)}W (~${d.standby_annual_eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/J)</span>
          </div>
          <button onclick="toggleDevice('${d.id}', false)" class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/30 hover:bg-amber-500/50 text-white font-bold transition shrink-0 cursor-pointer">Aus</button>
        </div>

        <!-- Watt Display & Cost Rate Box -->
        <div class="my-2.5 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
          <div class="flex items-baseline justify-between">
            <span class="text-xs text-slate-400 font-medium">Momentan-Last:</span>
            <div class="flex items-baseline gap-1">
              <span class="dev-power-value text-2xl sm:text-3xl font-black font-mono tracking-tight ${powerColor}">
                ${d.is_on ? Math.round(d.power_w).toLocaleString('de-DE') : '0'}
              </span>
              <span class="text-xs font-bold text-slate-400">W</span>
            </div>
          </div>

          <div class="mt-2 pt-2 border-t border-white/10 space-y-1">
            <div class="flex justify-between items-center text-xs">
              <span class="text-slate-400 font-medium">Kostenrate:</span>
              <strong class="dev-burn-rate font-mono text-emerald-400 font-bold">
                ${d.is_on ? (d.burn_rate_eur_h.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' €/h') : '0,000 €/h'}
              </strong>
            </div>

            <div class="flex justify-between items-center text-[11px] text-slate-400 font-mono">
              <span class="dev-cost-day">${d.is_on ? (d.cost_day_rate_eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €/Tag') : '0,00 €/Tag'}</span>
              <span class="dev-cost-month">${d.is_on ? (d.cost_month_rate_eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €/Monat') : '0,00 €/Monat'}</span>
            </div>
          </div>
        </div>

        <!-- Electrical Telemetry -->
        <div class="grid grid-cols-3 gap-1 py-1.5 px-2 rounded-xl bg-black/20 text-[10px] text-slate-400 font-mono border border-white/5">
          <div class="truncate">Volt: <span class="dev-voltage text-slate-200 font-bold">${(d.voltage_v || 230).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} V</span></div>
          <div class="text-center truncate">Strom: <span class="dev-current text-slate-200 font-bold">${d.current_ma > 1000 ? ((d.current_ma / 1000).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' A') : (Math.round(d.current_ma || 0) + ' mA')}</span></div>
          <div class="text-right truncate">Peak: <span class="dev-peak-power text-slate-200 font-bold">${Math.round(d.peak_power_w || 0)} W</span></div>
        </div>
      </div>

      <!-- Bottom Card: Today stats and Action Buttons -->
      <div class="mt-3.5 pt-2.5 border-t border-white/10 space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Heute bisher:</span>
          <span class="dev-today-stats text-slate-200 font-mono font-bold text-[11px]">
            ${(d.energy_today_kwh || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh (~${d.cost_today_eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)
          </span>
        </div>

        <div class="flex items-center justify-between gap-2 pt-0.5">
          <button onclick="openCalcModal('${d.id}')" class="flex-1 py-1.5 px-2.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-400/30 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer">
            <i data-lucide="calculator" class="w-3.5 h-3.5"></i>
            <span>Rechner</span>
          </button>

          <button onclick="openTimerModal('${d.id}', '${d.name.replace(/'/g, "\\'")}')" class="dev-timer-btn flex-1 py-1.5 px-2.5 rounded-full liquid-glass hover:bg-white/15 text-slate-300 font-semibold transition text-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer">
            <i data-lucide="clock" class="w-3.5 h-3.5"></i>
            <span>${d.timer_seconds_left > 0 ? `⏱ ${Math.ceil(d.timer_seconds_left / 60)}m` : 'Timer'}</span>
          </button>
        </div>
      </div>
    </div>
  `;
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
      d._saved_power_w = d.power_w > 0 ? dev.power_w : (d._saved_power_w || 100);
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

  document.getElementById('calc-modal-dev-name').textContent = `${dev.name} (Live)`;
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
    { id: '2h', hours: 2 },
    { id: '4h', hours: 4 },
    { id: '8h', hours: 8 },
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
  document.getElementById('timer-modal-dev-name').textContent = deviceName;
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

// Settings & Tuya Modal
function openSettingsModal(targetSection = '') {
  document.getElementById('settings-modal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
  document.getElementById('tuya-test-result').classList.add('hidden');
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
  document.getElementById('setting-tuya-id').value = currentSettings.tuya_access_id || '';
  document.getElementById('setting-tuya-secret').value = currentSettings.tuya_access_secret || '';
  document.getElementById('setting-tuya-endpoint').value = currentSettings.tuya_endpoint || 'https://openapi.tuyaeu.com';
  document.getElementById('setting-tuya-uid').value = currentSettings.tuya_uid || '';
}

async function saveSettings() {
  const kwhPrice = document.getElementById('setting-kwh-price').value;
  const standbyTh = document.getElementById('setting-standby-th').value;
  const tuyaId = document.getElementById('setting-tuya-id').value;
  const tuyaSecret = document.getElementById('setting-tuya-secret').value;
  const tuyaEndpoint = document.getElementById('setting-tuya-endpoint').value;
  const tuyaUid = document.getElementById('setting-tuya-uid').value;

  currentSettings.kwh_price = kwhPrice;
  currentSettings.standby_threshold_w = standbyTh;
  currentSettings.tuya_access_id = tuyaId;
  currentSettings.tuya_access_secret = tuyaSecret;
  currentSettings.tuya_endpoint = tuyaEndpoint;
  currentSettings.tuya_uid = tuyaUid;

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

// TEST TUYA CLOUD CONNECTION
async function testTuyaConnection() {
  const tuyaId = document.getElementById('setting-tuya-id').value.trim();
  const tuyaSecret = document.getElementById('setting-tuya-secret').value.trim();
  const tuyaEndpoint = document.getElementById('setting-tuya-endpoint').value;
  const tuyaUid = document.getElementById('setting-tuya-uid').value.trim();

  const resBox = document.getElementById('tuya-test-result');
  resBox.classList.remove('hidden');
  resBox.className = 'text-xs p-3 rounded-xl border bg-slate-900 text-slate-300 font-mono';
  resBox.textContent = 'Verbindung zu Tuya IoT wird geprüft...';

  if (!tuyaId || !tuyaSecret) {
    resBox.className = 'text-xs p-3 rounded-xl border bg-rose-950/40 text-rose-300 border-rose-800 font-mono';
    resBox.textContent = '✕ Bitte Access ID (Client ID) und Access Secret eingeben.';
    return;
  }

  if (isStandaloneMode) {
    currentSettings.tuya_access_id = tuyaId;
    currentSettings.tuya_access_secret = tuyaSecret;
    currentSettings.tuya_endpoint = tuyaEndpoint;
    currentSettings.tuya_uid = tuyaUid;
    localStorage.setItem('smartwatt_settings_v4', JSON.stringify(currentSettings));

    resBox.className = 'text-xs p-3 rounded-xl border bg-emerald-950/40 text-emerald-300 border-emerald-800 font-mono';
    resBox.textContent = '✓ Tuya Zugangsdaten erfolgreich gespeichert! Starte den lokalen Server (start.bat), um Live-Daten direkt aus der Tuya Cloud abzurufen.';
    return;
  }

  try {
    const res = await fetch('/api/tuya/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_id: tuyaId,
        access_secret: tuyaSecret,
        endpoint: tuyaEndpoint,
        uid: tuyaUid
      })
    });
    const data = await res.json();
    if (res.ok && data.status === 'success') {
      resBox.className = 'text-xs p-3 rounded-xl border bg-emerald-950/40 text-emerald-300 border-emerald-800 font-mono';
      resBox.textContent = `✓ ${data.message}`;
    } else {
      resBox.className = 'text-xs p-3 rounded-xl border bg-rose-950/40 text-rose-300 border-rose-800 font-mono';
      resBox.textContent = `✕ ${data.message || 'Verbindung fehlgeschlagen. Bitte Schlüssel prüfen.'}`;
    }
  } catch (err) {
    resBox.className = 'text-xs p-3 rounded-xl border bg-rose-950/40 text-rose-300 border-rose-800 font-mono';
    resBox.textContent = `✕ Fehler: ${err}`;
  }
}

// SYNC / IMPORT TUYA SMART LIFE DEVICES
async function syncTuyaDevices() {
  await saveSettings();
  const resBox = document.getElementById('tuya-test-result');
  resBox.classList.remove('hidden');
  resBox.className = 'text-xs p-3 rounded-xl border bg-slate-900 text-slate-300 font-mono';
  resBox.textContent = 'Importiere Geräte aus Smart Life...';

  if (isStandaloneMode) {
    resBox.className = 'text-xs p-3 rounded-xl border bg-emerald-950/40 text-emerald-300 border-emerald-800 font-mono';
    resBox.textContent = '✓ Tuya Cloud Zugangsdaten gespeichert! Für den direkten Live-Sync mit echten Steckdosen starte start.bat auf deinem PC (oder trage Geräte manuell ein).';
    return;
  }

  try {
    const res = await fetch('/api/tuya/sync', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      resBox.className = 'text-xs p-3 rounded-xl border bg-emerald-950/40 text-emerald-300 border-emerald-800 font-mono';
      resBox.textContent = `✓ ${data.imported} neue Steckdose(n) erfolgreich aus Smart Life importiert!`;
      await updateAll(true);
    } else {
      resBox.className = 'text-xs p-3 rounded-xl border bg-rose-950/40 text-rose-300 border-rose-800 font-mono';
      resBox.textContent = `✕ Import-Fehler: ${data.detail || 'Unbekannter Fehler'}`;
    }
  } catch (err) {
    resBox.className = 'text-xs p-3 rounded-xl border bg-rose-950/40 text-rose-300 border-rose-800 font-mono';
    resBox.textContent = `✕ Fehler: ${err}`;
  }
}

async function toggleSimulationMode() {
  if (isStandaloneMode) {
    isStandaloneMode = false;
    await checkBackendAvailability();
    updateModeBadge(isStandaloneMode);
    return;
  }

  try {
    const res = await fetch('/api/tuya/toggle-mode', { method: 'POST' });
    const data = await res.json();
    updateModeBadge(data.simulation_mode);
    await updateAll(true);
  } catch (err) {
    console.error('Toggle mode error:', err);
  }
}

// FLOATING DOCK NAVIGATION
function navigateTo(section) {
  ['dosen', 'analysen', 'tarif', 'tuya'].forEach(s => {
    const btn = document.getElementById(`dock-btn-${s}`);
    if (!btn) return;
    if (s === section) {
      btn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-400/35 transition cursor-pointer';
    } else {
      btn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer';
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

// Chart Initializations & Tabs
function switchChartTab(tab) {
  activeChartTab = tab;
  ['power', 'distribution', 'weekly'].forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const view = document.getElementById(`chart-view-${t}`);
    if (!btn || !view) return;
    if (t === tab) {
      btn.className = 'flex-1 sm:flex-none px-3.5 py-1.5 rounded-full transition bg-emerald-500 text-slate-950 font-bold shadow-md cursor-pointer';
      view.classList.remove('hidden');
      view.style.display = (t === 'distribution') ? 'flex' : 'block';
    } else {
      btn.className = 'flex-1 sm:flex-none px-3.5 py-1.5 rounded-full transition text-slate-400 hover:text-white cursor-pointer';
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
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
  updatePowerChart();
}

function updatePowerChart() {
  const canvas = document.getElementById('canvas-power-history');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (powerChartInstance) powerChartInstance.destroy();

  const labels = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', 'Jetzt'];
  const colors = ['#10b981', '#06b6d4', '#f59e0b', '#ec4899', '#8b5cf6'];

  const datasets = currentDevices.map((d, i) => {
    const p = d.is_on ? (d.power_w || 0) : 0;
    return {
      label: d.name,
      data: [p * 0.1, p * 0.15, p * 0.4, p * 0.7, p * 0.85, p * 0.6, p * 0.95, p * 1.05, p],
      borderColor: colors[i % colors.length],
      backgroundColor: colors[i % colors.length] + '18',
      fill: true,
      tension: 0.4,
      borderWidth: 2.5,
      pointRadius: 2.5,
      pointBackgroundColor: colors[i % colors.length]
    };
  });

  powerChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { weight: 600 } } } },
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
  const colors = ['#10b981', '#06b6d4', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];
  const chartColors = totalP > 0 ? colors.slice(0, labels.length) : currentDevices.map(() => '#334155');

  if (rebuild || !distributionChartInstance) {
    if (distributionChartInstance) distributionChartInstance.destroy();

    distributionChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: chartValues,
          backgroundColor: chartColors,
          borderWidth: 3,
          borderColor: '#060911'
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
      <div class="flex items-center justify-between p-2.5 rounded-2xl liquid-glass">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="w-3 h-3 rounded-full shadow-sm shrink-0" style="background-color: ${colors[i % colors.length]}"></span>
          <span class="text-slate-200 font-semibold truncate text-xs">${d.name}</span>
        </div>
        <div class="text-right font-mono shrink-0">
          <span class="text-white font-bold text-xs">${(d.energy_today_kwh || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh</span>
          <span class="text-slate-400 text-[10px] block">~${((d.energy_today_kwh || 0) * parseFloat(currentSettings.kwh_price || '0.34')).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
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
        backgroundColor: '#10b981',
        borderRadius: 8
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
