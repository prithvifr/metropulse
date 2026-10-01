import React from 'react';
import { Bus as BusType, TransitRoute, ServiceAlert } from '../../types';
import {
  User,
  Bus,
  Navigation,
  Clock,
  Radio,
  Shield,
  Check,
  ArrowRight,
  Activity,
  Zap,
  Lock,
} from 'lucide-react';

interface LandingPageProps {
  onLaunchPassenger: () => void;
  onLaunchDriver: () => void;
  onLaunchDispatcher: () => void;
  onLaunchAdmin: () => void;
  routes: TransitRoute[];
  buses: BusType[];
  alerts: ServiceAlert[];
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchPassenger,
  onLaunchDriver,
  onLaunchDispatcher,
  onLaunchAdmin,
  routes,
  buses,
  alerts,
}) => {
  const activeBuses = buses.filter((b) => b.status === 'On Route');
  const delayedBuses = buses.filter((b) => b.status === 'Delayed' || b.currentDelay >= 4);

  return (
    <div className="flex-1 bg-emerald-50/40 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans overflow-y-auto selection:bg-emerald-600 selection:text-white transition-colors">
      {/* 1. HERO BANNER */}
      <section className="relative overflow-hidden py-12 lg:py-20 border-b border-emerald-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-200/30 dark:bg-emerald-950/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-10 right-1/4 w-96 h-96 bg-teal-200/20 dark:bg-cyan-950/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-8">
          {/* Badge Row */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wide bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
              <span>Smart Green Transit Ecosystem</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-emerald-50 dark:bg-slate-800 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-slate-700">
              <Zap className="w-3.5 h-3.5" />
              <span>Mobile Phone GPS (Zero Hardware)</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-slate-700 shadow-xs">
              <Lock className="w-3.5 h-3.5" />
              <span>Live Cloud Sync</span>
            </span>
          </div>

          {/* Headline & Subhead */}
          <div className="text-center max-w-4xl mx-auto space-y-4">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              Real-Time Bus Tracking &amp; Public Mobility Platform
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl mx-auto">
              Empowering city <strong className="text-emerald-700 dark:text-emerald-400">passengers</strong> with live GPS bus radar and automated arrival predictions, while providing <strong className="text-emerald-800 dark:text-emerald-300">commercial bus drivers</strong> with hardware-free mobile telemetry.
            </p>
          </div>

          {/* DUAL PERSONA PRIMARY ACTION CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 max-w-5xl mx-auto">
            {/* PERSONA 1: PASSENGER PORTAL */}
            <div className="group relative bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-all shadow-md flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-800 dark:text-emerald-400">
                    <User className="w-7 h-7" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-800">
                    For Passengers
                  </span>
                </div>

                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                    Passenger Transit Experience
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Plan trips, track approaching buses on a live radar map, receive arrival alerts, and book digital transit passes.
                  </p>
                </div>

                {/* Feature Bullet Points */}
                <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 font-bold" />
                    <span>Search routes by origin stop &amp; destination (e.g. City Center → University Gate)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 font-bold" />
                    <span>Live moving bus markers with speed &amp; heading</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 font-bold" />
                    <span>Intelligent arrival ETA with traffic delay adjustments</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 font-bold" />
                    <span>Transfer suggestions: Take Route 3 → City Center → Route 9</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 font-bold" />
                    <span>Digital QR ticket purchase &amp; crowd reporting</span>
                  </li>
                </ul>
              </div>

              <div className="pt-6">
                <button
                  onClick={onLaunchPassenger}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-sm shadow-lg shadow-emerald-600/20 transition-all transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Launch Passenger App</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <span className="block text-center text-[10px] text-slate-500 mt-2 font-mono">
                  No app download needed · Runs in any mobile browser
                </span>
              </div>
            </div>

            {/* PERSONA 2: DRIVER GPS TERMINAL */}
            <div className="group relative bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-all shadow-md flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-800 dark:text-emerald-400">
                    <Bus className="w-7 h-7" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-800">
                    For Commercial Drivers
                  </span>
                </div>

                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                    Commercial Driver GPS Terminal
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Turn any smartphone into a commercial vehicle locator. Broadcast GPS telemetry, manage trips, and report delay incidents.
                  </p>
                </div>

                {/* Feature Bullet Points */}
                <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 font-bold" />
                    <span>Zero hardware installation: uses smartphone GPS</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 font-bold" />
                    <span>Select assigned bus and route corridor</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 font-bold" />
                    <span>Start shift &amp; real-time automatic stop arrival detection</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 font-bold" />
                    <span>1-tap incident broadcasting (Traffic, Road Closed, Issue)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 font-bold" />
                    <span>Simulated GPS coordinates for indoor presentations</span>
                  </li>
                </ul>
              </div>

              <div className="pt-6">
                <button
                  onClick={onLaunchDriver}
                  className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-2xl text-sm shadow-lg shadow-emerald-700/20 transition-all transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Launch Driver GPS Terminal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <span className="block text-center text-[10px] text-slate-500 mt-2 font-mono">
                  Compatible with iOS &amp; Android mobile browsers
                </span>
              </div>
            </div>
          </div>

          {/* Authority Consoles Links */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Need Authority Consoles?</span>
            <button
              onClick={onLaunchDispatcher}
              className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-emerald-800 dark:text-emerald-300 hover:bg-slate-50 font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Transport Operator / Dispatcher</span>
            </button>
            <button
              onClick={onLaunchAdmin}
              className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Transit Authority Administrator</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. LIVE FLEET PULSE METRICS */}
      <section className="py-10 bg-emerald-50/50 dark:bg-slate-950/60 border-b border-emerald-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center shadow-xs">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-wider block">Live Fleet Active</span>
              <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mt-1 block">
                {activeBuses.length} <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold">/ {buses.length}</span>
              </span>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 block font-semibold flex items-center justify-center gap-1">
                <Activity className="w-3 h-3" />
                Real-time GPS active
              </span>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center shadow-xs">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-wider block">Punctuality Rate</span>
              <span className="text-3xl sm:text-4xl font-black text-emerald-700 dark:text-emerald-400 mt-1 block">
                98.4%
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Benchmark: 95%</span>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center shadow-xs">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-wider block">Average Delay</span>
              <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mt-1 block">
                +{delayedBuses.length > 0 ? '0.8' : '0.0'}m
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Across all city corridors</span>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center shadow-xs">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-wider block">Corridors Running</span>
              <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mt-1 block">
                {routes.length} Lines
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">High-frequency headway</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PLATFORM CAPABILITIES & SYSTEM ARCHITECTURE */}
      <section className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-[10px] uppercase font-black tracking-widest text-emerald-800 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-800">
            Intelligent Public Transport Platform
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">
            Smart ETA, Driver Mobile GPS &amp; Fleet Architecture
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Hardware-free public mobility connecting passengers, commercial drivers, and municipal transit dispatchers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Section 4 Driver Mobile GPS */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Navigation className="w-5 h-5" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Driver Mobile Phone GPS</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              No hardware transponders needed. Drivers stream live location from their smartphone GPS sensors or simulated route waypoints during travel.
            </p>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> High-accuracy mobile GPS stream</li>
              <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> Route simulation mode for demos</li>
              <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> Automatic stop proximity detection</li>
            </ul>
          </div>

          {/* Card 2: Section 5 Smart ETA & Prediction */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Smart ETA &amp; Delay Engine</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Dynamic arrival predictions factoring current location, distance, vehicle speed, dwell times, and real-time traffic delay factors.
            </p>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> Multi-factor ETA prediction algorithms</li>
              <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> Instant delay adjustment (traffic, breakdowns)</li>
              <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> Confidence &amp; accuracy reliability metrics</li>
            </ul>
          </div>

          {/* Card 3: Section 6 & 7 Fleet Dispatch & Alerts */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Radio className="w-5 h-5" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Operator Fleet Dispatch</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Dispatchers manage vehicle assignments, supervise active &amp; delayed corridors, and broadcast citywide emergency service advisories.
            </p>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> Transport operator bus-to-driver pairing</li>
              <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> Real-time emergency service bulletins</li>
              <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> Trip history &amp; demand analytics</li>
            </ul>
          </div>
        </div>

        {/* Call to Action Bar */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="font-black text-base text-slate-900 dark:text-white">Experience the Live Mobility Network</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Launch passenger tracking, mobile GPS driver terminal, or the dispatcher command console.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onLaunchPassenger}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Passenger App</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onLaunchDriver}
              className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-xl text-xs transition-all cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
            >
              <span>Driver Cockpit</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
