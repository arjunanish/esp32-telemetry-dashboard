import React, { useState, useEffect } from 'react';

// --- Reusable Clean SVG Icons ---
const IconWifi = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
  </svg>
);

const IconSettings = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconMenu = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const IconClose = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function App() {
  // Settings & Navigation States
  const [activeTab, setActiveTab] = useState('telemetry');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('esp32_api_url') || 'http://192.168.43.100/data');
  const [tempUrl, setTempUrl] = useState(apiUrl);
  const [pollInterval, setPollInterval] = useState(2000);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Data & Telemetry States
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('INITIALIZING');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [latency, setLatency] = useState(null);
  const [packetCount, setPacketCount] = useState(0);

  // Settings Save
  const handleSaveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('esp32_api_url', tempUrl.trim());
    setApiUrl(tempUrl.trim());
    setIsSettingsOpen(false);
    setErrorMessage(null);
  };

  // Telemetry Polling Effect
  useEffect(() => {
    if (isPaused) return;
    let isMounted = true;

    const fetchData = async () => {
      // 1. DEMO SIMULATION
      if (isDemoMode) {
        const simulated = {
          mq135_in_adc: Math.floor(1350 + Math.random() * 250),
          mq135_out_adc: Math.floor(340 + Math.random() * 90),
          temperature_c: +(24.2 + (Math.random() * 0.6 - 0.3)).toFixed(1),
          humidity_pct: +(59.0 + (Math.random() * 2 - 1)).toFixed(1),
          timestamp: Math.floor(Date.now() / 1000)
        };

        if (!isMounted) return;
        setData(simulated);
        setLastUpdated(new Date());
        setConnectionStatus('DEMO');
        setLatency(Math.floor(12 + Math.random() * 8));
        setPacketCount((p) => p + 1);
        setErrorMessage(null);

        setHistory((prev) => [
          ...prev.slice(-19),
          {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            inlet: simulated.mq135_in_adc,
            outlet: simulated.mq135_out_adc
          }
        ]);
        return;
      }

      // 2. LIVE FETCH FROM ESP32
      const t0 = performance.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2600);

        const res = await fetch(apiUrl, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const json = await res.json();
        const ping = Math.round(performance.now() - t0);

        if (!isMounted) return;
        setData(json);
        setLatency(ping);
        setLastUpdated(new Date());
        setConnectionStatus('LIVE');
        setPacketCount((p) => p + 1);
        setErrorMessage(null);

        setHistory((prev) => [
          ...prev.slice(-19),
          {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            inlet: typeof json.mq135_in_adc === 'number' ? json.mq135_in_adc : null,
            outlet: typeof json.mq135_out_adc === 'number' ? json.mq135_out_adc : null
          }
        ]);
      } catch (err) {
        if (!isMounted) return;
        setConnectionStatus((prev) => (prev === 'LIVE' ? 'RECONNECTING' : 'OFFLINE'));

        if (err.name === 'AbortError') {
          setErrorMessage('Request timed out. Check ESP32 hotspot connection.');
        } else if (window.location.protocol === 'https:' && apiUrl.startsWith('http:')) {
          setErrorMessage('Mixed Content Block: HTTPS cannot read local HTTP. Host locally.');
        } else {
          setErrorMessage(err.message || 'ESP32 Unreachable');
        }
      }
    };

    fetchData();
    const interval = setInterval(fetchData, pollInterval);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiUrl, pollInterval, isDemoMode, isPaused]);

  // Derived Values
  const hasInlet = data && typeof data.mq135_in_adc === 'number';
  const hasOutlet = data && typeof data.mq135_out_adc === 'number';
  const countDelta = hasInlet && hasOutlet ? data.mq135_in_adc - data.mq135_out_adc : null;
  const deltaPct = hasInlet && hasOutlet && data.mq135_in_adc > 0
    ? (((data.mq135_in_adc - data.mq135_out_adc) / data.mq135_in_adc) * 100).toFixed(1)
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      
      {/* ===================== TOP NAVIGATION BAR ===================== */}
      <nav className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 shadow-lg shadow-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Brand Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-cyan-400 to-indigo-600 p-[1.5px] shadow-lg shadow-cyan-500/20">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <span className="text-cyan-400 font-black text-sm tracking-tighter">ESP</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold tracking-tight text-white text-base sm:text-lg">
                    AERO<span className="text-cyan-400">PULSE</span>
                  </span>
                  <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                    v2.4
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 hidden sm:block">IoT Air Quality Telemetry Engine</p>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
              <button
                onClick={() => setActiveTab('telemetry')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeTab === 'telemetry' ? 'bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                Live Telemetry
              </button>
              <button
                onClick={() => setActiveTab('diagnostics')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeTab === 'diagnostics' ? 'bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                Diagnostics
              </button>
              <button
                onClick={() => setActiveTab('about')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeTab === 'about' ? 'bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                Project Specs
              </button>
            </div>

            {/* Quick Actions & Status */}
            <div className="hidden sm:flex items-center gap-3">
              {/* Dynamic Status Pill */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
                {connectionStatus === 'LIVE' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span className="font-semibold text-emerald-400">ESP32 ONLINE</span>
                    <span className="text-[10px] text-slate-400 font-mono">({latency}ms)</span>
                  </>
                )}
                {connectionStatus === 'RECONNECTING' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                    <span className="font-semibold text-amber-400">RECONNECTING...</span>
                  </>
                )}
                {connectionStatus === 'OFFLINE' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span className="font-semibold text-rose-400">DISCONNECTED</span>
                  </>
                )}
                {connectionStatus === 'DEMO' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                    <span className="font-semibold text-purple-300">DEMO SIMULATION</span>
                  </>
                )}
                {connectionStatus === 'INITIALIZING' && (
                  <span className="text-slate-400">CONNECTING...</span>
                )}
              </div>

              {/* Demo Toggle Button */}
              <button
                onClick={() => setIsDemoMode(!isDemoMode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  isDemoMode
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10'
                    : 'bg-slate-900 text-slate-300 border-slate-700/80 hover:bg-slate-800'
                }`}
              >
                {isDemoMode ? 'Exit Demo' : 'Demo Mode'}
              </button>

              {/* Settings Button */}
              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="p-2 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 hover:text-cyan-400 hover:border-cyan-500/40 transition"
                title="Endpoint Configuration"
              >
                <IconSettings />
              </button>
            </div>

            {/* Mobile Hamburger Toggle Button */}
            <div className="flex sm:hidden items-center gap-2">
              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300"
              >
                <IconSettings />
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              >
                {isMobileMenuOpen ? <IconClose /> : <IconMenu />}
              </button>
            </div>

          </div>
        </div>
      </nav>

      {/* ===================== MOBILE SIDEBAR DRAWER ===================== */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>

          {/* Drawer Menu */}
          <div className="fixed top-0 right-0 w-72 h-full bg-slate-950 border-l border-slate-800/90 p-5 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <span className="font-bold text-white text-base">Navigation</span>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <IconClose />
                </button>
              </div>

              {/* Links */}
              <div className="mt-5 space-y-2">
                <button
                  onClick={() => { setActiveTab('telemetry'); setIsMobileMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    activeTab === 'telemetry' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  Live Telemetry
                </button>
                <button
                  onClick={() => { setActiveTab('diagnostics'); setIsMobileMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    activeTab === 'diagnostics' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  Diagnostics & Logs
                </button>
                <button
                  onClick={() => { setActiveTab('about'); setIsMobileMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    activeTab === 'about' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  Project Specifications
                </button>
              </div>

              {/* Mobile Quick Toggles */}
              <div className="mt-6 pt-4 border-t border-slate-800 space-y-3">
                <button
                  onClick={() => { setIsDemoMode(!isDemoMode); setIsMobileMenuOpen(false); }}
                  className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30"
                >
                  {isDemoMode ? 'Turn Off Demo' : 'Enable Demo Mode'}
                </button>
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700"
                >
                  {isPaused ? 'Resume Polling' : 'Pause Live Stream'}
                </button>
              </div>
            </div>

            {/* Bottom System info */}
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>Packets:</span>
                <span className="font-mono text-cyan-400">{packetCount}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Latency:</span>
                <span className="font-mono text-emerald-400">{latency ? `${latency} ms` : 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SETTINGS DRAWER / MODAL ===================== */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg p-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                  <IconSettings />
                </span>
                <h3 className="font-bold text-white text-sm">ESP32 Endpoint Configuration</h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <IconClose />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Target API Endpoint (HTTP)
                </label>
                <input
                  type="text"
                  value={tempUrl}
                  onChange={(e) => setTempUrl(e.target.value)}
                  placeholder="http://192.168.43.100/data"
                  className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              {/* IP Presets */}
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setTempUrl('http://192.168.43.100/data')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Hotspot (192.168.43.100)
                </button>
                <button
                  type="button"
                  onClick={() => setTempUrl('http://192.168.4.1/data')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  SoftAP (192.168.4.1)
                </button>
              </div>

              {/* Rate buttons */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Polling Rate</label>
                <div className="flex gap-2">
                  {[1000, 2000, 3000, 5000].map((rate) => (
                    <button
                      type="button"
                      key={rate}
                      onClick={() => setPollInterval(rate)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${
                        pollInterval === rate
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      {rate / 1000}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/20"
                >
                  Apply & Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MAIN CONTENT AREA ===================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* System Alert Banner */}
        {errorMessage && !isDemoMode && (
          <div className="mb-5 p-4 bg-rose-950/40 border border-rose-800/80 rounded-2xl flex items-start gap-3 backdrop-blur-md">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 shrink-0 animate-pulse"></span>
            <div className="text-xs">
              <strong className="text-rose-300 font-semibold">Connection Alert: </strong>
              <span className="text-rose-200">{errorMessage}</span>
              <p className="mt-1 text-slate-400">
                Check whether your ESP32 has obtained an IP on the phone hotspot and whether CORS is enabled.
              </p>
            </div>
          </div>
        )}

        {/* Sub-Header Stats Strip */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Channel</span>
            <span className="text-xs font-mono font-bold text-cyan-400">Wi-Fi Hotspot</span>
          </div>
          <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Latency</span>
            <span className="text-xs font-mono font-bold text-emerald-400">
              {latency !== null ? `${latency} ms` : '—'}
            </span>
          </div>
          <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Packets</span>
            <span className="text-xs font-mono font-bold text-indigo-400">{packetCount} rx</span>
          </div>
          <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Last Sync</span>
            <span className="text-xs font-mono font-medium text-slate-300">
              {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Waiting'}
            </span>
          </div>
        </div>

        {/* View Switcher */}
        {activeTab === 'telemetry' && (
          <>
            {/* ================= PRIMARY TELEMETRY CARDS ================= */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              
              {/* 1. Inlet Sensor Card */}
              <div className="bg-slate-900/70 rounded-2xl p-5 border border-slate-800 border-t-2 border-t-cyan-500 shadow-xl relative overflow-hidden group hover:border-slate-700 transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold tracking-wider text-cyan-400 uppercase">INLET CHAMBER</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 font-mono">ADC-1 (34)</span>
                </div>
                <div className="text-xs text-slate-400">MQ-135 ADC Response</div>
                <div className="mt-3 text-3xl sm:text-4xl font-black text-white font-mono">
                  {hasInlet ? data.mq135_in_adc : <span className="text-base font-normal text-slate-500">Waiting...</span>}
                </div>
                
                {/* Visual Level Progress Bar */}
                <div className="mt-3 w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-cyan-400 h-full transition-all duration-500"
                    style={{ width: `${hasInlet ? Math.min((data.mq135_in_adc / 4095) * 100, 100) : 0}%` }}
                  ></div>
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>0</span>
                  <span>Range: 0 - 4095 ADC counts</span>
                  <span>4095</span>
                </div>
              </div>

              {/* 2. Outlet Sensor Card */}
              <div className="bg-slate-900/70 rounded-2xl p-5 border border-slate-800 border-t-2 border-t-emerald-500 shadow-xl relative overflow-hidden group hover:border-slate-700 transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold tracking-wider text-emerald-400 uppercase">OUTLET CHAMBER</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 font-mono">ADC-1 (35)</span>
                </div>
                <div className="text-xs text-slate-400">MQ-135 ADC Response</div>
                <div className="mt-3 text-3xl sm:text-4xl font-black text-white font-mono">
                  {hasOutlet ? data.mq135_out_adc : <span className="text-base font-normal text-slate-500">Waiting...</span>}
                </div>

                {/* Visual Level Progress Bar */}
                <div className="mt-3 w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-emerald-400 h-full transition-all duration-500"
                    style={{ width: `${hasOutlet ? Math.min((data.mq135_out_adc / 4095) * 100, 100) : 0}%` }}
                  ></div>
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>0</span>
                  <span>Range: 0 - 4095 ADC counts</span>
                  <span>4095</span>
                </div>
              </div>

              {/* 3. Differential Delta Card */}
              <div className="bg-slate-900/70 rounded-2xl p-5 border border-slate-800 border-t-2 border-t-indigo-500 shadow-xl group hover:border-slate-700 transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold tracking-wider text-indigo-400 uppercase">RAW COUNT DELTA</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 font-mono">Δ DIFF</span>
                </div>
                <div className="text-xs text-slate-400">Chamber Response Drop</div>
                <div className="mt-3 text-3xl sm:text-4xl font-black text-white font-mono">
                  {countDelta !== null ? (
                    <span>{countDelta > 0 ? `+${countDelta}` : countDelta}</span>
                  ) : (
                    <span className="text-base font-normal text-slate-500">Syncing...</span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-950 border border-indigo-800/60 text-[11px] font-semibold text-indigo-300">
                    {deltaPct !== null ? `${deltaPct}% drop` : 'Waiting for sync'}
                  </span>
                  <span className="text-[10px] text-slate-400">(Inlet − Outlet)</span>
                </div>
              </div>

              {/* 4. Ambient Environment Card */}
              <div className="bg-slate-900/70 rounded-2xl p-5 border border-slate-800 border-t-2 border-t-amber-500 shadow-xl group hover:border-slate-700 transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold tracking-wider text-amber-400 uppercase">AMBIENT SENSORS</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-800/60 text-amber-300 font-mono">I2C / GPIO</span>
                </div>
                <div className="text-xs text-slate-400">DHT / BME Reference</div>
                <div className="mt-4 space-y-2.5">
                  <div className="flex items-center justify-between p-2 bg-slate-950/70 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400">Temperature</span>
                    <span className="text-xs font-mono font-bold text-white">
                      {data && typeof data.temperature_c === 'number' ? `${data.temperature_c} °C` : 'Not available'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-950/70 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400">Humidity</span>
                    <span className="text-xs font-mono font-bold text-white">
                      {data && typeof data.humidity_pct === 'number' ? `${data.humidity_pct} %` : 'Not available'}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* ================= REAL-TIME SVG GRAPH ================= */}
            <div className="bg-slate-900/70 rounded-2xl border border-slate-800/90 shadow-2xl p-5 sm:p-6 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                      Real-Time Chamber Waveform
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Continuous dual-trace comparison buffer (last 20 telemetry cycles)
                  </p>
                </div>

                {/* Graph Legend */}
                <div className="flex items-center gap-4 text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-1 bg-cyan-400 rounded-full shadow-sm shadow-cyan-400/50"></span>
                    <span className="text-slate-300">Inlet ADC</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-1 bg-emerald-400 rounded-full shadow-sm shadow-emerald-400/50"></span>
                    <span className="text-slate-300">Outlet ADC</span>
                  </div>
                </div>
              </div>

              {/* Chart Body */}
              <div className="mt-4 w-full h-56 bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 relative flex items-center justify-center">
                {history.length < 2 ? (
                  <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></span>
                    Gathering telemetry frames...
                  </div>
                ) : (
                  <svg viewBox="0 0 500 160" className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Gridlines */}
                    <line x1="0" y1="30" x2="500" y2="30" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="0" y1="80" x2="500" y2="80" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="0" y1="130" x2="500" y2="130" stroke="#1e293b" strokeDasharray="3 3" />

                    {/* Area under curves */}
                    <polygon
                      fill="url(#cyanGrad)"
                      points={`0,150 ${history
                        .map((pt, i) => {
                          const x = (i / (history.length - 1)) * 500;
                          const val = pt.inlet ?? 0;
                          const y = 145 - (Math.min(Math.max(val, 0), 4095) / 4095) * 125;
                          return `${x},${y}`;
                        })
                        .join(' ')} 500,150`}
                    />

                    {/* Inlet Polyline */}
                    <polyline
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={history
                        .map((pt, i) => {
                          const x = (i / (history.length - 1)) * 500;
                          const val = pt.inlet ?? 0;
                          const y = 145 - (Math.min(Math.max(val, 0), 4095) / 4095) * 125;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />

                    {/* Outlet Polyline */}
                    <polyline
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={history
                        .map((pt, i) => {
                          const x = (i / (history.length - 1)) * 500;
                          const val = pt.outlet ?? 0;
                          const y = 145 - (Math.min(Math.max(val, 0), 4095) / 4095) * 125;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />
                  </svg>
                )}
              </div>
            </div>
          </>
        )}

        {/* Tab 2: Diagnostics */}
        {activeTab === 'diagnostics' && (
          <div className="bg-slate-900/70 rounded-2xl border border-slate-800 p-6 mb-6">
            <h2 className="text-base font-bold text-white mb-2">Network Diagnostics & Link Quality</h2>
            <p className="text-xs text-slate-400 mb-5">Technical inspection of the ESP32 local HTTP socket.</p>
            
            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
                <span className="text-slate-400">Configured Endpoint:</span>
                <span className="text-cyan-400">{apiUrl}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
                <span className="text-slate-400">Stream Status:</span>
                <span className="text-emerald-400">{isPaused ? 'PAUSED' : 'ACTIVE POLLING'}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
                <span className="text-slate-400">Current Polling Interval:</span>
                <span className="text-amber-400">{pollInterval} ms</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
                <span className="text-slate-400">Total Samples In Buffer:</span>
                <span className="text-indigo-400">{history.length} samples</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Project Specs */}
        {activeTab === 'about' && (
          <div className="bg-slate-900/70 rounded-2xl border border-slate-800 p-6 mb-6">
            <h2 className="text-base font-bold text-white mb-2">Engineering Project Specifications</h2>
            <p className="text-xs text-slate-400 mb-4">Architecture and sensor methodology details.</p>
            <div className="text-xs text-slate-300 leading-relaxed space-y-3">
              <p>
                • <strong>Sensor Type:</strong> Dual SnO₂ semiconductor gas sensors (MQ-135).
              </p>
              <p>
                • <strong>Signal Acquisition:</strong> ESP32 12-bit SAR ADC with multisample averaging.
              </p>
              <p>
                • <strong>Architecture:</strong> Zero-Cloud Local REST Architecture. Client polls ESP32 local webserver on a local IEEE 802.11 hotspot.
              </p>
            </div>
          </div>
        )}

        {/* ================= ACADEMIC DISCLAIMER FOOTER ================= */}
        <footer className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl text-xs text-slate-400 leading-relaxed">
          <strong className="text-slate-300">College Demo Project Note: </strong>
          The MQ-135 values represent raw electrical ADC responses (0 - 4095). Prototype ADC voltage variations indicate sensor response dynamics and do not prove verified CO₂ removal or certified carbon credits.
        </footer>

      </main>
    </div>
  );
}