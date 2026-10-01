import React, { useState, useEffect, useMemo } from 'react';
import {
  AnalyticsSummary,
  TransitRoute,
  Bus,
  UserRole,
  UserProfile,
  ActiveTrip,
  TripIncident,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  subscribeToUsers,
  saveUserRoleInFirestore,
  subscribeToTrips,
  recordTripIncidentInFirestore,
  INITIAL_HISTORICAL_TRIPS,
} from '../../services/firestoreService';
import { RouteHeatmap } from '../Admin/RouteHeatmap';
import {
  Shield,
  Flame,
  History,
  BarChart3,
  Users,
  Bus as BusIcon,
  Route as RouteIcon,
  UserCheck,
  Search,
  X,
  AlertTriangle,
  Check,
  ArrowRight,
  Star,
} from 'lucide-react';

interface AdminAppProps {
  analytics: AnalyticsSummary;
  routes: TransitRoute[];
  buses: Bus[];
}

export const AdminApp: React.FC<AdminAppProps> = ({ analytics, routes, buses }) => {
  const { showNotification } = useAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [trips, setTrips] = useState<ActiveTrip[]>(INITIAL_HISTORICAL_TRIPS);
  const [activeSection, setActiveSection] = useState<
    'trips' | 'heatmap' | 'analytics' | 'users' | 'buses' | 'routes' | 'drivers'
  >('trips');

  // Trip Search & Filter State
  const [tripSearch, setTripSearch] = useState('');
  const [tripStatusFilter, setTripStatusFilter] = useState<'all' | 'completed' | 'active' | 'cancelled'>('all');
  const [tripIncidentFilter, setTripIncidentFilter] = useState<'all' | 'with_incidents' | 'clear'>('all');
  const [tripRouteFilter, setTripRouteFilter] = useState<string>('all');
  const [selectedTripDetails, setSelectedTripDetails] = useState<ActiveTrip | null>(null);

  // New Incident modal state on a past trip
  const [newIncidentType, setNewIncidentType] = useState<TripIncident['type']>('delay');
  const [newIncidentDesc, setNewIncidentDesc] = useState('');
  const [newIncidentDelay, setNewIncidentDelay] = useState('5');
  const [showAddIncidentModal, setShowAddIncidentModal] = useState<string | null>(null);

  // Local state for administrative fleet & route changes
  const [localBuses, setLocalBuses] = useState<Bus[]>(buses);
  const [localRoutes, setLocalRoutes] = useState<TransitRoute[]>(routes);

  // New Bus Form
  const [newBusNumber, setNewBusNumber] = useState('');
  const [newVehiclePlate, setNewVehiclePlate] = useState('');
  const [newBusCapacity, setNewBusCapacity] = useState('60');

  // New Route Form
  const [newRouteNumber, setNewRouteNumber] = useState('');
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteStart, setNewRouteStart] = useState('');
  const [newRouteDest, setNewRouteDest] = useState('');
  const [newRouteFare, setNewRouteFare] = useState('2.50');

  // Real Firestore Users Subscription
  useEffect(() => {
    const unsub = subscribeToUsers((firestoreUsers) => {
      setUsers(firestoreUsers);
    });
    return () => unsub();
  }, []);

  // Real Firestore Trips Subscription
  useEffect(() => {
    const unsub = subscribeToTrips((firestoreTrips) => {
      if (firestoreTrips && firestoreTrips.length > 0) {
        setTrips(firestoreTrips);
      }
    });
    return () => unsub();
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole, email: string, name: string) => {
    try {
      await saveUserRoleInFirestore(userId, newRole, email, name);
      showNotification(`Role updated to ${newRole.toUpperCase()} in Firestore database!`);
    } catch (err: any) {
      showNotification('Error saving role: ' + err.message);
    }
  };

  const handleAddBus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBusNumber || !newVehiclePlate) return;

    const newBus: Bus = {
      busId: 'bus-' + Date.now(),
      busNumber: newBusNumber,
      vehicleNumber: newVehiclePlate,
      capacity: Number(newBusCapacity) || 60,
      currentOccupancy: 0,
      driverId: 'unassigned',
      driverName: 'Standby Unit',
      routeId: routes[0]?.routeId || 'route-05',
      status: 'Available',
      currentLat: 37.7879,
      currentLng: -122.4075,
      currentSpeed: 0,
      heading: 0,
      currentDelay: 0,
      lastUpdated: new Date().toISOString(),
      isSimulated: false,
    };

    setLocalBuses((prev) => [newBus, ...prev]);
    setNewBusNumber('');
    setNewVehiclePlate('');
    showNotification(`New bus unit ${newBus.busNumber} (${newBus.vehicleNumber}) added to fleet!`);
  };

  const handleDeleteBus = (busId: string) => {
    setLocalBuses((prev) => prev.filter((b) => b.busId !== busId));
    showNotification('Bus decommissioned from service.');
  };

  const handleAddRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRouteNumber || !newRouteName) return;

    const createdRoute: TransitRoute = {
      routeId: 'route-' + Date.now(),
      routeNumber: newRouteNumber,
      routeName: `${newRouteNumber}: ${newRouteName}`,
      startLocation: newRouteStart || 'Central Transit Hub',
      destination: newRouteDest || 'Express Terminal',
      estimatedDuration: 25,
      activeStatus: true,
      fare: Number(newRouteFare) || 2.50,
      color: '#3b82f6',
      frequencyMinutes: 10,
      stops: [
        {
          stopId: 'stop-' + Date.now() + '-1',
          routeId: 'route-' + Date.now(),
          stopName: newRouteStart || 'Origin Hub',
          latitude: 37.7879,
          longitude: -122.4075,
          stopOrder: 1,
        },
        {
          stopId: 'stop-' + Date.now() + '-2',
          routeId: 'route-' + Date.now(),
          stopName: newRouteDest || 'Destination Stop',
          latitude: 37.759,
          longitude: -122.446,
          stopOrder: 2,
        },
      ],
      waypoints: [
        [37.7879, -122.4075],
        [37.759, -122.446],
      ],
    };

    setLocalRoutes((prev) => [...prev, createdRoute]);
    setNewRouteNumber('');
    setNewRouteName('');
    setNewRouteStart('');
    setNewRouteDest('');
    showNotification(`Route ${createdRoute.routeNumber} successfully created!`);
  };

  const handleAddIncidentToTrip = async (tripId: string) => {
    if (!newIncidentDesc.trim()) return;
    const incident: TripIncident = {
      incidentId: 'inc-' + Date.now(),
      type: newIncidentType,
      description: newIncidentDesc.trim(),
      delayMinutes: Number(newIncidentDelay) || 0,
      reportedAt: new Date().toISOString(),
    };

    try {
      await recordTripIncidentInFirestore(tripId, incident);
      // Update locally immediately
      setTrips((prev) =>
        prev.map((t) => {
          if (t.tripId === tripId) {
            const existing = t.incidents || [];
            return {
              ...t,
              incidents: [...existing, incident],
              delayMinutes: Math.max(t.delayMinutes || 0, incident.delayMinutes),
            };
          }
          return t;
        })
      );
      setShowAddIncidentModal(null);
      setNewIncidentDesc('');
      showNotification('Incident report recorded and synced to Firestore!');
    } catch (err: any) {
      showNotification('Error logging incident: ' + err.message);
    }
  };

  // Filtered trips computation
  const filteredTrips = useMemo(() => {
    const q = tripSearch.trim().toLowerCase();
    return trips.filter((trip) => {
      // 1. Text search across route, bus, driver, stops, or incident text
      if (q) {
        const matchesRoute =
          trip.routeName.toLowerCase().includes(q) || trip.routeId.toLowerCase().includes(q);
        const matchesBus =
          trip.busNumber.toLowerCase().includes(q) || trip.busId.toLowerCase().includes(q);
        const matchesDriver =
          trip.driverName.toLowerCase().includes(q) || trip.driverId.toLowerCase().includes(q);
        const matchesStops =
          trip.currentStopName?.toLowerCase().includes(q) ||
          trip.nextStopName?.toLowerCase().includes(q);
        const matchesIncidents = trip.incidents?.some(
          (i) =>
            i.description.toLowerCase().includes(q) ||
            i.type.toLowerCase().includes(q)
        );

        if (!matchesRoute && !matchesBus && !matchesDriver && !matchesStops && !matchesIncidents) {
          return false;
        }
      }

      // 2. Status filter
      if (tripStatusFilter !== 'all' && trip.tripStatus !== tripStatusFilter) {
        return false;
      }

      // 3. Incident filter
      const hasIncidents = (trip.incidents && trip.incidents.length > 0) || trip.delayMinutes >= 4;
      if (tripIncidentFilter === 'with_incidents' && !hasIncidents) {
        return false;
      }
      if (tripIncidentFilter === 'clear' && hasIncidents) {
        return false;
      }

      // 4. Route Corridor filter
      if (tripRouteFilter !== 'all' && trip.routeId !== tripRouteFilter) {
        return false;
      }

      return true;
    });
  }, [trips, tripSearch, tripStatusFilter, tripIncidentFilter, tripRouteFilter]);

  // Aggregate metrics for past trips
  const tripMetrics = useMemo(() => {
    const total = trips.length;
    const completed = trips.filter((t) => t.tripStatus === 'completed').length;
    const withIncidents = trips.filter(
      (t) => (t.incidents && t.incidents.length > 0) || t.delayMinutes >= 4
    ).length;
    const totalMinutes = trips.reduce(
      (acc, t) => acc + (t.durationMinutes || (t.endTime ? 30 : 15)),
      0
    );
    const avgDuration = total > 0 ? Math.round(totalMinutes / total) : 0;
    const totalDelay = trips.reduce((acc, t) => acc + (t.delayMinutes || 0), 0);
    const avgDelay = total > 0 ? (totalDelay / total).toFixed(1) : '0';

    return { total, completed, withIncidents, avgDuration, avgDelay };
  }, [trips]);

  const formatTripTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const formatTripDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h1 className="text-xl font-black text-white">Transit Authority Administrator Suite</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage trips, incident reports, users, drivers, buses, routes &amp; view system intelligence
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 text-xs overflow-x-auto">
            <button
              onClick={() => setActiveSection('heatmap')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                activeSection === 'heatmap'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-rose-300" />
              <span>Route Heatmap (D3.js)</span>
            </button>
            <button
              onClick={() => setActiveSection('trips')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                activeSection === 'trips'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5 text-indigo-300" />
              <span>Trip History ({trips.length})</span>
            </button>
            <button
              onClick={() => setActiveSection('analytics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                activeSection === 'analytics'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-300" />
              <span>Analytics &amp; KPIs</span>
            </button>
            <button
              onClick={() => setActiveSection('users')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                activeSection === 'users'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-blue-300" />
              <span>Users &amp; RBAC ({users.length})</span>
            </button>
            <button
              onClick={() => setActiveSection('buses')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                activeSection === 'buses'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BusIcon className="w-3.5 h-3.5 text-cyan-300" />
              <span>Buses ({localBuses.length})</span>
            </button>
            <button
              onClick={() => setActiveSection('routes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                activeSection === 'routes'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <RouteIcon className="w-3.5 h-3.5 text-purple-300" />
              <span>Routes ({localRoutes.length})</span>
            </button>
            <button
              onClick={() => setActiveSection('drivers')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                activeSection === 'drivers'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-teal-300" />
              <span>Drivers</span>
            </button>
          </div>
        </div>

        {/* 0. ROUTE HEATMAP & PASSENGER DEMAND VISUALIZATION (D3.JS) */}
        {activeSection === 'heatmap' && (
          <RouteHeatmap routes={localRoutes} buses={buses} />
        )}

        {/* 1. TRIP HISTORY & INCIDENTS SECTION (CORE PROMPT REQUIREMENT) */}
        {activeSection === 'trips' && (
          <div className="space-y-6">
            {/* Top Operational Summary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">
                  Total Logged Trips
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white mt-0.5 block">
                  {tripMetrics.total}
                </span>
                <span className="text-[11px] text-slate-400">Fetched from Firestore</span>
              </div>

              <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">
                  Completed Trips
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-400 mt-0.5 block">
                  {tripMetrics.completed}
                </span>
                <span className="text-[11px] text-emerald-400/80">Full route traveled</span>
              </div>

              <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">
                  Trips with Incidents
                </span>
                <span className="text-2xl sm:text-3xl font-black text-rose-400 mt-0.5 block">
                  {tripMetrics.withIncidents}
                </span>
                <span className="text-[11px] text-rose-400/80">Traffic / roadblock / issues</span>
              </div>

              <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">
                  Avg Trip Duration
                </span>
                <span className="text-2xl sm:text-3xl font-black text-cyan-400 mt-0.5 block">
                  {tripMetrics.avgDuration}m
                </span>
                <span className="text-[11px] text-slate-400">Scheduled headway SLA</span>
              </div>

              <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">
                  Avg Delay Variance
                </span>
                <span className="text-2xl sm:text-3xl font-black text-amber-400 mt-0.5 block">
                  +{tripMetrics.avgDelay}m
                </span>
                <span className="text-[11px] text-slate-400">Recorded telemetry</span>
              </div>
            </div>

            {/* Search and Filters Toolbar */}
            <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-3">
              <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
                {/* Search Bar */}
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={tripSearch}
                    onChange={(e) => setTripSearch(e.target.value)}
                    placeholder="Search route, bus, driver, or incident..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 font-semibold focus:outline-none focus:border-indigo-500"
                  />
                  {tripSearch && (
                    <button
                      onClick={() => setTripSearch('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white text-xs font-bold"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Dropdowns and Buttons */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  {/* Status Filter */}
                  <select
                    value={tripStatusFilter}
                    onChange={(e) => setTripStatusFilter(e.target.value as any)}
                    className="p-2 bg-slate-950 rounded-xl border border-slate-700 text-slate-300 font-semibold focus:outline-none text-xs"
                  >
                    <option value="all">All Trip Statuses</option>
                    <option value="completed">Completed Only</option>
                    <option value="active">Active In-Transit</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  {/* Incident Filter */}
                  <select
                    value={tripIncidentFilter}
                    onChange={(e) => setTripIncidentFilter(e.target.value as any)}
                    className="p-2 bg-slate-950 rounded-xl border border-slate-700 text-slate-300 font-semibold focus:outline-none text-xs"
                  >
                    <option value="all">All Incidents</option>
                    <option value="with_incidents">With Recorded Incidents</option>
                    <option value="clear">Clear (Zero Incidents)</option>
                  </select>

                  {/* Corridor Filter */}
                  <select
                    value={tripRouteFilter}
                    onChange={(e) => setTripRouteFilter(e.target.value)}
                    className="p-2 bg-slate-950 rounded-xl border border-slate-700 text-slate-300 font-semibold focus:outline-none text-xs"
                  >
                    <option value="all">All Corridors</option>
                    {routes.map((r) => (
                      <option key={r.routeId} value={r.routeId}>
                        {r.routeName.split(':')[0]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active Filter Badges Counter */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                <span>
                  Showing <strong className="text-white font-mono">{filteredTrips.length}</strong> of{' '}
                  <strong className="text-white font-mono">{trips.length}</strong> historical trips
                </span>
                <span className="text-emerald-400 font-mono flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Live Firestore Sync (/trips)</span>
                </span>
              </div>
            </div>

            {/* Trips List / Records Table */}
            {filteredTrips.length === 0 ? (
              <div className="p-8 text-center bg-slate-900 rounded-3xl border border-slate-800 text-slate-400 space-y-2">
                <History className="w-8 h-8 mx-auto text-slate-500" />
                <h4 className="text-sm font-bold text-white">No historical trips match the criteria</h4>
                <p className="text-xs">Try clearing the search query or adjusting the incident filter.</p>
                <button
                  onClick={() => {
                    setTripSearch('');
                    setTripStatusFilter('all');
                    setTripIncidentFilter('all');
                    setTripRouteFilter('all');
                  }}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs mt-2"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTrips.map((trip) => {
                  const hasIncidents = (trip.incidents && trip.incidents.length > 0) || trip.delayMinutes >= 4;
                  const isCompleted = trip.tripStatus === 'completed';
                  const duration = trip.durationMinutes || (isCompleted ? 32 : 12);

                  return (
                    <div
                      key={trip.tripId}
                      className="p-5 bg-slate-900 rounded-3xl border border-slate-800 hover:border-slate-700 shadow-xl transition-all space-y-4"
                    >
                      {/* Top Row: Route & Status */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80 text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-black text-xs">
                            {trip.routeId.replace('route-', 'R')}
                          </span>
                          <div>
                            <h4 className="font-black text-white text-sm">
                              {trip.routeName || trip.routeId}
                            </h4>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              {formatTripDate(trip.startTime)} · Departed: {formatTripTime(trip.startTime)}{' '}
                              <ArrowRight className="w-3 h-3 inline text-slate-500" /> {trip.endTime ? `Arrived: ${formatTripTime(trip.endTime)}` : 'In Transit'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                              trip.tripStatus === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : trip.tripStatus === 'active'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {trip.tripStatus}
                          </span>

                          <span className="text-[10px] font-mono bg-slate-950 px-2 py-1 rounded-xl border border-slate-800 text-slate-400">
                            ID: {trip.tripId}
                          </span>
                        </div>
                      </div>

                      {/* Middle Grid: Bus, Driver, Duration, Speed */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Assigned Bus</span>
                          <b className="text-white text-xs">{trip.busNumber}</b>
                          <span className="text-[10px] font-mono text-cyan-400 block mt-0.5">
                            {trip.busId}
                          </span>
                        </div>

                        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Driver</span>
                          <b className="text-white text-xs">{trip.driverName}</b>
                          <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                            ID: {trip.driverId}
                          </span>
                        </div>

                        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Duration &amp; Delay</span>
                          <b className="text-white text-xs">{duration} minutes</b>
                          <span
                            className={`text-[10px] font-bold block mt-0.5 ${
                              trip.delayMinutes > 0 ? 'text-amber-400' : 'text-emerald-400'
                            }`}
                          >
                            {trip.delayMinutes > 0 ? `+${trip.delayMinutes}m delay` : 'On Schedule'}
                          </span>
                        </div>

                        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Corridor Telemetry</span>
                          <b className="text-cyan-300 text-xs">~{trip.speed || 32} km/h</b>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Last Stop: {trip.currentStopName || 'Origin Terminus'}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Section: Recorded Incidents Breakdown */}
                      <div className="pt-2 border-t border-slate-800/80">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold">
                            {hasIncidents ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                            <span className={hasIncidents ? 'text-amber-300' : 'text-emerald-300'}>
                              {hasIncidents
                                ? `Recorded Incidents (${trip.incidents?.length || 1})`
                                : 'No Incidents Recorded (Trip proceeded without disruption)'}
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              setShowAddIncidentModal(trip.tripId);
                              setNewIncidentDesc('');
                              setNewIncidentDelay(String(trip.delayMinutes || 5));
                            }}
                            className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-[10px] font-bold transition-all"
                          >
                            + Log Incident Note
                          </button>
                        </div>

                        {/* Incident Cards */}
                        {trip.incidents && trip.incidents.length > 0 ? (
                          <div className="space-y-2">
                            {trip.incidents.map((inc) => (
                              <div
                                key={inc.incidentId}
                                className="p-3 bg-slate-950 rounded-2xl border border-rose-500/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                      {inc.type}
                                    </span>
                                    <span className="text-white font-semibold">{inc.description}</span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-mono block">
                                    Reported at: {formatTripTime(inc.reportedAt)} · Variance Impact: +{inc.delayMinutes} mins
                                  </span>
                                </div>
                                <span className="text-[11px] font-black text-rose-400 shrink-0">
                                  +{inc.delayMinutes}m delay
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : trip.delayMinutes >= 4 ? (
                          <div className="p-3 bg-slate-950 rounded-2xl border border-amber-500/20 text-xs flex items-center justify-between">
                            <span className="text-amber-200 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              Automated Delay Flag: Vehicle experienced +{trip.delayMinutes} minutes variance from expected stop headway.
                            </span>
                            <span className="text-amber-400 font-bold text-xs">+{trip.delayMinutes}m</span>
                          </div>
                        ) : null}
                      </div>

                      {/* Detail Drawer Button */}
                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                        <span>Waypoint Coordinates Logged: Lat {trip.currentLat.toFixed(4)}, Lng {trip.currentLng.toFixed(4)}</span>
                        <button
                          onClick={() => setSelectedTripDetails(trip)}
                          className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline flex items-center gap-1"
                        >
                          <span>View Full Itinerary Log</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Incident Logging Modal */}
            {showAddIncidentModal && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h4 className="text-base font-black text-white">Record Incident on Trip</h4>
                    <button
                      onClick={() => setShowAddIncidentModal(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Incident Category
                      </label>
                      <select
                        value={newIncidentType}
                        onChange={(e) => setNewIncidentType(e.target.value as any)}
                        className="w-full p-2.5 bg-slate-950 rounded-xl border border-slate-700 text-white font-semibold"
                      >
                        <option value="traffic">Heavy Traffic Congestion</option>
                        <option value="roadblock">Roadblock / Construction Detour</option>
                        <option value="breakdown">Vehicle Mechanical Issue</option>
                        <option value="weather">Adverse Weather / Visibility</option>
                        <option value="delay">General Operating Delay</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Delay Caused (Minutes)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={newIncidentDelay}
                        onChange={(e) => setNewIncidentDelay(e.target.value)}
                        className="w-full p-2.5 bg-slate-950 rounded-xl border border-slate-700 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Incident Description
                      </label>
                      <textarea
                        rows={3}
                        value={newIncidentDesc}
                        onChange={(e) => setNewIncidentDesc(e.target.value)}
                        placeholder="Detail the cause, specific intersection, or passenger advisory..."
                        className="w-full p-2.5 bg-slate-950 rounded-xl border border-slate-700 text-white"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => handleAddIncidentToTrip(showAddIncidentModal)}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs transition-all shadow-lg"
                      >
                        Save Incident to Firestore
                      </button>
                      <button
                        onClick={() => setShowAddIncidentModal(null)}
                        className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Trip Itinerary Modal */}
            {selectedTripDetails && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <h4 className="text-base font-black text-white">{selectedTripDetails.routeName}</h4>
                      <span className="text-[10px] font-mono text-slate-400">Trip ID: {selectedTripDetails.tripId}</span>
                    </div>
                    <button
                      onClick={() => setSelectedTripDetails(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Vehicle / Driver:</span>
                        <b className="text-white">{selectedTripDetails.busNumber} · {selectedTripDetails.driverName}</b>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Start Time:</span>
                        <span className="font-mono text-slate-300">{new Date(selectedTripDetails.startTime).toLocaleString()}</span>
                      </div>
                      {selectedTripDetails.endTime && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">End Time:</span>
                          <span className="font-mono text-slate-300">{new Date(selectedTripDetails.endTime).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Duration:</span>
                        <b className="text-cyan-400">{selectedTripDetails.durationMinutes || 30} minutes</b>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Recorded Delay:</span>
                        <b className={selectedTripDetails.delayMinutes > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                          +{selectedTripDetails.delayMinutes} mins
                        </b>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-bold text-white text-xs mb-2">Recorded Incidents Log</h5>
                      {selectedTripDetails.incidents && selectedTripDetails.incidents.length > 0 ? (
                        <div className="space-y-2">
                          {selectedTripDetails.incidents.map((i) => (
                            <div key={i.incidentId} className="p-3 bg-slate-950 rounded-xl border border-rose-500/20">
                              <div className="flex justify-between">
                                <b className="text-rose-300 uppercase text-[10px]">{i.type}</b>
                                <span className="text-rose-400 font-mono text-[10px]">+{i.delayMinutes}m delay</span>
                              </div>
                              <p className="text-white text-xs mt-1">{i.description}</p>
                              <span className="text-[10px] text-slate-500 font-mono block mt-1">
                                {new Date(i.reportedAt).toLocaleTimeString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-400 text-xs italic">No incidents recorded for this trip.</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedTripDetails(null)}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. SYSTEM-WIDE ANALYTICS & MONITOR ROUTE PERFORMANCE */}
        {activeSection === 'analytics' && (
          <div className="space-y-6">
            {/* Executive KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Trips Completed Today</span>
                <span className="text-3xl font-black text-white">{analytics.tripsCompletedToday}</span>
                <span className="text-emerald-400 text-xs font-semibold block mt-1">↑ +14.2% daily growth</span>
              </div>
              <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">On-Time Performance</span>
                <span className="text-3xl font-black text-emerald-400">{analytics.onTimePerformanceRate}%</span>
                <span className="text-slate-400 text-xs font-semibold block mt-1">Service SLA target: 92%</span>
              </div>
              <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Average Delay Variance</span>
                <span className="text-3xl font-black text-amber-400">{analytics.averageDelayMinutes}m</span>
                <span className="text-slate-400 text-xs font-semibold block mt-1">Under 5m city benchmark</span>
              </div>
              <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">ETA Prediction Accuracy</span>
                <span className="text-3xl font-black text-cyan-400">{analytics.averageEtaAccuracy}%</span>
                <span className="text-slate-400 text-xs font-semibold block mt-1">Grounded telemetry</span>
              </div>
            </div>

            {/* Route Performance Rankings & Delay Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4">
                <h3 className="font-extrabold text-sm text-white">Route Performance &amp; Punctuality Rankings</h3>
                <div className="space-y-3">
                  {analytics.routePerformance.map((item) => (
                    <div key={item.routeId} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-slate-200">{item.routeName}</span>
                        <span className="font-black text-emerald-400">{item.onTimeRate}% on-time</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${item.onTimeRate}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Avg Delay: +{item.avgDelay} mins</span>
                        <span>Daily Passengers: ~{item.dailyPassengers.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Peak Commuter Demand Modeling */}
              <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4">
                <h3 className="font-extrabold text-sm text-white">Hourly Commuter Load Histogram (Peak Demand)</h3>
                <div className="h-48 flex items-end justify-between gap-1 pt-6 px-2 border-b border-slate-800">
                  {(analytics.peakOperatingHours || []).map((slot) => {
                    const heightPercent = slot.loadPercentage || 40;
                    return (
                      <div key={slot.hour} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="relative w-full flex justify-center">
                          <div
                            className="w-full max-w-[28px] bg-gradient-to-t from-indigo-600 to-cyan-400 rounded-t-md transition-all group-hover:brightness-125"
                            style={{ height: `${heightPercent}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-slate-400">{slot.hour.replace(':00', '')}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="text-[11px] text-slate-400 flex justify-between">
                  <span>Morning Peak: 08:00 - 10:00 AM</span>
                  <span className="text-amber-400 font-semibold">Evening Rush: 17:00 - 19:00 PM</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. MANAGE USERS & PERMISSIONS (RBAC) */}
        {activeSection === 'users' && (
          <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-black text-white">Role-Based Access Control (RBAC) &amp; User Permissions</h3>
              <p className="text-xs text-slate-400">Manage user accounts and elevate or revoke administrative permissions</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">User</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Privileges</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {users.map((u) => (
                    <tr key={u.userId} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-white">{u.displayName || 'Anonymous'}</td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            u.role === 'admin'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : u.role === 'operator'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : u.role === 'driver'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-lime-500/20 text-lime-300 border border-lime-500/30'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-400">{u.email}</td>
                      <td className="p-3 text-[11px] text-slate-400">
                        {u.role === 'admin'
                          ? 'Full Authority (Analytics, Users, Fleet, Routes)'
                          : u.role === 'operator'
                          ? 'Dispatch & Fleet Telemetry'
                          : u.role === 'driver'
                          ? 'GPS Broadcasting & Trip Terminal'
                          : 'Public Search & Digital Tickets'}
                      </td>
                      <td className="p-3 text-right space-x-1">
                        <select
                          value={u.role}
                          onChange={(e) =>
                            handleRoleChange(u.userId, e.target.value as UserRole, u.email, u.displayName)
                          }
                          className="p-1 bg-slate-950 border border-slate-700 rounded-lg text-[10px] text-slate-300 font-bold"
                        >
                          <option value="passenger">Passenger</option>
                          <option value="driver">Driver</option>
                          <option value="operator">Operator</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. MANAGE BUSES */}
        {activeSection === 'buses' && (
          <div className="space-y-6">
            {/* Add New Bus Panel */}
            <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4">
              <div>
                <h3 className="text-base font-black text-white">Add New Bus to Transit Fleet</h3>
                <p className="text-xs text-slate-400">Register a new transit vehicle into the operational inventory</p>
              </div>

              <form onSubmit={handleAddBus} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <input
                  type="text"
                  required
                  value={newBusNumber}
                  onChange={(e) => setNewBusNumber(e.target.value)}
                  placeholder="Bus Number (e.g. Bus 12-Express)"
                  className="p-2.5 bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500"
                />
                <input
                  type="text"
                  required
                  value={newVehiclePlate}
                  onChange={(e) => setNewVehiclePlate(e.target.value)}
                  placeholder="Vehicle Reg Plate (e.g. MP-9940)"
                  className="p-2.5 bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500"
                />
                <input
                  type="number"
                  value={newBusCapacity}
                  onChange={(e) => setNewBusCapacity(e.target.value)}
                  placeholder="Passenger Capacity (e.g. 60)"
                  className="p-2.5 bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500"
                />
                <button
                  type="submit"
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all"
                >
                  + Add Bus to Fleet
                </button>
              </form>
            </div>

            {/* Fleet Inventory List */}
            <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-3">
              <h3 className="text-base font-black text-white">Active Fleet Inventory ({localBuses.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {localBuses.map((bus) => (
                  <div key={bus.busId} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-white">{bus.busNumber}</span>
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                        {bus.vehicleNumber}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      Capacity: <b>{bus.capacity} pax</b> • Status: <b className="text-emerald-400">{bus.status}</b>
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      Driver: {bus.driverName}
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                      <span className="text-[10px] text-slate-500">ID: {bus.busId}</span>
                      <button
                        onClick={() => handleDeleteBus(bus.busId)}
                        className="text-rose-400 hover:underline text-xs font-semibold"
                      >
                        Decommission
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5. MANAGE ROUTES */}
        {activeSection === 'routes' && (
          <div className="space-y-6">
            {/* Create New Route Form */}
            <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4">
              <div>
                <h3 className="text-base font-black text-white">Create New Transit Corridor</h3>
                <p className="text-xs text-slate-400">Establish a new bus route with fares, starting point and destination</p>
              </div>

              <form onSubmit={handleAddRoute} className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                <input
                  type="text"
                  required
                  value={newRouteNumber}
                  onChange={(e) => setNewRouteNumber(e.target.value)}
                  placeholder="Route # (e.g. Line 14)"
                  className="p-2.5 bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500"
                />
                <input
                  type="text"
                  required
                  value={newRouteName}
                  onChange={(e) => setNewRouteName(e.target.value)}
                  placeholder="Name (e.g. Harbor Express)"
                  className="p-2.5 bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500"
                />
                <input
                  type="text"
                  value={newRouteStart}
                  onChange={(e) => setNewRouteStart(e.target.value)}
                  placeholder="Start Location"
                  className="p-2.5 bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500"
                />
                <input
                  type="text"
                  value={newRouteDest}
                  onChange={(e) => setNewRouteDest(e.target.value)}
                  placeholder="Destination"
                  className="p-2.5 bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500"
                />
                <button
                  type="submit"
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all"
                >
                  + Create Route
                </button>
              </form>
            </div>

            {/* Routes List */}
            <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-3">
              <h3 className="text-base font-black text-white">Configured Routes ({localRoutes.length})</h3>
              <div className="space-y-3">
                {localRoutes.map((r) => (
                  <div key={r.routeId} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-white text-sm">{r.routeName}</span>
                        <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-emerald-400">
                          ${r.fare.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5 flex items-center gap-1">
                        <span>{r.startLocation}</span>
                        <ArrowRight className="w-3 h-3 text-slate-500 inline" />
                        <span>{r.destination}</span>
                        <span>• {r.stops.length} Stops • Headway: {r.frequencyMinutes || 10}m</span>
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-400">
                      <span>Status: <b className="text-emerald-400">Active</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 6. MANAGE DRIVERS */}
        {activeSection === 'drivers' && (
          <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-black text-white">Commercial Driver Management &amp; Safety Oversight</h3>
              <p className="text-xs text-slate-400">Driver verification, CDL compliance records, and real-time safety scores</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { name: 'Officer Rajesh Kumar', id: 'DR-104', license: 'CDL-CA-99210', rating: '4.95', trips: 1420, assigned: 'Bus 05-A', status: 'On Shift' },
                { name: 'Officer Sarah Jenkins', id: 'DR-208', license: 'CDL-CA-88412', rating: '4.91', trips: 980, assigned: 'Bus 05-B', status: 'On Route' },
                { name: 'Officer Michael Chen', id: 'DR-319', license: 'CDL-CA-77195', rating: '4.98', trips: 2150, assigned: 'Bus 07-Express', status: 'Standby' },
                { name: 'Officer Elena Rostova', id: 'DR-412', license: 'CDL-CA-66320', rating: '4.89', trips: 760, assigned: 'Bus 12-Airport', status: 'On Break' },
              ].map((driver) => (
                <div key={driver.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-black text-white">{driver.name}</h4>
                      <span className="text-[10px] text-slate-500 font-mono">ID: {driver.id} • {driver.license}</span>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-800/40">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{driver.rating}</span>
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-800 space-y-1 text-slate-300 text-[11px]">
                    <div>Assigned Vehicle: <b className="text-white">{driver.assigned}</b></div>
                    <div>Lifetime Trips: <b className="text-emerald-400">{driver.trips} completed</b></div>
                    <div>Shift Status: <b className="text-cyan-400">{driver.status}</b></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
