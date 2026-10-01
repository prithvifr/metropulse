import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ServiceAlert } from '../../types';
import { Bus, Home, User, Radio, Shield, Volume2, VolumeX, Moon, Sun, AlertTriangle } from 'lucide-react';

interface AppSwitcherProps {
  alerts: ServiceAlert[];
}

export const AppSwitcher: React.FC<AppSwitcherProps> = ({ alerts }) => {
  const {
    role,
    passengerSession,
    driverSession,
    switchRoleWithAuth,
    logoutRole,
    isDarkMode,
    toggleDarkMode,
    voiceAnnouncementsEnabled,
    setVoiceAnnouncementsEnabled,
    speakAnnouncement,
  } = useAuth();

  const activeAlerts = alerts.filter((a) => a.active);

  const isPassengerActive = role === 'passenger';
  const isDriverActive = role === 'driver';
  const isOperatorActive = role === 'operator';
  const isAdminActive = role === 'admin';

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-emerald-200 dark:border-slate-800 text-slate-800 dark:text-white shadow-xs font-sans select-none transition-colors">
      {/* 1. Emergency Broadcast Advisory Bar */}
      {activeAlerts.length > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 px-4 sm:px-8 py-1.5 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 truncate max-w-4xl">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
            </span>
            <span className="font-extrabold uppercase tracking-wider text-[10px] bg-emerald-200/80 dark:bg-emerald-900 text-emerald-950 dark:text-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              Live Transit Bulletin
            </span>
            <span className="font-medium truncate">
              {activeAlerts[0].title}: {activeAlerts[0].message}
            </span>
          </div>
          <button
            onClick={() => speakAnnouncement(`${activeAlerts[0].title}. ${activeAlerts[0].message}`)}
            className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 underline pl-3 cursor-pointer shrink-0 flex items-center gap-1"
          >
            <Volume2 className="w-3.5 h-3.5" />
            Audio Alert
          </button>
        </div>
      )}

      {/* 2. Main Platform Header Bar - asancars.co modern navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Brand: MetroPulse Public Transport */}
        <div
          onClick={() => switchRoleWithAuth('landing')}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
          title="Return to System Overview"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center font-black text-white shadow-md shadow-emerald-600/25 group-hover:scale-105 transition-transform">
            <Bus className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base sm:text-lg tracking-tight text-emerald-950 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                MetroPulse
              </span>
              <span className="hidden md:inline text-[9px] font-black tracking-wider text-emerald-800 dark:text-emerald-400 uppercase bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                Green Transit
              </span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
              <span>Smart Bus Tracking &amp; Mobility</span>
              <span>·</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">● Live Telemetry</span>
            </div>
          </div>
        </div>

        {/* 3. CORE APPLICATION ROLE SWITCHER */}
        <div className="flex items-center bg-emerald-50/80 dark:bg-slate-950 p-1 rounded-2xl border border-emerald-200 dark:border-slate-800 shadow-inner overflow-x-auto max-w-full">
          {/* Overview Tab */}
          <button
            onClick={() => switchRoleWithAuth('landing')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              role === 'landing'
                ? 'bg-white dark:bg-slate-800 text-emerald-950 dark:text-white border border-emerald-200 dark:border-slate-700 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-emerald-900 dark:hover:text-white hover:bg-emerald-100/50 dark:hover:bg-slate-800/40'
            }`}
            title="System Overview & Architecture"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Overview</span>
          </button>

          <div className="h-4 w-px bg-emerald-200 dark:bg-slate-800 mx-1 shrink-0"></div>

          {/* 1. PASSENGER APP */}
          <button
            onClick={() => switchRoleWithAuth('passenger')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              isPassengerActive
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-700 dark:text-slate-300 hover:text-emerald-900 dark:hover:text-white hover:bg-emerald-100/60 dark:hover:bg-slate-800'
            }`}
            title="Passenger Route Search, Live Tracker & ETA"
          >
            <User className="w-3.5 h-3.5" />
            <span>PASSENGER</span>
            {passengerSession && (
              <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" title="Authenticated"></span>
            )}
          </button>

          {/* 2. BUS & DRIVER GPS */}
          <button
            onClick={() => switchRoleWithAuth('driver')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              isDriverActive
                ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/20'
                : 'text-slate-700 dark:text-slate-300 hover:text-emerald-900 dark:hover:text-white hover:bg-emerald-100/60 dark:hover:bg-slate-800'
            }`}
            title="Bus Driver Cockpit & Real-time Mobile GPS Telemetry"
          >
            <Bus className="w-3.5 h-3.5" />
            <span>BUS / DRIVER</span>
            {driverSession && (
              <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" title="Authenticated"></span>
            )}
          </button>

          {/* 3. TRANSPORT OPERATOR / DISPATCHER */}
          <button
            onClick={() => switchRoleWithAuth('operator')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              isOperatorActive
                ? 'bg-teal-700 text-white shadow-md shadow-teal-700/20'
                : 'text-slate-700 dark:text-slate-300 hover:text-emerald-900 dark:hover:text-white hover:bg-emerald-100/60 dark:hover:bg-slate-800'
            }`}
            title="Fleet Radar, Terminal Departure Queues & Broadcast Messaging"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>OPERATOR / DISPATCHER</span>
          </button>

          {/* 4. ADMINISTRATOR */}
          <button
            onClick={() => switchRoleWithAuth('admin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              isAdminActive
                ? 'bg-slate-800 text-white shadow-md'
                : 'text-slate-700 dark:text-slate-300 hover:text-emerald-900 dark:hover:text-white hover:bg-emerald-100/60 dark:hover:bg-slate-800'
            }`}
            title="Route Heatmap, Trip History, Fleet Analytics & RBAC"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>ADMIN</span>
          </button>
        </div>

        {/* 4. Controls & Utilities */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Dark / Light Mode Toggle Button */}
          <button
            onClick={toggleDarkMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Toggle Light / Dark Mode"
          >
            {isDarkMode ? <Moon className="w-3.5 h-3.5 text-cyan-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
          </button>

          {/* Current Persona Status / Logout (if logged in) */}
          {(isPassengerActive && passengerSession) || (isDriverActive && driverSession) ? (
            <div className="pl-1">
              {isPassengerActive && passengerSession ? (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-slate-800 py-1 px-2.5 rounded-xl border border-emerald-200 dark:border-slate-700 text-xs">
                  <span className="text-emerald-800 dark:text-emerald-300 font-bold truncate max-w-[90px]">
                    {passengerSession.fullName.split(' ')[0]}
                  </span>
                  <button
                    onClick={() => logoutRole('passenger')}
                    className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
                  >
                    Logout
                  </button>
                </div>
              ) : isDriverActive && driverSession ? (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-slate-800 py-1 px-2.5 rounded-xl border border-emerald-200 dark:border-slate-700 text-xs">
                  <span className="text-emerald-800 dark:text-emerald-300 font-bold truncate max-w-[90px]">
                    {driverSession.driverName.split(' ')[0]}
                  </span>
                  <button
                    onClick={() => logoutRole('driver')}
                    className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};
