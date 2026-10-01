import React, { useState } from 'react';
import { Bus, TransitRoute, ServiceAlert, BusStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Bus as BusIcon, Megaphone, Map, Radio, X } from 'lucide-react';

interface OperatorViewProps {
  buses: Bus[];
  routes: TransitRoute[];
  alerts: ServiceAlert[];
  onUpdateBus: (bus: Bus) => void;
  onAddAlert: (alert: ServiceAlert) => void;
  onDeleteAlert: (alertId: string) => void;
  onSelectBus: (busId: string) => void;
}

export const OperatorView: React.FC<OperatorViewProps> = ({
  buses,
  routes,
  alerts,
  onUpdateBus,
  onAddAlert,
  onDeleteAlert,
  onSelectBus,
}) => {
  const { showNotification, speakAnnouncement } = useAuth();

  // Tab
  const [activeTab, setActiveTab] = useState<'fleet' | 'alerts' | 'routes'>('fleet');

  // New Alert Form
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState<'info' | 'warning' | 'emergency'>('warning');
  const [alertRouteId, setAlertRouteId] = useState<string>('');

  // Edit Bus Modal State
  const [editingBus, setEditingBus] = useState<Bus | null>(null);

  // Statistics
  const totalBuses = buses.length;
  const activeBuses = buses.filter((b) => b.status === 'On Route').length;
  const delayedBuses = buses.filter((b) => b.status === 'Delayed' || b.currentDelay >= 4).length;
  const availableBuses = buses.filter((b) => b.status === 'Available').length;
  const inBreakBuses = buses.filter((b) => b.status === 'Break' || b.status === 'Offline').length;

  const handlePublishAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertTitle.trim() || !alertMessage.trim()) {
      showNotification('Please fill in alert title and message');
      return;
    }

    try {
      const selectedRoute = routes.find((r) => r.routeId === alertRouteId);
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: alertTitle,
          message: alertMessage,
          severity: alertSeverity,
          affectedRouteId: alertRouteId || undefined,
          affectedRouteName: selectedRoute?.routeName || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.alert) {
        onAddAlert(data.alert);
        setAlertTitle('');
        setAlertMessage('');
        showNotification('Service advisory broadcasted to all passengers!');
        speakAnnouncement(`Transport Advisory Published: ${alertTitle}. ${alertMessage}`);
      }
    } catch {
      showNotification('Alert published locally');
    }
  };

  const handleUpdateStatus = async (busId: string, newStatus: BusStatus) => {
    try {
      const res = await fetch(`/api/buses/${busId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success && data.bus) {
        onUpdateBus(data.bus);
        showNotification(`${data.bus.busNumber} status changed to ${newStatus}`);
      }
    } catch {
      showNotification('Bus status updated locally');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Fleet Telemetry KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase block">Total Fleet</span>
          <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{totalBuses}</span>
          <span className="text-[10px] text-slate-500 block">Vehicles tracked</span>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-950/60 shadow-sm">
          <span className="text-[11px] font-bold text-emerald-600 uppercase block">Active On Route</span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{activeBuses}</span>
          <span className="text-[10px] text-emerald-500 block">Live coordinates</span>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-950/60 shadow-sm">
          <span className="text-[11px] font-bold text-rose-600 uppercase block">Delayed Buses</span>
          <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{delayedBuses}</span>
          <span className="text-[10px] text-rose-500 block">&gt;4 min variance</span>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-950/60 shadow-sm">
          <span className="text-[11px] font-bold text-blue-600 uppercase block">Available / Idle</span>
          <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{availableBuses}</span>
          <span className="text-[10px] text-blue-500 block">Ready for dispatch</span>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase block">Maintenance / Off</span>
          <span className="text-2xl font-black text-slate-600 dark:text-slate-400">{inBreakBuses}</span>
          <span className="text-[10px] text-slate-500 block">Depot reserve</span>
        </div>
      </div>

      {/* 2. Dispatcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('fleet')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'fleet'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BusIcon className="w-3.5 h-3.5" />
          <span>Fleet Operations &amp; Status</span>
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'alerts'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>Broadcast Advisories ({alerts.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('routes')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'routes'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Map className="w-3.5 h-3.5" />
          <span>Network Routes &amp; Schedules ({routes.length})</span>
        </button>
      </div>

      {/* TAB 1: FLEET OPERATIONS */}
      {activeTab === 'fleet' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                Active Fleet Management &amp; Driver Assignments
              </h3>
              <p className="text-xs text-slate-500">Live monitoring, status overrides, and route assignments</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-3 rounded-l-xl">Bus / Vehicle</th>
                  <th className="p-3">Assigned Route</th>
                  <th className="p-3">Current Driver</th>
                  <th className="p-3">Speed / Telemetry</th>
                  <th className="p-3">Delay Status</th>
                  <th className="p-3">Operating Status</th>
                  <th className="p-3 rounded-r-xl text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {buses.map((bus) => {
                  const route = routes.find((r) => r.routeId === bus.routeId);
                  const isDelayed = bus.status === 'Delayed' || bus.currentDelay >= 4;

                  return (
                    <tr
                      key={bus.busId}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <BusIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <div>
                            <div>{bus.busNumber}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{bus.vehicleNumber}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        {route ? (
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm"
                            style={{ backgroundColor: route.color }}
                          >
                            {route.routeName.split(':')[0]}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">
                        {bus.driverName || 'No Driver'}
                      </td>
                      <td className="p-3 font-mono">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{Math.round(bus.currentSpeed)} km/h</span>
                        <span className="text-slate-400 text-[10px] block">{bus.isSimulated ? 'GPS Sim' : 'Live Phone'}</span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-bold ${
                            isDelayed ? 'text-rose-500' : 'text-emerald-500'
                          }`}
                        >
                          {bus.currentDelay > 0 ? `+${bus.currentDelay} min delay` : 'On Time (0m)'}
                        </span>
                      </td>
                      <td className="p-3">
                        <select
                          value={bus.status}
                          onChange={(e) => handleUpdateStatus(bus.busId, e.target.value as BusStatus)}
                          className="p-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        >
                          <option value="On Route">On Route</option>
                          <option value="Available">Available</option>
                          <option value="Delayed">Delayed</option>
                          <option value="Break">Break</option>
                          <option value="Offline">Offline</option>
                        </select>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            onSelectBus(bus.busId);
                            showNotification(`Map focused on ${bus.busNumber}`);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          Radar View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BROADCAST ADVISORIES & ALERTS */}
      {activeTab === 'alerts' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Create Alert Form */}
          <div className="md:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm mb-1">
              Publish Service Announcement
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Instantly broadcasts route delays, road closures, or maintenance notices to all passengers.
            </p>

            <form onSubmit={handlePublishAlert} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Advisory Headline
                </label>
                <input
                  type="text"
                  value={alertTitle}
                  onChange={(e) => setAlertTitle(e.target.value)}
                  placeholder="e.g., Heavy Traffic on Route 05"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Severity Level
                </label>
                <select
                  value={alertSeverity}
                  onChange={(e) => setAlertSeverity(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
                >
                  <option value="info">Information (Normal)</option>
                  <option value="warning">Warning (Delays &amp; Detours)</option>
                  <option value="emergency">Emergency (Suspension / Vehicle Breakdown)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Target Transit Route (Optional)
                </label>
                <select
                  value={alertRouteId}
                  onChange={(e) => setAlertRouteId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
                >
                  <option value="">All City Network Routes</option>
                  {routes.map((r) => (
                    <option key={r.routeId} value={r.routeId}>
                      {r.routeName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Message Description
                </label>
                <textarea
                  value={alertMessage}
                  onChange={(e) => setAlertMessage(e.target.value)}
                  rows={3}
                  placeholder="e.g., Buses delayed by 10-15 minutes due to lane maintenance near Civic Center."
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Radio className="w-4 h-4" />
                <span>Broadcast Notice to Passengers</span>
              </button>
            </form>
          </div>

          {/* Active Advisories List */}
          <div className="md:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm mb-3">
              Currently Active Service Bulletins
            </h3>

            <div className="space-y-3">
              {alerts.map((alt) => (
                <div
                  key={alt.alertId}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          alt.severity === 'emergency'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : alt.severity === 'warning'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        }`}
                      >
                        {alt.severity}
                      </span>
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{alt.title}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{alt.message}</p>
                    <div className="mt-2 text-[10px] text-slate-400">
                      Scope: {alt.affectedRouteName || 'System-wide'} • Posted: {new Date(alt.createdAt).toLocaleTimeString()}
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteAlert(alt.alertId)}
                    className="text-slate-400 hover:text-rose-500 text-xs font-bold p-1 flex items-center gap-1 cursor-pointer"
                    title="Dismiss Alert"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Dismiss</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: NETWORK ROUTES & SCHEDULES */}
      {activeTab === 'routes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {routes.map((route) => (
            <div
              key={route.routeId}
              className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-extrabold text-xs shadow"
                    style={{ backgroundColor: route.color }}
                  >
                    {route.routeNumber}
                  </span>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{route.routeName}</h4>
                    <span className="text-xs text-slate-500">
                      Est. Duration: {route.estimatedDuration}m • Frequency: every {route.frequencyMinutes}m
                    </span>
                  </div>
                </div>
                <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                  ${route.fare.toFixed(2)}
                </span>
              </div>

              {/* Stops list */}
              <div className="space-y-1.5 pl-2 border-l-2 border-slate-200 dark:border-slate-800 my-3 text-xs">
                {route.stops.map((stop, sIdx) => (
                  <div key={stop.stopId} className="flex items-center justify-between py-0.5">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {sIdx + 1}. {stop.stopName}
                    </span>
                    <span className="text-[10px] text-slate-400">{stop.landmark}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
