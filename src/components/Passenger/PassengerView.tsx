import React, { useState, useMemo } from 'react';
import { Bus, TransitRoute, BusStop, DigitalTicket, TransferRouteOption } from '../../types';
import { findRoutesBetweenStops, predictETA } from '../../utils/etaCalculator';
import { useAuth } from '../../context/AuthContext';
import { DigitalTicketModal } from '../Common/DigitalTicketModal';
import {
  Search,
  CircleDot,
  MapPin,
  ArrowRightLeft,
  Map,
  Star,
  User,
  Ticket,
  Bus as BusIcon,
  Volume2,
  Flag,
} from 'lucide-react';

interface PassengerViewProps {
  routes: TransitRoute[];
  buses: Bus[];
  selectedRouteId?: string;
  selectedBusId?: string;
  onSelectRoute: (routeId: string) => void;
  onSelectBus: (busId: string) => void;
  onSelectStop: (stop: BusStop) => void;
}

export const PassengerView: React.FC<PassengerViewProps> = ({
  routes,
  buses,
  selectedRouteId,
  selectedBusId,
  onSelectRoute,
  onSelectBus,
  onSelectStop,
}) => {
  const { user, showNotification, speakAnnouncement } = useAuth();

  // Search State
  const [fromStop, setFromStop] = useState<string>('Central Transit Hub');
  const [toStop, setToStop] = useState<string>('University Campus Gate');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('metropulse_favs') || '["route-05"]');
    } catch {
      return ['route-05'];
    }
  });

  // Ticket modal
  const [activeTicket, setActiveTicket] = useState<DigitalTicket | null>(null);

  // All unique stop names for auto-suggest
  const allStops = useMemo(() => {
    const names = new Set<string>();
    routes.forEach((r) => r.stops.forEach((s) => names.add(s.stopName)));
    return Array.from(names);
  }, [routes]);

  // Route search calculation
  const searchResults: TransferRouteOption[] = useMemo(() => {
    return findRoutesBetweenStops(routes, buses, fromStop, toStop);
  }, [routes, buses, fromStop, toStop]);

  // Selected Bus Detail
  const selectedBus = useMemo(() => {
    return buses.find((b) => b.busId === selectedBusId) || buses.find((b) => b.status === 'On Route') || buses[0];
  }, [buses, selectedBusId]);

  // Selected Route Detail
  const selectedRoute = useMemo(() => {
    if (selectedRouteId) return routes.find((r) => r.routeId === selectedRouteId);
    if (selectedBus) return routes.find((r) => r.routeId === selectedBus.routeId);
    return routes[0];
  }, [routes, selectedRouteId, selectedBus]);

  // Target Stop ETA (e.g. next stop or toStop)
  const etaDetails = useMemo(() => {
    if (!selectedBus || !selectedRoute) return null;
    const target = selectedRoute.stops.find((s) => s.stopName.toLowerCase().includes(toStop.toLowerCase())) ||
      selectedRoute.stops[selectedRoute.stops.length - 1];
    return predictETA(selectedBus, selectedRoute, target);
  }, [selectedBus, selectedRoute, toStop]);

  const toggleFavorite = (routeId: string) => {
    let next: string[];
    if (favorites.includes(routeId)) {
      next = favorites.filter((id) => id !== routeId);
      showNotification('Removed route from saved favorites');
    } else {
      next = [...favorites, routeId];
      showNotification('Added route to saved favorites');
    }
    setFavorites(next);
    localStorage.setItem('metropulse_favs', JSON.stringify(next));
  };

  const handleSwapStops = () => {
    const temp = fromStop;
    setFromStop(toStop);
    setToStop(temp);
  };

  const handleBookTicket = (route: TransitRoute, from: string, to: string) => {
    const ticketId = `TCK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const now = new Date();
    const expiry = new Date(now.getTime() + 3 * 3600000);

    const ticket: DigitalTicket = {
      ticketId,
      userId: user?.uid || 'guest-passenger',
      routeId: route.routeId,
      routeName: route.routeName,
      fromStop: from,
      toStop: to,
      passengerName: user?.displayName || 'Passenger',
      fare: route.fare,
      status: 'valid',
      qrCode: `METROPULSE|${ticketId}|${from}|${to}`,
      purchaseTime: now.toISOString(),
      expiryTime: expiry.toISOString(),
    };

    setActiveTicket(ticket);
    showNotification(`Digital Pass issued for ${route.routeName}!`);
    speakAnnouncement(`Ticket confirmed for ${route.routeName}. Departing from ${from}.`);
  };

  const handleReportCrowd = async (busId: string, crowdLevel: 'low' | 'medium' | 'high') => {
    try {
      await fetch('/api/crowd/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ busId, crowdLevel }),
      });
      showNotification(`Thank you! Crowd status updated to ${crowdLevel.toUpperCase()}`);
    } catch {
      showNotification('Crowd report logged');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Journey Search Bar Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
              Find Your Route &amp; Approaches
            </h2>
          </div>
          <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-full">
            Real-time GPS Active
          </span>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Origin Stop */}
          <div className="md:col-span-5 relative">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Starting Point
            </label>
            <div className="relative">
              <CircleDot className="w-4 h-4 text-emerald-500 absolute left-3 top-2.5" />
              <input
                type="text"
                list="stops-list"
                value={fromStop}
                onChange={(e) => setFromStop(e.target.value)}
                placeholder="Enter starting bus stop..."
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Swap Button */}
          <div className="md:col-span-2 flex justify-center pt-2 md:pt-4">
            <button
              onClick={handleSwapStops}
              className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-600 dark:text-slate-300 hover:text-blue-600 border border-slate-200 dark:border-slate-700 transition-all active:scale-95 cursor-pointer"
              title="Swap Origin and Destination"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Destination Stop */}
          <div className="md:col-span-5 relative">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Destination Point
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-rose-500 absolute left-3 top-2.5" />
              <input
                type="text"
                list="stops-list"
                value={toStop}
                onChange={(e) => setToStop(e.target.value)}
                placeholder="Enter destination bus stop..."
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <datalist id="stops-list">
            {allStops.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 text-[11px]">Popular destinations:</span>
          {['University Campus Gate', 'Silicon Tech Park', 'International Airport Gate', 'Main Market Square'].map(
            (dest) => (
              <button
                key={dest}
                onClick={() => setToStop(dest)}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-medium transition-colors"
              >
                {dest}
              </button>
            )
          )}
        </div>
      </div>

      {/* 2. Route Search Results (Direct & Smart Transfer Recommendations) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
            <span>Recommended Travel Options</span>
            <span className="text-xs bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold">
              {searchResults.length} {searchResults.length === 1 ? 'Route' : 'Routes'}
            </span>
          </h3>
        </div>

        {searchResults.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Map className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">No direct or transfer route found</p>
            <p className="text-xs text-slate-500 mt-1">
              Try selecting another stop like "Central Transit Hub" or "Civic Center &amp; Library".
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {searchResults.map((option, idx) => {
              const isDirect = option.type === 'direct';
              const firstLeg = option.legs[0];
              const isSelected = selectedRouteId === firstLeg.route.routeId;

              return (
                <div
                  key={idx}
                  onClick={() => onSelectRoute(firstLeg.route.routeId)}
                  className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer hover:shadow-md ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-extrabold text-xs shadow-sm"
                        style={{ backgroundColor: firstLeg.route.color }}
                      >
                        {firstLeg.route.routeNumber}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                            {isDirect ? firstLeg.route.routeName : `Transfer Route via ${option.transferStop}`}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                              isDirect
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                : 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                            }`}
                          >
                            {isDirect ? 'Direct' : '1 Transfer'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {option.totalDurationMinutes} mins travel time • Fare: ${option.totalFare.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(firstLeg.route.routeId);
                      }}
                      className="p-1 hover:scale-110 transition-transform cursor-pointer"
                      title="Save Favorite"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          favorites.includes(firstLeg.route.routeId)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-400'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Multi-leg Details */}
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-2 text-xs">
                    {option.legs.map((leg, lIdx) => (
                      <div key={lIdx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: leg.route.color }}
                          ></span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            Take {leg.route.routeNumber} ({leg.fromStop} → {leg.toStop})
                          </span>
                        </div>
                        <span className="text-slate-500 font-mono text-[11px]">{leg.stopsCount} stops</span>
                      </div>
                    ))}
                    {!isDirect && (
                      <div className="text-[11px] text-purple-600 dark:text-purple-400 flex items-center gap-1 font-medium pl-4">
                        <User className="w-3.5 h-3.5" />
                        <span>Walk 45m cross-platform transfer at {option.transferStop}</span>
                      </div>
                    )}
                  </div>

                  {/* Approaching Bus Info & Action */}
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      {firstLeg.busApproaching ? (
                        <div className="text-xs">
                          <span className="text-slate-500">Next Bus: </span>
                          <b className="text-slate-900 dark:text-slate-100">{firstLeg.busApproaching.busNumber}</b>
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                            {firstLeg.busApproaching.currentDelay > 0
                              ? `+${firstLeg.busApproaching.currentDelay}m delay`
                              : 'On Time'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Scheduled in {firstLeg.route.frequencyMinutes}m</span>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBookTicket(firstLeg.route, fromStop, toStop);
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      <span>Get E-Pass</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Live Bus Radar & Real-Time ETA Card */}
      {selectedBus && etaDetails && (
        <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-800/40">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-800/50 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <BusIcon className="w-6 h-6 text-white" />
                <h3 className="text-lg font-black">{selectedBus.busNumber}</h3>
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    selectedBus.status === 'Delayed' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
                  }`}
                >
                  {selectedBus.status}
                </span>
                {selectedBus.isSimulated && (
                  <span className="text-[10px] bg-blue-500/30 text-blue-200 border border-blue-400/40 px-2 py-0.5 rounded-full font-bold">
                    GPS Sim Active
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-200 mt-1">
                Vehicle: {selectedBus.vehicleNumber} • Driver: {selectedBus.driverName}
              </p>
            </div>

            {/* Big ETA Callout */}
            <div className="bg-indigo-900/60 backdrop-blur-md px-5 py-3 rounded-2xl border border-indigo-700/50 flex items-center gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-300 block">
                  Estimated Arrival
                </span>
                <span className="text-2xl font-black text-amber-300">{etaDetails.formattedArrival}</span>
              </div>
              <button
                onClick={() =>
                  speakAnnouncement(
                    `${selectedBus.busNumber} is arriving at ${etaDetails.targetStopName} in ${etaDetails.estimatedMinutes} minutes.`
                  )
                }
                className="p-2 rounded-xl bg-indigo-800/80 hover:bg-indigo-700 text-white text-sm cursor-pointer"
                title="Speak ETA"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Intelligent Factor Breakdown */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-indigo-300 text-[10px] uppercase font-semibold block">Distance</span>
              <span className="font-extrabold text-base text-white">{etaDetails.distanceKm} km</span>
              <span className="text-[10px] text-indigo-200 block">Haversine GPS</span>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-indigo-300 text-[10px] uppercase font-semibold block">Live Speed</span>
              <span className="font-extrabold text-base text-white">{etaDetails.currentSpeedKmh} km/h</span>
              <span className="text-[10px] text-indigo-200 block">Telemetry feed</span>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-indigo-300 text-[10px] uppercase font-semibold block">Traffic Delay</span>
              <span
                className={`font-extrabold text-base ${
                  etaDetails.delayMinutes > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                +{etaDetails.delayMinutes} mins
              </span>
              <span className="text-[10px] text-indigo-200 block">Route congestion</span>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-indigo-300 text-[10px] uppercase font-semibold block">ETA Confidence</span>
              <span className="font-extrabold text-base text-emerald-400">{etaDetails.confidenceScore}%</span>
              <span className="text-[10px] text-indigo-200 block">ML Kalman model</span>
            </div>
          </div>

          {/* Crowd Level & Passenger Reporting */}
          <div className="mt-4 pt-3 border-t border-indigo-800/50 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-indigo-200">Current Occupancy:</span>
              <div className="w-24 bg-indigo-950 rounded-full h-2.5 overflow-hidden border border-indigo-700">
                <div
                  className="bg-gradient-to-r from-emerald-400 to-amber-400 h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round((selectedBus.currentOccupancy / selectedBus.capacity) * 100))}%`,
                  }}
                ></div>
              </div>
              <span className="font-bold text-indigo-100">
                {selectedBus.currentOccupancy}/{selectedBus.capacity} passengers
              </span>
            </div>

            {/* Passenger Crowd Reporting Buttons */}
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-indigo-300">Report onboard crowd:</span>
              <button
                onClick={() => handleReportCrowd(selectedBus.busId, 'low')}
                className="px-2 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded border border-emerald-500/40"
              >
                Seats Available
              </button>
              <button
                onClick={() => handleReportCrowd(selectedBus.busId, 'medium')}
                className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded border border-amber-500/40"
              >
                Standing
              </button>
              <button
                onClick={() => handleReportCrowd(selectedBus.busId, 'high')}
                className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded border border-rose-500/40"
              >
                Packed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Active Fleet & Approaching Buses List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-emerald-600" />
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
              Live Fleet Status on Active Routes
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {buses.filter((b) => b.status !== 'Offline').length} Running
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {buses.map((bus) => {
            const isSelected = bus.busId === selectedBus?.busId;
            const route = routes.find((r) => r.routeId === bus.routeId);

            return (
              <div
                key={bus.busId}
                onClick={() => onSelectBus(bus.busId)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BusIcon className="w-4 h-4 text-emerald-600" />
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
                        {bus.busNumber}
                      </span>
                      <span className="text-[10px] text-slate-500 block">{route?.routeName || 'Reserve Fleet'}</span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      bus.status === 'Delayed'
                        ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                        : bus.status === 'On Route'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {bus.status}
                  </span>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                  <span>Speed: <b>{Math.round(bus.currentSpeed)} km/h</b></span>
                  <span>Delay: <b className={bus.currentDelay > 0 ? 'text-rose-500' : 'text-emerald-500'}>+{bus.currentDelay}m</b></span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">Track on Map →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Digital Ticket Modal */}
      <DigitalTicketModal
        ticket={activeTicket}
        onClose={() => setActiveTicket(null)}
        onValidatePass={() => showNotification('Ticket verified and redeemed!')}
      />
    </div>
  );
};
