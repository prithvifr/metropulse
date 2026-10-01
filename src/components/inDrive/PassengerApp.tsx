import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Bus, TransitRoute, BusStop, DigitalTicket, TransferRouteOption } from '../../types';
import { findRoutesBetweenStops, predictETA } from '../../utils/etaCalculator';
import { useAuth } from '../../context/AuthContext';
import { TransitMap } from '../Map/TransitMap';
import { DigitalTicketModal } from '../Common/DigitalTicketModal';
import { issueTicketInFirestore, validateTicketInFirestore } from '../../services/firestoreService';
import {
  Search,
  MapPin,
  User,
  Ticket,
  Bell,
  BellOff,
  CircleDot,
  ArrowUpDown,
  Bookmark,
  BookmarkCheck,
  Footprints,
  X,
  Gauge,
  ArrowRight,
  Bus as BusIcon,
  CheckCircle2,
  Navigation,
  Clock,
  Radio,
  LocateFixed,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

export type JourneyStep = 'search' | 'routes' | 'buses' | 'tracking';

interface PassengerAppProps {
  routes: TransitRoute[];
  buses: Bus[];
  selectedRouteId: string;
  selectedBusId: string;
  selectedStopId: string;
  onSelectRoute: (routeId: string) => void;
  onSelectBus: (busId: string) => void;
  onSelectStop: (stop: BusStop, route: TransitRoute) => void;
}

export const PassengerApp: React.FC<PassengerAppProps> = ({
  routes,
  buses,
  selectedRouteId,
  selectedBusId,
  selectedStopId,
  onSelectRoute,
  onSelectBus,
  onSelectStop,
}) => {
  const { user, showNotification, speakAnnouncement, passengerSession } = useAuth();

  // Progressive Journey Step: 'search' -> 'routes' -> 'buses' -> 'tracking'
  const [journeyStep, setJourneyStep] = useState<JourneyStep>('search');

  // Search & Filter State
  const [fromStop, setFromStop] = useState<string>('City Center');
  const [toStop, setToStop] = useState<string>('University Gate');
  const [routeFilter, setRouteFilter] = useState<string>('all');
  const [activeTicket, setActiveTicket] = useState<DigitalTicket | null>(null);
  const [crowdReports, setCrowdReports] = useState<Record<string, string>>({});
  const [followBusOnMap, setFollowBusOnMap] = useState<boolean>(true);

  // Mobile layout switcher for tracking step: 'panel' or 'map'
  const [mobileTab, setMobileTab] = useState<'panel' | 'map'>('panel');

  // Favorite routes
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('metropulse_favs') || '["route-07"]');
    } catch {
      return ['route-07'];
    }
  });

  // All unique stops across network
  const allStops = useMemo(() => {
    const names = new Set<string>();
    routes.forEach((r) => r.stops.forEach((s) => names.add(s.stopName)));
    return Array.from(names);
  }, [routes]);

  // Route search calculation
  const searchResults: TransferRouteOption[] = useMemo(() => {
    const results = findRoutesBetweenStops(routes, buses, fromStop, toStop);
    if (routeFilter === 'all') return results;
    return results.filter((opt) => opt.legs.some((leg) => leg.route.routeId === routeFilter));
  }, [routes, buses, fromStop, toStop, routeFilter]);

  // Active selected route
  const activeRoute = useMemo(() => {
    if (selectedRouteId) {
      const found = routes.find((r) => r.routeId === selectedRouteId);
      if (found) return found;
    }
    return routes[0];
  }, [routes, selectedRouteId]);

  // Approaching / active buses on the selected route
  const busesOnActiveRoute = useMemo(() => {
    if (!activeRoute) return [];
    return buses.filter((b) => b.routeId === activeRoute.routeId && b.status !== 'Offline');
  }, [buses, activeRoute]);

  // Active selected bus
  const activeBus = useMemo(() => {
    if (selectedBusId) {
      const found = buses.find((b) => b.busId === selectedBusId);
      if (found) return found;
    }
    if (busesOnActiveRoute.length > 0) return busesOnActiveRoute[0];
    return buses.find((b) => b.status === 'On Route') || buses[0];
  }, [buses, selectedBusId, busesOnActiveRoute]);

  // Target Stop for ETA: prioritize the passenger's destination stop if on the route, else selectedStopId
  const targetStop = useMemo(() => {
    if (!activeRoute) return null;
    const matchDestination = activeRoute.stops.find(
      (s) => s.stopName.toLowerCase().trim() === toStop.toLowerCase().trim()
    );
    if (matchDestination) return matchDestination;
    const matchSelected = activeRoute.stops.find((s) => s.stopId === selectedStopId);
    if (matchSelected) return matchSelected;
    return activeRoute.stops[activeRoute.stops.length - 1];
  }, [activeRoute, toStop, selectedStopId]);

  // Current bus nearest stop
  const currentBusStop = useMemo(() => {
    if (!activeBus || !activeRoute) return null;
    // Find nearest stop to current coordinates
    let nearest: BusStop = activeRoute.stops[0];
    let minDistance = Infinity;
    activeRoute.stops.forEach((s) => {
      const d = Math.hypot(s.latitude - activeBus.currentLat, s.longitude - activeBus.currentLng);
      if (d < minDistance) {
        minDistance = d;
        nearest = s;
      }
    });
    return nearest;
  }, [activeBus, activeRoute]);

  // Next stop along route
  const nextBusStop = useMemo(() => {
    if (!currentBusStop || !activeRoute) return null;
    const idx = activeRoute.stops.findIndex((s) => s.stopId === currentBusStop.stopId);
    if (idx >= 0 && idx < activeRoute.stops.length - 1) {
      return activeRoute.stops[idx + 1];
    }
    return activeRoute.stops[activeRoute.stops.length - 1];
  }, [currentBusStop, activeRoute]);

  // Smart ETA Prediction Engine (calculates continuously from live telemetry)
  const etaData = useMemo(() => {
    if (!activeBus || !activeRoute || !targetStop) return null;
    const currentIdx = currentBusStop
      ? activeRoute.stops.findIndex((s) => s.stopId === currentBusStop.stopId)
      : 0;
    return predictETA(activeBus, activeRoute, targetStop, Math.max(0, currentIdx));
  }, [activeBus, activeRoute, targetStop, currentBusStop]);

  // Has bus arrived at passenger's stop?
  const hasBusArrived = useMemo(() => {
    if (!etaData) return false;
    return etaData.distanceKm < 0.25 || etaData.estimatedMinutes <= 1;
  }, [etaData]);

  const handleSwapStops = () => {
    const temp = fromStop;
    setFromStop(toStop);
    setToStop(temp);
  };

  // Real-Time Stop Proximity Notification Listener
  const [arrivalAlertsEnabled, setArrivalAlertsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('metropulse_arrival_alerts') !== 'false';
    } catch {
      return true;
    }
  });

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const [approachingAlert, setApproachingAlert] = useState<{
    busId: string;
    busNumber: string;
    stopName: string;
    minutes: number;
    distanceKm: number;
    timestamp: number;
  } | null>(null);

  const notifiedCycleRef = useRef<string | null>(null);

  const requestBrowserNotification = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
        if (perm === 'granted') {
          showNotification('Browser notifications enabled for approaching buses');
          try {
            new Notification('MetroPulse Transit Alerts Active', {
              body: 'You will receive real-time notifications when your tracked bus approaches your stop.',
              icon: '/favicon.ico',
            });
          } catch {}
        } else if (perm === 'denied') {
          showNotification('Browser notification permission was denied. In-app alerts will be used.');
        }
      } catch (err) {
        console.warn('Notification permission error', err);
      }
    }
  };

  // Trigger notification when bus is approaching selected stop
  useEffect(() => {
    if (journeyStep !== 'tracking') return;
    if (!arrivalAlertsEnabled || !etaData || !activeBus || !targetStop) return;

    const remainingMinutes = etaData.estimatedMinutes;
    const distanceKm = etaData.distanceKm;

    if (remainingMinutes <= 3 && distanceKm <= 1.8) {
      const alertKey = `${activeBus.busId}-${targetStop.stopId}-${Math.floor(Date.now() / 120000)}`;

      if (notifiedCycleRef.current !== alertKey) {
        notifiedCycleRef.current = alertKey;

        setApproachingAlert({
          busId: activeBus.busId,
          busNumber: activeBus.busNumber,
          stopName: targetStop.stopName,
          minutes: remainingMinutes,
          distanceKm: distanceKm,
          timestamp: Date.now(),
        });

        const alertSpeech = `Attention: Bus ${activeBus.busNumber} is approaching ${targetStop.stopName}. Estimated arrival in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`;
        speakAnnouncement(alertSpeech);
        showNotification(`Bus ${activeBus.busNumber} is approaching ${targetStop.stopName} (~${remainingMinutes}m)!`);

        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(`Bus Approaching ${targetStop.stopName}!`, {
              body: `Bus ${activeBus.busNumber} is approx ${distanceKm.toFixed(1)} km away (${remainingMinutes}m). Please prepare to board.`,
              icon: '/favicon.ico',
              tag: `bus-approach-${activeBus.busId}`,
            });
          } catch {}
        }
      }
    }
  }, [journeyStep, etaData, arrivalAlertsEnabled, activeBus, targetStop, showNotification, speakAnnouncement]);

  const handleToggleArrivalAlerts = () => {
    const next = !arrivalAlertsEnabled;
    setArrivalAlertsEnabled(next);
    localStorage.setItem('metropulse_arrival_alerts', String(next));
    showNotification(next ? 'Stop proximity alerts enabled' : 'Stop proximity alerts muted');
  };

  const handleBookTicket = (route: TransitRoute, fare: number) => {
    const ticketId = `PASS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const now = new Date();
    const expiry = new Date(now.getTime() + 3 * 3600000);

    const ticket: DigitalTicket = {
      ticketId,
      userId: user?.uid || 'guest-passenger',
      routeId: route.routeId,
      routeName: route.routeName,
      fromStop,
      toStop,
      passengerName: passengerSession?.fullName || user?.displayName || 'Passenger',
      fare,
      status: 'valid',
      qrCode: `TRANSIT-PASS|${ticketId}|${fromStop}|${toStop}|${fare}`,
      purchaseTime: now.toISOString(),
      expiryTime: expiry.toISOString(),
    };

    setActiveTicket(ticket);
    issueTicketInFirestore(ticket).catch(console.error);
    showNotification(`Digital pass issued for ${route.routeName}! Saved to database.`);
    speakAnnouncement(`Transit ticket confirmed on ${route.routeName} from ${fromStop} to ${toStop}.`);
  };

  const handleCrowdVote = async (busId: string, level: 'low' | 'medium' | 'high') => {
    setCrowdReports((prev) => ({ ...prev, [busId]: level }));
    try {
      await fetch('/api/crowd/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ busId, crowdLevel: level }),
      });
      showNotification(`Crowd report logged: ${level.toUpperCase()}`);
    } catch {
      showNotification('Vote registered');
    }
  };

  const toggleFavorite = (routeId: string) => {
    let next: string[];
    if (favorites.includes(routeId)) {
      next = favorites.filter((id) => id !== routeId);
      showNotification('Removed from saved routes');
    } else {
      next = [...favorites, routeId];
      showNotification('Route saved to favorites');
    }
    setFavorites(next);
    localStorage.setItem('metropulse_favs', JSON.stringify(next));
  };

  // Progression Handlers
  const handlePerformSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!fromStop.trim() || !toStop.trim()) {
      showNotification('Please enter both origin and destination stops');
      return;
    }
    if (fromStop.trim().toLowerCase() === toStop.trim().toLowerCase()) {
      showNotification('Origin and destination cannot be the same stop');
      return;
    }
    setJourneyStep('routes');
  };

  const handleSelectRouteAndProceed = (routeId: string) => {
    onSelectRoute(routeId);
    setJourneyStep('buses');
  };

  const handleSelectBusAndTrack = (busId: string) => {
    onSelectBus(busId);
    setJourneyStep('tracking');
    setMobileTab('panel');
    speakAnnouncement(`Now tracking Bus. Live location and arrival updates active.`);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden font-sans bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      {/* Top Breadcrumb Journey Stepper */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 overflow-x-auto text-xs">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Step 1 */}
            <button
              onClick={() => setJourneyStep('search')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                journeyStep === 'search'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-black/20 flex items-center justify-center text-[10px]">1</span>
              <span>Search Route</span>
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

            {/* Step 2 */}
            <button
              onClick={() => {
                if (searchResults.length > 0) setJourneyStep('routes');
              }}
              disabled={journeyStep === 'search'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                journeyStep === 'routes'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : journeyStep === 'buses' || journeyStep === 'tracking'
                  ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  : 'text-slate-400 dark:text-slate-600 opacity-50 cursor-not-allowed'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-black/20 flex items-center justify-center text-[10px]">2</span>
              <span>Select Route</span>
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

            {/* Step 3 */}
            <button
              onClick={() => {
                if (selectedRouteId) setJourneyStep('buses');
              }}
              disabled={journeyStep === 'search' || journeyStep === 'routes'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                journeyStep === 'buses'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : journeyStep === 'tracking'
                  ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  : 'text-slate-400 dark:text-slate-600 opacity-50 cursor-not-allowed'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-black/20 flex items-center justify-center text-[10px]">3</span>
              <span>Approaching Buses</span>
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

            {/* Step 4 */}
            <button
              disabled={journeyStep !== 'tracking'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                journeyStep === 'tracking'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 dark:text-slate-600 opacity-50 cursor-not-allowed'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-black/20 flex items-center justify-center text-[10px]">4</span>
              <span>Live Bus Tracking</span>
            </button>
          </div>

          {activeTicket && (
            <button
              onClick={() => setActiveTicket(activeTicket)}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-black px-3 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0"
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>My Ticket</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Body per Step */}
      <div className="flex-1 flex overflow-hidden">
        {/* ========================================================================= */}
        {/* STEP 1: INITIAL SEARCH FORM ONLY (Clean, uncluttered, focused)             */}
        {/* ========================================================================= */}
        {journeyStep === 'search' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex items-center justify-center">
            <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
              {/* Header */}
              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto shadow-xs">
                  <Navigation className="w-6 h-6" />
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  Plan Your Public Transport Journey
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Search any origin and destination stop to find approaching buses and track them live with real-time ETA.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handlePerformSearch} className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  {/* Origin */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                      Starting Point (Origin Stop)
                    </label>
                    <div className="flex items-center gap-2.5 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 border border-slate-200 dark:border-slate-800">
                      <CircleDot className="w-4 h-4 text-emerald-600 shrink-0" />
                      <input
                        type="text"
                        list="passenger-stops-list"
                        value={fromStop}
                        onChange={(e) => setFromStop(e.target.value)}
                        placeholder="e.g. City Center"
                        className="w-full bg-transparent text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={handleSwapStops}
                        className="p-1 text-slate-400 hover:text-emerald-600 transition-colors"
                        title="Swap Origin and Destination"
                      >
                        <ArrowUpDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Destination */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                      Destination Stop
                    </label>
                    <div className="flex items-center gap-2.5 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 border border-slate-200 dark:border-slate-800">
                      <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                      <input
                        type="text"
                        list="passenger-stops-list"
                        value={toStop}
                        onChange={(e) => setToStop(e.target.value)}
                        placeholder="e.g. University Gate"
                        className="w-full bg-transparent text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <datalist id="passenger-stops-list">
                    {allStops.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>

                {/* Quick Stops Suggestions */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                    Quick Destination Suggestions:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {['City Center', 'Main Market', 'Railway Station', 'University Gate', 'Harbor Pier'].map(
                      (stopName) => (
                        <button
                          key={stopName}
                          type="button"
                          onClick={() => setToStop(stopName)}
                          className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium transition-colors"
                        >
                          {stopName}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-black text-sm shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  <span>Find Available Routes &amp; Buses</span>
                </button>
              </form>

              {/* Popular Routes Quick Launch */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                  Or select a popular corridor directly:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {routes.slice(0, 4).map((r) => (
                    <button
                      key={r.routeId}
                      type="button"
                      onClick={() => {
                        setFromStop(r.startLocation);
                        setToStop(r.destination);
                        onSelectRoute(r.routeId);
                        setJourneyStep('buses');
                      }}
                      className="p-3 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800 text-left transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-7 h-7 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0"
                          style={{ backgroundColor: r.color || '#059669' }}
                        >
                          {r.routeNumber}
                        </span>
                        <div className="overflow-hidden">
                          <b className="text-slate-900 dark:text-white block truncate text-[11px]">{r.routeName.split(':')[0]}</b>
                          <span className="text-[10px] text-slate-500 truncate block">{r.startLocation} → {r.destination}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: SUITABLE ROUTES LIST (Once searched, show routes)                   */}
        {/* ========================================================================= */}
        {journeyStep === 'routes' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-5">
            {/* Header & Back to Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Search Results for:
                </span>
                <div className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
                  <span>{fromStop}</span>
                  <ArrowRight className="w-4 h-4 text-emerald-600 inline" />
                  <span>{toStop}</span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {searchResults.length} suitable route option{searchResults.length === 1 ? '' : 's'} found
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setJourneyStep('search')}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Modify Search</span>
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-bold text-[11px]">Filter:</span>
              <button
                onClick={() => setRouteFilter('all')}
                className={`px-3 py-1 rounded-lg font-bold border transition-colors ${
                  routeFilter === 'all'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                }`}
              >
                All Corridors ({searchResults.length})
              </button>
            </div>

            {/* Routes List */}
            {searchResults.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-500 space-y-3">
                <p className="text-xs">No direct or transfer route found between {fromStop} and {toStop}.</p>
                <button
                  onClick={() => setJourneyStep('search')}
                  className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs"
                >
                  Change Origin / Destination
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.map((option, idx) => {
                  const firstLeg = option.legs[0];
                  const isDirect = option.type === 'direct';

                  return (
                    <div
                      key={idx}
                      className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 shadow-xs transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base text-white shadow-xs"
                            style={{ backgroundColor: firstLeg.route.color || '#059669' }}
                          >
                            {firstLeg.route.routeNumber}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-black text-sm text-slate-900 dark:text-white">
                                {isDirect ? firstLeg.route.routeName : `Transfer Connection via ${option.transferStop}`}
                              </h3>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                  isDirect
                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400'
                                    : 'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-400'
                                }`}
                              >
                                {isDirect ? 'Direct Route' : 'Transfer Route'}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                              Approx ~{option.totalDurationMinutes} mins total travel time • Frequency: every {firstLeg.route.frequencyMinutes}m
                            </span>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                          <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                            ${option.totalFare.toFixed(2)}
                          </span>
                          <button
                            onClick={() => toggleFavorite(firstLeg.route.routeId)}
                            className="text-xs text-slate-400 hover:text-amber-500 mt-1"
                          >
                            {favorites.includes(firstLeg.route.routeId) ? (
                              <span className="flex items-center gap-1 text-amber-500 font-semibold text-[11px]">
                                <BookmarkCheck className="w-3.5 h-3.5" />
                                Saved
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-slate-400 hover:text-amber-500 text-[11px]">
                                <Bookmark className="w-3.5 h-3.5" />
                                Save
                              </span>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Route Details breakdown */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                        {option.legs.map((leg, lIdx) => (
                          <div key={lIdx} className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                            <span className="font-semibold">
                              Leg {lIdx + 1}: Line {leg.route.routeNumber} ({leg.fromStop} → {leg.toStop})
                            </span>
                            <span className="text-slate-400 font-mono text-[11px]">{leg.stopsCount} stops</span>
                          </div>
                        ))}
                        {!isDirect && (
                          <div className="text-[11px] text-teal-800 dark:text-teal-300 flex items-center gap-1.5 font-semibold pt-1 border-t border-slate-200 dark:border-slate-800">
                            <Footprints className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            <span>Transfer Recommendation: Take Route 3 → Get off at City Center → Take Route 9 → University Gate</span>
                          </div>
                        )}
                      </div>

                      {/* Action: Select Route */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {firstLeg.busApproaching
                            ? `Next bus approaching: ${firstLeg.busApproaching.busNumber}`
                            : `Regular service active`}
                        </span>
                        <button
                          onClick={() => handleSelectRouteAndProceed(firstLeg.route.routeId)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-xl text-xs shadow-xs transition-all flex items-center gap-1.5"
                        >
                          <span>Select Route &amp; View Buses</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: APPROACHING BUSES LIST (Once route selected, show approaching buses) */}
        {/* ========================================================================= */}
        {journeyStep === 'buses' && activeRoute && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-5">
            {/* Header & Back to Routes */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg text-white shadow-xs"
                    style={{ backgroundColor: activeRoute.color || '#059669' }}
                  >
                    {activeRoute.routeNumber}
                  </span>
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                      {activeRoute.routeName}
                    </h2>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {activeRoute.startLocation} → {activeRoute.destination} • {activeRoute.stops.length} Stops • Headway: {activeRoute.frequencyMinutes}m
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setJourneyStep('routes')}
                  className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back to Routes</span>
                </button>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-300 flex items-center justify-between">
                <span>
                  Select an approaching bus below to track its live GPS location and arrival countdown.
                </span>
                <span className="font-bold">{busesOnActiveRoute.length} Active Bus{busesOnActiveRoute.length === 1 ? '' : 'es'}</span>
              </div>
            </div>

            {/* List of Approaching Buses on this Route */}
            <div className="space-y-3">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <BusIcon className="w-4 h-4 text-emerald-600" />
                <span>Approaching Buses on {activeRoute.routeNumber}</span>
              </h3>

              {busesOnActiveRoute.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-500 space-y-3">
                  <p className="text-xs">No active buses currently on this line (all offline or in depot).</p>
                  <p className="text-[11px] text-slate-400">Next scheduled departure in ~{activeRoute.frequencyMinutes} minutes.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {busesOnActiveRoute.map((bus) => {
                    // Approximate next stop
                    const isDelayed = bus.status === 'Delayed' || bus.currentDelay >= 4;

                    return (
                      <div
                        key={bus.busId}
                        className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 shadow-xs transition-all space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-900 dark:text-white text-sm border border-slate-200 dark:border-slate-700">
                              {bus.busNumber}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-black text-sm text-slate-900 dark:text-white">
                                  Bus {bus.busNumber}
                                </h4>
                                <span className="text-[11px] font-mono text-slate-400">
                                  ({bus.vehicleNumber})
                                </span>
                                <span
                                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                    isDelayed
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300'
                                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                  }`}
                                >
                                  {isDelayed ? `Delayed (+${bus.currentDelay}m)` : 'On Time'}
                                </span>
                              </div>
                              <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                                Capacity: {bus.capacity} seats • Speed: {Math.round(bus.currentSpeed)} km/h
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleSelectBusAndTrack(bus.busId)}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-xl text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 self-stretch sm:self-auto"
                          >
                            <LocateFixed className="w-3.5 h-3.5" />
                            <span>Track This Bus &amp; View ETA</span>
                          </button>
                        </div>

                        {/* Location / ETA Preview bar */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Location</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                              Near Main Market
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Next Stop</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                              Railway Station
                            </span>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">ETA to your Stop</span>
                            <span className="font-black text-emerald-600 dark:text-emerald-400 block">
                              ~8 Minutes
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: LIVE BUS TRACKING & MAP JOURNEY (Displays location, ETA, Follow)   */}
        {/* ========================================================================= */}
        {journeyStep === 'tracking' && activeBus && activeRoute && (
          <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
            {/* Mobile Tab Switcher */}
            <div className="lg:hidden flex items-center bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-2 shrink-0">
              <button
                onClick={() => setMobileTab('panel')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  mobileTab === 'panel' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <LocateFixed className="w-3.5 h-3.5" />
                <span>BUS TRACKER &amp; ETA</span>
              </button>
              <button
                onClick={() => setMobileTab('map')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  mobileTab === 'map' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>LIVE MAP</span>
              </button>
            </div>

            {/* Left Sidebar: Detailed Live Telemetry, ETA & Stops Tracker */}
            <div
              className={`w-full lg:w-[480px] xl:w-[500px] flex-shrink-0 h-full overflow-y-auto bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs ${
                mobileTab === 'panel' ? 'block' : 'hidden lg:block'
              }`}
            >
              {/* Back / Navigation Bar */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setJourneyStep('buses')}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Change Bus</span>
                </button>

                <button
                  onClick={() => setJourneyStep('search')}
                  className="text-xs text-slate-500 hover:text-emerald-600 font-bold"
                >
                  New Search
                </button>
              </div>

              {/* Arrived Celebration Banner if at passenger stop */}
              {hasBusArrived && (
                <div className="p-4 bg-emerald-500 text-white rounded-3xl shadow-md flex items-center gap-3 animate-bounce">
                  <CheckCircle2 className="w-6 h-6 shrink-0" />
                  <div>
                    <b className="text-sm block">Bus Has Reached Your Stop!</b>
                    <span className="text-xs text-emerald-100">
                      Bus {activeBus.busNumber} is at {targetStop?.stopName}. Please prepare to board!
                    </span>
                  </div>
                </div>
              )}

              {/* Stop Proximity Alert Banner */}
              {approachingAlert && !hasBusArrived && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 rounded-3xl shadow-sm flex items-center justify-between gap-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4 text-white" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-700 text-white px-2 py-0.5 rounded-full">
                        APPROACHING YOUR STOP
                      </span>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Bus {approachingAlert.busNumber} is ~{approachingAlert.minutes}m away ({approachingAlert.distanceKm.toFixed(1)} km).
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setApproachingAlert(null)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Tracked Bus Card */}
              <div className="p-5 bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs text-white"
                        style={{ backgroundColor: activeRoute.color || '#059669' }}
                      >
                        {activeRoute.routeNumber}
                      </span>
                      <h3 className="font-black text-base text-slate-900 dark:text-white">
                        Bus {activeBus.busNumber}
                      </h3>
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          activeBus.status === 'Delayed' || activeBus.currentDelay >= 4
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        }`}
                      >
                        {activeBus.status === 'Delayed' || activeBus.currentDelay >= 4
                          ? `Delayed (+${activeBus.currentDelay}m)`
                          : 'On Time'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                      {activeRoute.routeName}
                    </span>
                  </div>

                  {/* Auto-Follow Bus Toggle */}
                  <button
                    onClick={() => setFollowBusOnMap(!followBusOnMap)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                      followBusOnMap
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                    title="Automatically centers the map on the bus coordinates as it travels"
                  >
                    <LocateFixed className="w-3.5 h-3.5" />
                    <span>Follow Bus</span>
                  </button>
                </div>

                {/* Big Live ETA Display */}
                {etaData && (
                  <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">
                        Estimated Arrival Time (ETA)
                      </span>
                      <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                        {etaData.formattedArrival}
                      </div>
                      <span className="text-xs text-slate-600 dark:text-slate-400 block font-semibold">
                        To your stop: <b className="text-slate-900 dark:text-white">{targetStop?.stopName}</b>
                      </span>
                    </div>

                    <div className="text-right space-y-1 font-mono text-xs">
                      <div className="text-slate-500 dark:text-slate-400">
                        Distance: <b className="text-slate-900 dark:text-white">{etaData.distanceKm.toFixed(1)} km</b>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        Speed: <b className="text-emerald-600 dark:text-emerald-400">{etaData.currentSpeedKmh} km/h</b>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        Status: <b className="text-slate-900 dark:text-white">{etaData.status}</b>
                      </div>
                    </div>
                  </div>
                )}

                {/* Current Location & Next Stop Specs */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Bus Location</span>
                    <span className="font-bold text-slate-900 dark:text-white block truncate mt-0.5">
                      {currentBusStop?.stopName || 'En Route'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 block truncate">
                      {activeBus.currentLat.toFixed(4)}, {activeBus.currentLng.toFixed(4)}
                    </span>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Next Upcoming Stop</span>
                    <span className="font-bold text-slate-900 dark:text-white block truncate mt-0.5">
                      {nextBusStop?.stopName || 'Terminus'}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-bold">
                      Approaching now
                    </span>
                  </div>
                </div>

                {/* Live Route Stop Progress Timeline */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">
                      Live Route Stop Progress:
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Updates continuously as bus travels
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {activeRoute.stops.map((stop, sIdx) => {
                      const isCurrent = currentBusStop?.stopId === stop.stopId;
                      const isTarget = targetStop?.stopId === stop.stopId;
                      const currentIdx = currentBusStop
                        ? activeRoute.stops.findIndex((s) => s.stopId === currentBusStop.stopId)
                        : -1;
                      const hasPassed = currentIdx > sIdx;

                      return (
                        <div
                          key={stop.stopId}
                          onClick={() => onSelectStop(stop, activeRoute)}
                          className={`p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-all ${
                            isCurrent
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-400 font-bold text-emerald-900 dark:text-emerald-200'
                              : isTarget
                              ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-400 font-bold text-blue-900 dark:text-blue-200'
                              : hasPassed
                              ? 'text-slate-400 line-through'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isCurrent ? (
                              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] animate-pulse">
                                <BusIcon className="w-3 h-3" />
                              </span>
                            ) : (
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  hasPassed
                                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                    : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 border border-emerald-300'
                                }`}
                              >
                                {sIdx + 1}
                              </span>
                            )}
                            <span className="truncate">{stop.stopName}</span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px]">
                            {isCurrent && <span className="text-emerald-700 dark:text-emerald-400 font-bold">BUS HERE</span>}
                            {isTarget && <span className="text-blue-700 dark:text-blue-400 font-bold">YOUR STOP</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ticket Booking & Crowd Actions */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  {activeTicket ? (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl shadow-inner animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                          <Ticket className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          Digital Pass Active
                        </span>
                        <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-700">
                          {activeTicket.ticketId}
                        </span>
                      </div>
                      
                      <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 pt-2 border-t border-blue-200/50 dark:border-blue-800/50">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Route:</span>
                          <span className="font-bold text-slate-900 dark:text-white truncate pl-4">{activeTicket.routeName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">From:</span>
                          <span className="font-semibold truncate pl-4">{activeTicket.fromStop}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">To:</span>
                          <span className="font-semibold truncate pl-4">{activeTicket.toStop}</span>
                        </div>
                        {etaData && (
                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-blue-200/50 dark:border-blue-800/50">
                            <span className="font-bold text-blue-800 dark:text-blue-200">ETA to stop:</span>
                            <span className="font-black text-[13px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              <span className="relative flex h-2 w-2 mr-1">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                              </span>
                              ~{etaData.remainingMinutes} min
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleBookTicket(activeRoute, 2.5)}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <Ticket className="w-3.5 h-3.5" />
                        <span>Get Digital Ride Pass ($2.50)</span>
                      </button>

                      <div className="flex items-center gap-1 text-xs">
                        {(['low', 'medium', 'high'] as const).map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() => handleCrowdVote(activeBus.busId, lvl)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                              crowdReports[activeBus.busId] === lvl
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                            title="Report crowd level for this bus"
                          >
                            {lvl === 'low' ? 'Seats' : lvl === 'medium' ? 'Standing' : 'Crowded'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Map View (Centers on the tracked bus and follows it) */}
            <div
              className={`flex-1 h-full relative ${
                mobileTab === 'map' ? 'block' : 'hidden lg:block'
              }`}
            >
              <TransitMap
                buses={buses}
                routes={routes}
                selectedRouteId={activeRoute.routeId}
                selectedBusId={followBusOnMap ? activeBus.busId : undefined}
                selectedStopId={targetStop?.stopId}
                onSelectBus={(bus) => onSelectBus(bus.busId)}
                onSelectStop={(stop, route) => onSelectStop(stop, route)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Digital Pass Modal */}
      <DigitalTicketModal
        ticket={activeTicket}
        onClose={() => setActiveTicket(null)}
        onValidatePass={(ticketId) => {
          validateTicketInFirestore(ticketId).catch(console.error);
          showNotification('Ticket verified and status set to USED in database!');
        }}
      />
    </div>
  );
};
