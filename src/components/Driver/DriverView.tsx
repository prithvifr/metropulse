import React, { useState, useEffect, useRef } from 'react';
import { Bus, TransitRoute, ActiveTrip } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  Radio,
  Smartphone,
  Cpu,
  AlertTriangle,
  UserCheck,
  Play,
  Pause,
  Square,
  AlertOctagon,
  CheckCircle2,
  Wrench,
  Car,
} from 'lucide-react';

interface DriverViewProps {
  buses: Bus[];
  routes: TransitRoute[];
  onTripUpdate: (bus: Bus) => void;
}

export const DriverView: React.FC<DriverViewProps> = ({ buses, routes, onTripUpdate }) => {
  const { showNotification, speakAnnouncement } = useAuth();

  // Driver configuration
  const [driverName, setDriverName] = useState<string>('Rajesh Kumar (DR-104)');
  const [selectedBusId, setSelectedBusId] = useState<string>(buses[0]?.busId || 'bus-05-a');
  const [selectedRouteId, setSelectedRouteId] = useState<string>(routes[0]?.routeId || 'route-05');

  // Trip State
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [isSimulated, setIsSimulated] = useState<boolean>(true); // default true for hackathon demo convenience
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState<number>(1);
  const [simRunning, setSimRunning] = useState<boolean>(true);
  const [gpsLost, setGpsLost] = useState<boolean>(false);
  const [watchId, setWatchId] = useState<number | null>(null);

  // Quick Problem Reporting Modal / Form
  const [reportedDelay, setReportedDelay] = useState<number>(0);
  const [reportReason, setReportReason] = useState<string>('');

  const simIndexRef = useRef<number>(0);
  const timerRef = useRef<any>(null);

  const selectedBus = buses.find((b) => b.busId === selectedBusId) || buses[0];
  const selectedRoute = routes.find((r) => r.routeId === selectedRouteId) || routes[0];

  // Start Trip
  const handleStartTrip = async () => {
    try {
      const res = await fetch('/api/driver/trip/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busId: selectedBus.busId,
          driverId: 'dr-' + Date.now().toString(36),
          driverName,
          routeId: selectedRoute.routeId,
          isSimulated,
        }),
      });
      const data = await res.json();
      if (data.success && data.trip) {
        setActiveTrip(data.trip);
        simIndexRef.current = 0;
        showNotification(`Trip Started for ${selectedRoute.routeName}! Live GPS active.`);
        speakAnnouncement(`Trip started on ${selectedRoute.routeName}. Heading towards ${selectedRoute.destination}.`);

        // If real phone GPS mode
        if (!isSimulated && 'geolocation' in navigator) {
          startRealPhoneGps(data.trip.tripId);
        }
      }
    } catch (err: any) {
      showNotification('Failed to start trip session: ' + err.message);
    }
  };

  // Real phone GPS tracking using navigator.geolocation
  const startRealPhoneGps = (tripId: string) => {
    if (!('geolocation' in navigator)) {
      showNotification('Geolocation API not supported on this browser. Switching to simulation.');
      setIsSimulated(true);
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsLost(false);
        const { latitude, longitude, speed, heading } = pos.coords;
        const currentSpeedKmh = speed ? Math.round(speed * 3.6) : 26;

        sendLocationUpdate({
          tripId,
          latitude,
          longitude,
          speed: currentSpeedKmh,
          heading: heading || 90,
        });
      },
      (err) => {
        console.warn('Driver GPS error:', err);
        setGpsLost(true);
        showNotification('Driver GPS signal weak or lost: Location temporarily unavailable.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    );
    setWatchId(id);
  };

  // Send Location Update to Backend
  const sendLocationUpdate = async (payload: any) => {
    try {
      const res = await fetch('/api/driver/trip/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success && data.bus) {
        onTripUpdate(data.bus);
      }
    } catch (e) {
      console.error('Failed to post driver location:', e);
    }
  };

  // Simulated GPS Coordinates ticker
  useEffect(() => {
    if (!activeTrip || !isSimulated || !simRunning) return;

    const waypoints = selectedRoute.waypoints.length > 0
      ? selectedRoute.waypoints
      : selectedRoute.stops.map((s) => [s.latitude, s.longitude] as [number, number]);

    if (waypoints.length === 0) return;

    const intervalMs = Math.max(500, 2000 / simSpeedMultiplier);

    timerRef.current = setInterval(() => {
      simIndexRef.current = (simIndexRef.current + 1) % waypoints.length;
      const currentPoint = waypoints[simIndexRef.current];

      // Next waypoint for heading calculation
      const nextPoint = waypoints[(simIndexRef.current + 1) % waypoints.length];
      const deltaLat = nextPoint[0] - currentPoint[0];
      const deltaLng = nextPoint[1] - currentPoint[1];
      const headingDeg = Math.round((Math.atan2(deltaLng, deltaLat) * 180) / Math.PI + 360) % 360;

      // Identify nearest upcoming stop
      const stopIdx = Math.min(
        selectedRoute.stops.length - 1,
        Math.floor((simIndexRef.current / waypoints.length) * selectedRoute.stops.length)
      );
      const currentStop = selectedRoute.stops[stopIdx];
      const nextStop = selectedRoute.stops[Math.min(selectedRoute.stops.length - 1, stopIdx + 1)];

      const speed = Math.round(24 + Math.sin(simIndexRef.current) * 8);

      sendLocationUpdate({
        tripId: activeTrip.tripId,
        latitude: currentPoint[0],
        longitude: currentPoint[1],
        speed,
        heading: headingDeg,
        currentStopName: currentStop.stopName,
        nextStopName: nextStop.stopName,
        delayMinutes: reportedDelay,
        simulationIndex: simIndexRef.current,
      });

      // Update local state
      setActiveTrip((prev) =>
        prev
          ? {
              ...prev,
              currentLat: currentPoint[0],
              currentLng: currentPoint[1],
              speed,
              heading: headingDeg,
              currentStopName: currentStop.stopName,
              nextStopName: nextStop.stopName,
            }
          : null
      );
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTrip, isSimulated, simRunning, simSpeedMultiplier, selectedRoute, reportedDelay]);

  // Report Problem or Delay
  const handleReportProblem = async (delay: number, reason: string, issueType: string = 'traffic') => {
    if (!activeTrip) return;
    setReportedDelay(delay);
    try {
      await fetch('/api/driver/trip/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: activeTrip.tripId,
          delayMinutes: delay,
          reason,
          issueType,
        }),
      });
      showNotification(`Delay update broadcasted: +${delay} minutes (${reason})`);
      speakAnnouncement(`Advisory: Service delayed by ${delay} minutes due to ${reason}`);
    } catch {
      showNotification('Delay reported locally');
    }
  };

  // End Trip
  const handleEndTrip = async () => {
    if (!activeTrip) return;
    try {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timerRef.current) clearInterval(timerRef.current);

      await fetch('/api/driver/trip/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: activeTrip.tripId }),
      });

      setActiveTrip(null);
      showNotification('Trip completed successfully. Bus status set to Available.');
      speakAnnouncement('Trip completed. Great job on the route!');
    } catch (err: any) {
      showNotification('Error ending trip: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. GPS Simulation Notice for Hackathon Evaluation (as explicitly requested in prompt #4) */}
      <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5">
          <Radio className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <div>
            <div className="font-extrabold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
              <span>Driver GPS Source:</span>
              <span className="bg-indigo-200 dark:bg-indigo-800 text-indigo-950 dark:text-indigo-100 font-bold px-2 py-0.5 rounded-full uppercase text-[10px]">
                {isSimulated ? 'Simulated Route Coordinates' : 'Mobile Phone Real GPS'}
              </span>
            </div>
            <p className="text-indigo-700/80 dark:text-indigo-300 text-[11px] mt-0.5">
              {isSimulated
                ? 'Route simulation is active along predefined street waypoints for demonstration.'
                : 'Using HTML5 navigator.geolocation device sensors to broadcast real-world GPS.'}
            </p>
          </div>
        </div>

        {/* Toggle Mode */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={() => {
              if (activeTrip) {
                showNotification('Please end active trip before switching GPS mode.');
                return;
              }
              setIsSimulated(!isSimulated);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold border border-indigo-300 dark:border-indigo-700 shadow-sm transition-all text-xs"
          >
            {isSimulated ? <Smartphone className="w-3.5 h-3.5" /> : <Cpu className="w-3.5 h-3.5" />}
            <span>Switch to {isSimulated ? 'Phone GPS' : 'GPS Simulator'}</span>
          </button>
        </div>
      </div>

      {/* GPS Lost Alert Condition (Prompt #10) */}
      {gpsLost && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <span className="font-bold">Driver GPS Signal Warning: </span>
            <span>Location temporarily unavailable. Safeguarding passenger ETAs against outdated coordinates.</span>
          </div>
        </div>
      )}

      {/* 2. Driver Active Dashboard OR Pre-Trip Config Card */}
      {!activeTrip ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <UserCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">Driver Shift &amp; Trip Dispatch</h3>
              <p className="text-xs text-slate-500">Configure vehicle and route before starting passenger service</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Driver Identity */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Driver Profile
              </label>
              <select
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                <option value="Rajesh Kumar (DR-104)">Rajesh Kumar (ID: DR-104)</option>
                <option value="Sarah Jenkins (DR-208)">Sarah Jenkins (ID: DR-208)</option>
                <option value="Marcus Vance (DR-315)">Marcus Vance (ID: DR-315)</option>
                <option value="Elena Gomez (DR-422)">Elena Gomez (ID: DR-422)</option>
              </select>
            </div>

            {/* Bus Vehicle */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Assigned Bus
              </label>
              <select
                value={selectedBusId}
                onChange={(e) => setSelectedBusId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                {buses.map((b) => (
                  <option key={b.busId} value={b.busId}>
                    {b.busNumber} ({b.vehicleNumber}) - Cap: {b.capacity} [{b.status}]
                  </option>
                ))}
              </select>
            </div>

            {/* Route */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Assigned Route
              </label>
              <select
                value={selectedRouteId}
                onChange={(e) => setSelectedRouteId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                {routes.map((r) => (
                  <option key={r.routeId} value={r.routeId}>
                    {r.routeName} ({r.stops.length} stops)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Route Overview Preview */}
          <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-slate-900 dark:text-slate-100 block">
                {selectedRoute.startLocation} → {selectedRoute.destination}
              </span>
              <span className="text-slate-500 text-[11px]">
                Estimated trip duration: {selectedRoute.estimatedDuration} minutes • Scheduled headway: {selectedRoute.frequencyMinutes}m
              </span>
            </div>

            <button
              onClick={handleStartTrip}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>START TRIP &amp; SHARE GPS</span>
            </button>
          </div>
        </div>
      ) : (
        /* 3. Live In-Flight Driver HUD */
        <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 text-white rounded-3xl p-6 shadow-2xl border border-blue-900/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-blue-800/40 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400">
                  TRIP IN PROGRESS
                </span>
                <span className="text-xs text-blue-200 font-mono bg-blue-900/50 px-2 py-0.5 rounded">
                  {activeTrip.tripId}
                </span>
              </div>
              <h2 className="text-xl font-black mt-1">
                {activeTrip.busNumber} • {activeTrip.routeName}
              </h2>
              <p className="text-xs text-blue-200">
                Captain: {activeTrip.driverName} • Destination: {selectedRoute.destination}
              </p>
            </div>

            <button
              onClick={handleEndTrip}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 self-start md:self-center cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>END TRIP &amp; FREE BUS</span>
            </button>
          </div>

          {/* Telemetry HUD Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-center">
              <span className="text-[10px] text-blue-300 uppercase font-bold block">Live Speed</span>
              <span className="text-2xl font-black text-amber-300">{Math.round(activeTrip.speed)}</span>
              <span className="text-[10px] text-slate-300 block">km/h</span>
            </div>
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-center">
              <span className="text-[10px] text-blue-300 uppercase font-bold block">Next Bus Stop</span>
              <span className="text-sm font-extrabold text-white truncate block mt-1">
                {activeTrip.nextStopName || 'Approaching Stop'}
              </span>
              <span className="text-[10px] text-emerald-400 block">Upcoming</span>
            </div>
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-center">
              <span className="text-[10px] text-blue-300 uppercase font-bold block">Current Delay</span>
              <span
                className={`text-2xl font-black ${
                  activeTrip.delayMinutes > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                +{activeTrip.delayMinutes}m
              </span>
              <span className="text-[10px] text-slate-300 block">Reported</span>
            </div>
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-center">
              <span className="text-[10px] text-blue-300 uppercase font-bold block">Heading / Bearing</span>
              <span className="text-2xl font-black text-white">{activeTrip.heading}°</span>
              <span className="text-[10px] text-slate-300 block">Compass</span>
            </div>
          </div>

          {/* Simulator Speed & Navigation Controls (if simulated) */}
          {isSimulated && (
            <div className="mt-4 p-3 bg-blue-950/60 rounded-2xl border border-blue-800/40 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-indigo-300 font-bold">Simulator Controls:</span>
                <button
                  onClick={() => setSimRunning(!simRunning)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs cursor-pointer ${
                    simRunning ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white'
                  }`}
                >
                  {simRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{simRunning ? 'Pause Motion' : 'Resume Motion'}</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-300 text-[11px]">Speed:</span>
                {[1, 2, 4].map((mult) => (
                  <button
                    key={mult}
                    onClick={() => setSimSpeedMultiplier(mult)}
                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                      simSpeedMultiplier === mult ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {mult}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. Driver Problem & Delay Reporter Buttons */}
          <div className="mt-5 pt-4 border-t border-blue-800/40">
            <span className="text-xs uppercase font-extrabold text-blue-300 block mb-2">
              Instant Problem &amp; Delay Reporting (Broadcast to Passengers)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <button
                onClick={() => handleReportProblem(5, 'Dense peak traffic along main boulevard', 'traffic')}
                className="p-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-semibold text-left transition-all active:scale-95"
              >
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5" />
                  <span>Heavy Traffic</span>
                </div>
                <div className="text-[10px] text-amber-200/80 mt-0.5">+5m Delay</div>
              </button>
              <button
                onClick={() => handleReportProblem(15, 'Road construction / lane block near intersection', 'traffic')}
                className="p-2.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border border-orange-500/40 font-semibold text-left transition-all active:scale-95"
              >
                <div className="font-bold text-orange-300 flex items-center gap-1.5">
                  <AlertOctagon className="w-3.5 h-3.5" />
                  <span>Road Blocked</span>
                </div>
                <div className="text-[10px] text-orange-200/80 mt-0.5">+15m Delay</div>
              </button>
              <button
                onClick={() => handleReportProblem(0, 'Schedule recovered, normal traffic flow', 'traffic')}
                className="p-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 font-semibold text-left transition-all active:scale-95"
              >
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Route Clear</span>
                </div>
                <div className="text-[10px] text-emerald-200/80 mt-0.5">On Time (0m)</div>
              </button>
              <button
                onClick={() => handleReportProblem(20, 'Engine overheating, replacement bus requested', 'breakdown')}
                className="p-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 font-semibold text-left transition-all active:scale-95"
              >
                <div className="font-bold text-rose-300 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Vehicle Issue</span>
                </div>
                <div className="text-[10px] text-rose-200/80 mt-0.5">Disruption alert</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
