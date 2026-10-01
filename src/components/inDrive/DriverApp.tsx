import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bus, TransitRoute, ActiveTrip, BusStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { TransitMap } from '../Map/TransitMap';
import { startTripInFirestore, endTripInFirestore, updateBusLocationInFirestore } from '../../services/firestoreService';
import {
  Bus as BusIcon,
  Navigation,
  AlertTriangle,
  Car,
  Construction,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Lock,
  Info,
  Check,
  ShieldCheck,
  Flag,
} from 'lucide-react';

interface DriverAppProps {
  buses: Bus[];
  routes: TransitRoute[];
  onTripUpdate: (bus: Bus) => void;
}

export const DriverApp: React.FC<DriverAppProps> = ({ buses, routes, onTripUpdate }) => {
  const { driverSession, showNotification, speakAnnouncement } = useAuth();
  const driverName = driverSession?.driverName || 'Marcus Vance';

  const [isOnline, setIsOnline] = useState(true);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [isSimulated, setIsSimulated] = useState(true);
  const [simSpeed, setSimSpeed] = useState(1);
  const [simPaused, setSimPaused] = useState(false);
  const [reportedDelay, setReportedDelay] = useState(0);
  const [gpsLost, setGpsLost] = useState(false);

  const [watchId, setWatchId] = useState<number | null>(null);
  const timerRef = useRef<any>(null);
  const simIndexRef = useRef(0);

  // Vehicle strictly assigned by the Transport Operator / Dispatcher
  const assignedBus = useMemo(() => {
    const byName = buses.find(
      (b) =>
        b.driverName.toLowerCase().includes(driverName.toLowerCase()) ||
        driverName.toLowerCase().includes(b.driverName.toLowerCase())
    );
    if (byName) return byName;
    return buses.find((b) => b.busId === 'bus-07') || buses[0];
  }, [buses, driverName]);

  const assignedRoute = useMemo(() => {
    return routes.find((r) => r.routeId === assignedBus.routeId) || routes[0];
  }, [routes, assignedBus]);

  const handleStartTrip = async () => {
    try {
      const res = await fetch('/api/driver/trip/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busId: assignedBus.busId,
          driverId: driverSession?.uid || 'dr-' + Date.now().toString(36),
          driverName,
          routeId: assignedRoute.routeId,
          isSimulated,
        }),
      });
      const data = await res.json();
      if (data.success && data.trip) {
        setActiveTrip(data.trip);
        simIndexRef.current = 0;
        startTripInFirestore(data.trip).catch(console.error);
        showNotification(`Driver Trip Started on ${assignedRoute.routeName} with ${assignedBus.busNumber}!`);
        speakAnnouncement(`Trip started on ${assignedBus.busNumber}. Heading towards ${assignedRoute.destination}.`);

        if (!isSimulated && 'geolocation' in navigator) {
          startRealPhoneGps(data.trip.tripId);
        }
      }
    } catch (err: any) {
      showNotification('Error starting trip: ' + err.message);
    }
  };

  const startRealPhoneGps = (tripId: string) => {
    if (!('geolocation' in navigator)) {
      setIsSimulated(true);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsLost(false);
        const { latitude, longitude, speed, heading } = pos.coords;
        const currentSpeedKmh = speed ? Math.round(speed * 3.6) : 28;
        sendUpdate({
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
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    );
    setWatchId(id);
  };

  const sendUpdate = async (payload: any) => {
    try {
      const res = await fetch('/api/driver/trip/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success && data.bus) {
        onTripUpdate(data.bus);
        updateBusLocationInFirestore(
          data.bus.busId,
          data.bus.currentLat,
          data.bus.currentLng,
          data.bus.currentSpeed,
          data.bus.heading,
          data.bus.currentDelay
        ).catch(console.error);
      }
    } catch (err) {
      console.error('Failed to post live location', err);
    }
  };

  // Automated Route Waypoint Simulation loop
  useEffect(() => {
    if (!activeTrip || !isSimulated) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const waypoints = assignedRoute.waypoints;
    if (!waypoints || waypoints.length === 0) return;

    timerRef.current = setInterval(() => {
      if (simPaused) return;

      const idx = simIndexRef.current;
      const pt = waypoints[idx];
      const nextPt = waypoints[(idx + 1) % waypoints.length];

      const dLat = nextPt[0] - pt[0];
      const dLng = nextPt[1] - pt[1];
      const angle = (Math.atan2(dLng, dLat) * 180) / Math.PI;
      const heading = Math.round((angle + 360) % 360);

      const baseSpeed = reportedDelay > 0 ? 14 : 32;
      const jitterSpeed = Math.max(10, Math.round(baseSpeed + (Math.random() * 6 - 3)));

      const stops = assignedRoute.stops;
      const stopProgress = Math.floor((idx / waypoints.length) * stops.length);
      const nextStop = stops[Math.min(stopProgress + 1, stops.length - 1)];

      setActiveTrip((prev) =>
        prev
          ? {
              ...prev,
              currentLat: pt[0],
              currentLng: pt[1],
              speed: jitterSpeed,
              heading,
              nextStopName: nextStop?.stopName || 'Terminus',
              simulationIndex: idx,
            }
          : null
      );

      sendUpdate({
        tripId: activeTrip.tripId,
        latitude: pt[0],
        longitude: pt[1],
        speed: jitterSpeed,
        heading,
        delayMinutes: reportedDelay,
      });

      simIndexRef.current = (simIndexRef.current + 1) % waypoints.length;
    }, 1500 / simSpeed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTrip, isSimulated, simPaused, simSpeed, assignedRoute, reportedDelay]);

  useEffect(() => {
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [watchId]);

  const handleReportProblem = async (delayMinutes: number, issueTitle: string) => {
    if (!activeTrip) return;
    setReportedDelay(delayMinutes);
    try {
      await fetch('/api/driver/trip/incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: activeTrip.tripId,
          type: delayMinutes > 10 ? 'roadblock' : 'traffic',
          description: issueTitle,
          delayMinutes,
        }),
      });

      const updatedBus: Bus = {
        ...assignedBus,
        currentDelay: delayMinutes,
        status: delayMinutes > 4 ? 'Delayed' : 'On Route',
      };
      onTripUpdate(updatedBus);

      showNotification(`Incident transmitted to Dispatch & Passenger map: +${delayMinutes}m delay`);
      speakAnnouncement(`Advisory reported: ${issueTitle}.`);
    } catch {
      showNotification('Incident logged locally');
    }
  };

  const handleEndTrip = async () => {
    if (!activeTrip) return;
    try {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      if (timerRef.current) clearInterval(timerRef.current);

      const durationMins = Math.max(
        1,
        Math.round((Date.now() - new Date(activeTrip.startTime).getTime()) / 60000)
      );

      await fetch('/api/driver/trip/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: activeTrip.tripId }),
      });
      endTripInFirestore(activeTrip.tripId, activeTrip.busId, durationMins).catch(console.error);
      setActiveTrip(null);
      showNotification(`Trip completed (${durationMins}m) and logged to database!`);
      speakAnnouncement('Trip completed successfully. Bus status set to Available.');
    } catch (e: any) {
      showNotification('Error ending trip: ' + e.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden font-sans bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* 1. LEFT-HAND DRIVER COCKPIT SIDEBAR - asancars.co clean aesthetic */}
      <div className="w-full lg:w-[480px] xl:w-[500px] flex-shrink-0 h-full overflow-y-auto bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-5 space-y-5 shadow-xs">
        {/* Role Identity Badge */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <BusIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>BUS &amp; DRIVER TERMINAL</span>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                Mobile GPS
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time smartphone GPS broadcaster, stop arrival tracker &amp; delay reporting terminal
          </p>
        </div>

        {/* Driver Shift Header */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3.5 h-3.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-slate-900 dark:text-white">{driverName}</span>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded-full font-mono font-bold">
                  {isOnline ? 'SHIFT ONLINE' : 'OFFLINE'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {activeTrip ? `Assigned: ${assignedBus.busNumber} (${assignedRoute.routeNumber})` : 'Standby for Route Dispatch'}
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsOnline(!isOnline)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              isOnline
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            {isOnline ? 'Go Offline' : 'Go Online'}
          </button>
        </div>

        {/* GPS Source & Simulation Notice */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">
                Source: {isSimulated ? 'GPS Route Simulation' : 'Mobile Phone Sensor GPS'}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {isSimulated ? 'Simulating along street waypoints' : 'Broadcasting device coordinates'}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              if (activeTrip) {
                showNotification('Complete current trip before switching GPS mode');
                return;
              }
              setIsSimulated(!isSimulated);
            }}
            className="text-xs font-black text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Switch to {isSimulated ? 'Phone GPS' : 'Simulator'}
          </button>
        </div>

        {/* Active Trip Telemetry HUD */}
        {gpsLost && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-pulse">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Location temporarily unavailable: GPS satellite signal dropped. Attempting to re-acquire lock...</span>
          </div>
        )}

        {activeTrip ? (
          <div className="space-y-4">
            <div className="p-4 bg-white dark:bg-slate-950 rounded-2xl border-2 border-emerald-500 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-black tracking-wider block">
                    ACTIVE TRIP • {activeTrip.routeName.split(':')[0]}
                  </span>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">{activeTrip.busNumber}</h3>
                </div>
                <div className="text-right">
                  <span
                    className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                      activeTrip.delayMinutes > 0
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}
                  >
                    {activeTrip.delayMinutes > 0 ? `+${activeTrip.delayMinutes}m delay` : 'On Schedule'}
                  </span>
                </div>
              </div>

              {/* Speedometer & Next Stop Display */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[9px] text-slate-500 uppercase font-bold block">Live Speed</span>
                  <b className="text-xl text-emerald-700 dark:text-emerald-400 font-mono block">{Math.round(activeTrip.speed)}</b>
                  <span className="text-[9px] text-slate-400">km/h</span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[9px] text-slate-500 uppercase font-bold block">Next Stop</span>
                  <b className="text-slate-900 dark:text-white text-xs truncate block mt-1">{activeTrip.nextStopName}</b>
                  <span className="text-[9px] text-emerald-600 font-semibold">Approaching</span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[9px] text-slate-500 uppercase font-bold block">Heading</span>
                  <b className="text-slate-900 dark:text-white text-base font-mono block mt-0.5">{activeTrip.heading}°</b>
                  <span className="text-[9px] text-slate-400">Compass</span>
                </div>
              </div>

              {/* Simulation Controls */}
              {isSimulated && (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSimPaused(!simPaused)}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-1"
                    >
                      {simPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                      <span>{simPaused ? 'Resume' : 'Pause'}</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-[10px]">Speed:</span>
                    {[1, 2, 4].map((mult) => (
                      <button
                        key={mult}
                        onClick={() => setSimSpeed(mult)}
                        className={`px-2 py-0.5 rounded text-xs font-bold cursor-pointer ${
                          simSpeed === mult
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {mult}x
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Incident / Delay Reporting Center */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">
                Instant Delay &amp; Problem Reporting
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => handleReportProblem(5, 'Dense commuter traffic congestion')}
                  className="p-2.5 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 text-amber-900 dark:text-amber-300 rounded-xl border border-amber-300 dark:border-amber-800 text-left font-bold cursor-pointer transition-all space-y-0.5"
                >
                  <div className="flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-amber-600" />
                    <span>Heavy Traffic</span>
                  </div>
                  <div className="text-[10px] text-amber-700 dark:text-amber-400 font-normal">+5m delay broadcast</div>
                </button>
                <button
                  onClick={() => handleReportProblem(15, 'Road construction diversion')}
                  className="p-2.5 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 text-orange-900 dark:text-orange-300 rounded-xl border border-orange-300 dark:border-orange-800 text-left font-bold cursor-pointer transition-all space-y-0.5"
                >
                  <div className="flex items-center gap-1.5">
                    <Construction className="w-3.5 h-3.5 text-orange-600" />
                    <span>Road Blocked</span>
                  </div>
                  <div className="text-[10px] text-orange-700 dark:text-orange-400 font-normal">+15m detour notice</div>
                </button>
                <button
                  onClick={() => handleReportProblem(0, 'Schedule recovered')}
                  className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 text-emerald-900 dark:text-emerald-300 rounded-xl border border-emerald-300 dark:border-emerald-800 text-left font-bold cursor-pointer transition-all space-y-0.5"
                >
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Route Clear</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-normal">On Time schedule</div>
                </button>
                <button
                  onClick={() => handleReportProblem(25, 'Engine maintenance issue')}
                  className="p-2.5 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-900 dark:text-rose-300 rounded-xl border border-rose-300 dark:border-rose-800 text-left font-bold cursor-pointer transition-all space-y-0.5"
                >
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Vehicle Issue</span>
                  </div>
                  <div className="text-[10px] text-rose-700 dark:text-rose-400 font-normal">Breakdown alert</div>
                </button>
              </div>

              <button
                onClick={handleEndTrip}
                className="w-full mt-2 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Flag className="w-4 h-4" />
                <span>COMPLETE TRIP &amp; RELEASE VEHICLE</span>
              </button>
            </div>
          </div>
        ) : (
          /* Pre-Trip Configuration Form - Vehicle Assigned By Transport Operator */
          <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="font-black text-sm text-slate-900 dark:text-white">Shift Dispatch &amp; Route Assignment</h3>

            {/* Operator Assigned Vehicle Card */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border-2 border-emerald-400 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-[10px] uppercase font-black text-emerald-800 dark:text-emerald-400 tracking-wider">
                  Assigned by Transport Operator
                </span>
                <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>Dispatch Paired</span>
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Commercial Bus:</span>
                  <b className="text-slate-900 dark:text-white text-sm font-black flex items-center gap-1.5">
                    <BusIcon className="w-4 h-4 text-emerald-600" />
                    <span>{assignedBus.busNumber}</span>
                    <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-normal">
                      ({assignedBus.vehicleNumber})
                    </span>
                  </b>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Assigned Corridor:</span>
                  <b className="text-emerald-800 dark:text-emerald-300 font-bold">{assignedRoute.routeName}</b>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Vehicle Capacity:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{assignedBus.capacity} passengers</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Certified Driver:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{driverName}</span>
                </div>
              </div>

              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-300 leading-relaxed flex items-start gap-1.5">
                <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span><b>Fleet Rule:</b> Vehicle assignment is strictly controlled by the Transport Operator / Dispatcher. Commercial drivers cannot self-assign buses in registration or modify assigned units without dispatcher clearance.</span>
              </div>
            </div>

            <button
              onClick={handleStartTrip}
              disabled={!isOnline}
              className={`w-full py-4 rounded-xl text-xs font-black shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer ${
                isOnline
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25'
                  : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Play className="w-4 h-4" />
              <span>START COMMERCIAL TRIP ON {assignedBus.busNumber}</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. RIGHT-HAND EXPANSIVE DRIVER ROUTE MAP */}
      <div className="flex-1 h-full relative">
        <TransitMap
          buses={buses}
          routes={routes}
          selectedRouteId={assignedRoute.routeId}
          selectedBusId={assignedBus.busId}
          onSelectBus={() => {}}
        />
      </div>
    </div>
  );
};
