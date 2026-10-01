import React, { useState } from 'react';
import { AnalyticsSummary, TransitRoute, Bus, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { BarChart3, Users, Award, Star } from 'lucide-react';

interface AdminViewProps {
  analytics: AnalyticsSummary;
  routes: TransitRoute[];
  buses: Bus[];
}

interface MockUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'Active' | 'Suspended';
  lastActive: string;
}

export const AdminView: React.FC<AdminViewProps> = ({ analytics, routes, buses }) => {
  const { user, showNotification } = useAuth();

  const [users, setUsers] = useState<MockUser[]>([
    { id: 'usr-1', name: 'Prithvi R (Admin)', email: 'rprithvi388@gmail.com', role: 'admin', status: 'Active', lastActive: 'Just now' },
    { id: 'usr-2', name: 'Rajesh Kumar', email: 'driver.rajesh@metropulse.org', role: 'driver', status: 'Active', lastActive: '5m ago' },
    { id: 'usr-3', name: 'Dispatcher Office A', email: 'dispatch.hq@metropulse.org', role: 'operator', status: 'Active', lastActive: '12m ago' },
    { id: 'usr-4', name: 'Sarah Jenkins', email: 'driver.sarah@metropulse.org', role: 'driver', status: 'Active', lastActive: '18m ago' },
    { id: 'usr-5', name: 'Alex Johnson', email: 'alex.passenger@gmail.com', role: 'passenger', status: 'Active', lastActive: '1h ago' },
  ]);

  const [activeAdminTab, setActiveAdminTab] = useState<'analytics' | 'users' | 'drivers'>('analytics');

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    showNotification(`User role updated to ${newRole.toUpperCase()}`);
  };

  return (
    <div className="space-y-6">
      {/* Tab Selectors */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveAdminTab('analytics')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeAdminTab === 'analytics'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Transport Analytics &amp; KPIs</span>
        </button>
        <button
          onClick={() => setActiveAdminTab('users')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeAdminTab === 'users'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>User Access &amp; RBAC ({users.length})</span>
        </button>
        <button
          onClick={() => setActiveAdminTab('drivers')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeAdminTab === 'drivers'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Driver Performance Records</span>
        </button>
      </div>

      {/* 1. ANALYTICS TAB */}
      {activeAdminTab === 'analytics' && (
        <div className="space-y-6">
          {/* Executive KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase block">Daily Trips Completed</span>
              <span className="text-3xl font-black text-slate-900 dark:text-slate-100">
                {analytics.tripsCompletedToday}
              </span>
              <span className="text-emerald-500 font-bold text-[11px] mt-1 block">↑ +14% vs yesterday</span>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase block">On-Time Performance</span>
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {analytics.onTimePerformanceRate}%
              </span>
              <span className="text-slate-400 font-medium text-[11px] mt-1 block">Target threshold: 92%</span>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase block">Average Network Delay</span>
              <span className="text-3xl font-black text-amber-500 dark:text-amber-400">
                {analytics.averageDelayMinutes}m
              </span>
              <span className="text-slate-400 font-medium text-[11px] mt-1 block">Peak hour variance</span>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase block">ETA Prediction Accuracy</span>
              <span className="text-3xl font-black text-blue-600 dark:text-blue-400">
                {analytics.averageEtaAccuracy}%
              </span>
              <span className="text-slate-400 font-medium text-[11px] mt-1 block">Within ±90 seconds</span>
            </div>
          </div>

          {/* Peak Operating Hours Histogram */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                  Passenger Demand &amp; Peak Operating Headway
                </h3>
                <p className="text-xs text-slate-500">Hourly fleet departure frequency and bus passenger load</p>
              </div>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-full">
                Morning Peak 08:00 • Evening Peak 17:00
              </span>
            </div>

            {/* Visual Bar Chart */}
            <div className="h-44 flex items-end gap-2 pt-6 pb-2 px-1 overflow-x-auto">
              {analytics.peakOperatingHours.map((slot) => {
                const isPeak = slot.loadPercentage >= 85;
                return (
                  <div key={slot.hour} className="flex-1 min-w-[28px] flex flex-col items-center gap-1.5 h-full justify-end group">
                    <div className="text-[10px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {slot.trips} trips ({slot.loadPercentage}%)
                    </div>
                    <div
                      className={`w-full rounded-t-lg transition-all group-hover:brightness-110 ${
                        isPeak
                          ? 'bg-gradient-to-t from-rose-500 to-amber-400'
                          : 'bg-gradient-to-t from-blue-600 to-sky-400'
                      }`}
                      style={{ height: `${slot.loadPercentage}%` }}
                    ></div>
                    <span className="text-[10px] font-semibold text-slate-400 mt-1">{slot.hour}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Route Performance & Delay Trends Table */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm mb-4">
              Corridor Performance, Punctuality &amp; Daily Ridership
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3 rounded-l-xl">Route Name</th>
                    <th className="p-3">Active Buses</th>
                    <th className="p-3">On-Time Punctuality</th>
                    <th className="p-3">Average Delay</th>
                    <th className="p-3">Daily Ridership</th>
                    <th className="p-3 rounded-r-xl">Demand Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {analytics.routePerformance.map((item) => (
                    <tr key={item.routeId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{item.routeName}</td>
                      <td className="p-3 font-mono">{item.activeBuses} vehicles</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${item.onTimeRate}%` }}
                            ></div>
                          </div>
                          <span className="font-bold text-emerald-600">{item.onTimeRate}%</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={item.avgDelay > 3 ? 'text-rose-500 font-bold' : 'text-slate-600 dark:text-slate-300'}>
                          +{item.avgDelay} mins
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                        {item.dailyPassengers.toLocaleString()} passengers
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          {item.dailyPassengers > 3500 ? 'High Demand' : 'Normal Headway'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. USER ACCESS & RBAC TAB */}
      {activeAdminTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                User Management &amp; Role-Based Access Control (RBAC)
              </h3>
              <p className="text-xs text-slate-500">
                Grant or revoke privileges for Passengers, Mobile Drivers, Dispatchers, and Transit Admins.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-3 rounded-l-xl">User Name</th>
                  <th className="p-3">Email Address</th>
                  <th className="p-3">Assigned Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Last Active</th>
                  <th className="p-3 rounded-r-xl text-right">Modify Permission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{u.name}</td>
                    <td className="p-3 text-slate-500 font-mono text-[11px]">{u.email}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-emerald-500 font-bold text-xs">● {u.status}</span>
                    </td>
                    <td className="p-3 text-slate-400 text-[11px]">{u.lastActive}</td>
                    <td className="p-3 text-right">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                        className="p-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold"
                      >
                        <option value="passenger">Passenger</option>
                        <option value="driver">Driver</option>
                        <option value="operator">Operator / Dispatcher</option>
                        <option value="admin">System Administrator</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. DRIVERS PERFORMANCE TAB */}
      {activeAdminTab === 'drivers' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm mb-4">
            Driver Safety, Punctuality &amp; Shift Compliance
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'Rajesh Kumar (DR-104)', bus: 'Bus 05-A', route: 'Route 05', trips: 142, rating: 4.9, punctuality: '96.2%', safety: 'Zero Infractions' },
              { name: 'Sarah Jenkins (DR-208)', bus: 'Bus 05-B', route: 'Route 05', trips: 128, rating: 4.8, punctuality: '93.5%', safety: 'Zero Infractions' },
              { name: 'Marcus Vance (DR-315)', bus: 'Bus 07-Express', route: 'Route 07', trips: 160, rating: 5.0, punctuality: '98.1%', safety: 'Exemplary' },
              { name: 'Elena Gomez (DR-422)', bus: 'Bus 12-Airport', route: 'Route 12', trips: 135, rating: 4.9, punctuality: '95.8%', safety: 'Zero Infractions' },
            ].map((driver, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100 block">{driver.name}</span>
                    <span className="text-slate-500 text-[11px]">Assigned: {driver.bus} • {driver.route}</span>
                  </div>
                  <span className="text-amber-500 font-extrabold text-sm flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{driver.rating}</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Total Trips</span>
                    <b className="font-mono">{driver.trips}</b>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Punctuality</span>
                    <b className="text-emerald-500">{driver.punctuality}</b>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Safety Audit</span>
                    <b className="text-blue-500 text-[11px]">{driver.safety}</b>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
