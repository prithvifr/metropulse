import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole, ServiceAlert } from '../types';
import {
  User,
  Bus,
  Radio,
  BarChart3,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  X,
  Navigation,
} from 'lucide-react';

interface NavbarProps {
  alerts: ServiceAlert[];
}

export const Navbar: React.FC<NavbarProps> = ({ alerts }) => {
  const {
    user,
    role,
    setRole,
    signInWithGoogle,
    signOut,
    isDarkMode,
    toggleDarkMode,
    selectedLanguage,
    setSelectedLanguage,
    voiceAnnouncementsEnabled,
    setVoiceAnnouncementsEnabled,
    speakAnnouncement,
  } = useAuth();

  const [showAlertDetails, setShowAlertDetails] = useState(false);
  const activeAlerts = alerts.filter((a) => a.active);

  const roleLabels: Record<UserRole, { label: string; Icon: React.ComponentType<{ className?: string }>; desc: string }> = {
    passenger: { label: 'Passenger', Icon: User, desc: 'Find routes & track buses' },
    driver: { label: 'Driver GPS', Icon: Bus, desc: 'Trip & live coordinates' },
    operator: { label: 'Dispatcher', Icon: Radio, desc: 'Fleet monitor & alerts' },
    admin: { label: 'Analytics', Icon: BarChart3, desc: 'KPIs & performance metrics' },
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      {/* 1. Critical Broadcast Alerts Ticker (if any alerts) */}
      {activeAlerts.length > 0 && (
        <div className="bg-amber-500/15 dark:bg-amber-950/40 border-b border-amber-500/20 text-amber-900 dark:text-amber-200 px-4 py-1.5 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="font-semibold uppercase tracking-wider text-[10px] bg-amber-200 dark:bg-amber-800/80 px-1.5 py-0.5 rounded text-amber-950 dark:text-amber-100">
              Service Advisory
            </span>
            <span className="font-medium truncate">{activeAlerts[0].title}: {activeAlerts[0].message}</span>
          </div>
          <div className="flex items-center gap-2 pl-3">
            <button
              onClick={() => {
                setShowAlertDetails(!showAlertDetails);
                speakAnnouncement(`${activeAlerts[0].title}. ${activeAlerts[0].message}`);
              }}
              className="underline text-[11px] hover:text-amber-700 dark:hover:text-amber-100 font-semibold cursor-pointer shrink-0"
            >
              {showAlertDetails ? 'Hide' : `View All (${activeAlerts.length})`}
            </button>
          </div>
        </div>
      )}

      {/* Expanded Alerts Modal / Panel */}
      {showAlertDetails && (
        <div className="px-4 py-3 bg-amber-50 dark:bg-slate-900 border-b border-amber-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 animate-in fade-in slide-in-from-top-2">
          <div className="max-w-7xl mx-auto space-y-2">
            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
              <span>Active Passenger Bulletins &amp; Route Advisories</span>
              <button
                onClick={() => setShowAlertDetails(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 text-xs"
              >
                <X className="w-3.5 h-3.5" /> Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {activeAlerts.map((alt) => (
                <div key={alt.alertId} className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-amber-200/60 dark:border-slate-700">
                  <div className="flex items-center justify-between font-semibold text-amber-700 dark:text-amber-400">
                    <span>{alt.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 uppercase">{alt.severity}</span>
                  </div>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">{alt.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Navigation className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent">
                MetroPulse
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                Transit OS
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
              Smart Public Transport &amp; Real-time GPS Tracking
            </p>
          </div>
        </div>

        {/* Role Switching Tabs (Desktop) */}
        <div className="hidden md:flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          {(['passenger', 'driver', 'operator', 'admin'] as UserRole[]).map((r) => {
            const isActive = role === r;
            const item = roleLabels[r];
            const RoleIcon = item.Icon;
            return (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  isActive
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title={item.desc}
              >
                <RoleIcon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Utilities: Voice, Language, Theme, Auth */}
        <div className="flex items-center gap-2">
          {/* Voice Announcer Toggle for Accessibility */}
          <button
            onClick={() => {
              const nextState = !voiceAnnouncementsEnabled;
              setVoiceAnnouncementsEnabled(nextState);
              if (nextState) {
                speakAnnouncement('Voice announcements enabled.');
              }
            }}
            className={`p-2 rounded-xl text-sm transition-colors border ${
              voiceAnnouncementsEnabled
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800'
            }`}
            title={voiceAnnouncementsEnabled ? 'Voice Announcements On' : 'Voice Announcements Muted'}
          >
            {voiceAnnouncementsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Language Selector */}
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value as any)}
            className="p-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="en">EN</option>
            <option value="es">ES</option>
            <option value="hi">HI</option>
            <option value="fr">FR</option>
          </select>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title="Toggle Theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300" />}
          </button>

          {/* User Sign In / Profile */}
          {user ? (
            <div className="flex items-center gap-2 pl-1">
              <img
                src={user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'}
                alt={user.displayName || 'User'}
                className="w-8 h-8 rounded-full border border-blue-500/50"
              />
              <button
                onClick={signOut}
                className="hidden lg:block text-xs font-medium text-rose-500 hover:text-rose-600 dark:hover:text-rose-400"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all active:scale-95"
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Mobile Role Navigation Bar (Bottom on mobile) */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-1.5 px-2">
        {(['passenger', 'driver', 'operator', 'admin'] as UserRole[]).map((r) => {
          const isActive = role === r;
          const item = roleLabels[r];
          const RoleIcon = item.Icon;
          return (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`flex flex-col items-center py-1 px-3 rounded-lg text-[11px] font-semibold transition-all ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <RoleIcon className="w-4 h-4 mb-0.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
