import React, { useState } from 'react';
import { Bus, TransitRoute, ServiceAlert, BusStatus, BusStop } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { TransitMap } from '../Map/TransitMap';
import {
  Layers,
  Radio,
  Bus as BusIcon,
  Route as RouteIcon,
  Bell,
  Megaphone,
  MessageSquare,
  Users,
  User,
  AlertCircle,
  AlertOctagon,
  CloudRain,
  Clock,
  Smartphone,
  Send,
  Building2,
  Check,
  ArrowRight,
  Edit3,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';

interface DispatcherAppProps {
  buses: Bus[];
  routes: TransitRoute[];
  alerts: ServiceAlert[];
  selectedBusId: string;
  selectedRouteId: string;
  onUpdateBus: (bus: Bus) => void;
  onAddAlert: (alert: ServiceAlert) => void;
  onDeleteAlert: (alertId: string) => void;
  onSelectBus: (busId: string) => void;
}

export interface QueueTextMessage {
  id: string;
  timestamp: string;
  recipientGroup: string;
  message: string;
  priority: 'normal' | 'urgent' | 'terminal';
  status: 'delivered' | 'broadcasting';
}

export const DispatcherApp: React.FC<DispatcherAppProps> = ({
  buses,
  routes,
  alerts,
  selectedBusId,
  selectedRouteId,
  onUpdateBus,
  onAddAlert,
  onDeleteAlert,
  onSelectBus,
}) => {
  const { showNotification, speakAnnouncement } = useAuth();

  // Navigation tab: 'queues' is default or 'radar'
  const [activeTab, setActiveTab] = useState<'queues' | 'radar' | 'buses' | 'routes' | 'announcements'>('queues');

  // Control Room Filter
  const [filterStatus, setFilterStatus] = useState<'all' | 'delayed' | 'on_route'>('all');
  const [alertHeadline, setAlertHeadline] = useState('');
  const [alertBody, setAlertBody] = useState('');
  const [alertSeverity, setAlertSeverity] = useState<'info' | 'warning' | 'emergency'>('warning');
  const [alertRoute, setAlertRoute] = useState('');

  // Local state for routes & stop closures
  const [localRoutes, setLocalRoutes] = useState<TransitRoute[]>(routes);
  const [closedStopIds, setClosedStopIds] = useState<string[]>([]);

  // Driver Assignment State
  const [editingBusId, setEditingBusId] = useState<string | null>(null);
  const [assignedDriverName, setAssignedDriverName] = useState<string>('');
  const [assignedRouteId, setAssignedRouteId] = useState<string>('');

  // -------------------------------------------------------------------------
  // DISPATCH QUEUES & SEND QUEUES TEXT STATE
  // -------------------------------------------------------------------------
  const [queueTargetGroup, setQueueTargetGroup] = useState<string>('All Queued Passengers & Buses');
  const [queueCustomMessage, setQueueCustomMessage] = useState<string>('');
  const [queueMessagePriority, setQueueMessagePriority] = useState<'normal' | 'urgent' | 'terminal'>('normal');
  const [queueHistory, setQueueHistory] = useState<QueueTextMessage[]>([
    {
      id: 'qmsg-101',
      timestamp: '08:18 AM',
      recipientGroup: 'Terminal Bay 1 Queue (Bus 05-A)',
      message: 'Bus 05-A is now staged at Bay 1. Passenger boarding queue is cleared for boarding.',
      priority: 'terminal',
      status: 'delivered',
    },
    {
      id: 'qmsg-102',
      timestamp: '08:05 AM',
      recipientGroup: 'Route 07 Corridor Queues',
      message: 'Traffic headway notice: Market St corridor experiencing heavy volume. All line buses spacing at 10m intervals.',
      priority: 'normal',
      status: 'delivered',
    },
    {
      id: 'qmsg-103',
      timestamp: '07:45 AM',
      recipientGroup: 'Central Transit Hub Platform Queue',
      message: 'Morning commuter surge detected. Relief bus 05-B deployed to clear stop waiting queue.',
      priority: 'urgent',
      status: 'delivered',
    },
  ]);

  // Terminal Bay Departure Queues local state
  const [terminalBays, setTerminalBays] = useState([
    { bayNumber: 'Bay 1', busNumber: 'Bus 05-A', routeName: 'Route 05 (Metro Hub → University)', scheduledDeparture: 'In 3 mins', status: 'Boarding Queue', waitingPax: 48, busId: 'bus-05-a' },
    { bayNumber: 'Bay 2', busNumber: 'Bus 07-Express', routeName: 'Route 07 (Central Station → Tech Park)', scheduledDeparture: 'In 6 mins', status: 'Platform Staged', waitingPax: 32, busId: 'bus-07-express' },
    { bayNumber: 'Bay 3', busNumber: 'Bus 12-Airport', routeName: 'Route 12 (Maritime → Airport)', scheduledDeparture: 'In 11 mins', status: 'Pre-Trip Inspection', waitingPax: 21, busId: 'bus-12-airport' },
    { bayNumber: 'Bay 4', busNumber: 'Bus 03-Downtown', routeName: 'Route 03 (Civic Loop)', scheduledDeparture: 'In 18 mins', status: 'Depot Staging', waitingPax: 14, busId: 'bus-03-loop' },
    { bayNumber: 'Bay 5', busNumber: 'Bus 05-B Reliever', routeName: 'Route 05 Relief Express', scheduledDeparture: 'On Standby', status: 'Standby Overflow', waitingPax: 0, busId: 'bus-05-b' },
  ]);

  const activeBuses = buses.filter((b) => b.status === 'On Route');
  const delayedBuses = buses.filter((b) => b.status === 'Delayed' || b.currentDelay >= 4);
  const idleBuses = buses.filter((b) => b.status === 'Available');

  const filteredBuses = buses.filter((b) => {
    if (filterStatus === 'delayed') return b.status === 'Delayed' || b.currentDelay >= 4;
    if (filterStatus === 'on_route') return b.status === 'On Route';
    return true;
  });

  const handleSendQueueText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = queueCustomMessage.trim();
    if (!textToSend) {
      showNotification('Please enter a message or select a queue preset.');
      return;
    }

    const newMsg: QueueTextMessage = {
      id: 'qmsg-' + Date.now(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      recipientGroup: queueTargetGroup,
      message: textToSend,
      priority: queueMessagePriority,
      status: 'delivered',
    };

    setQueueHistory((prev) => [newMsg, ...prev]);

    // Also push real service alert to Firestore
    try {
      const newAlert: ServiceAlert = {
        alertId: 'alert-q-' + Date.now(),
        title: `Dispatch Queue Broadcast: ${queueTargetGroup}`,
        message: textToSend,
        severity: queueMessagePriority === 'urgent' ? 'warning' : 'info',
        createdAt: new Date().toISOString(),
        active: true,
      };
      onAddAlert(newAlert);
      showNotification(`Queue text broadcast transmitted to ${queueTargetGroup}!`);
      speakAnnouncement(`Dispatch Queue Alert: ${textToSend}`);
      setQueueCustomMessage('');
    } catch {
      showNotification('Queue text recorded.');
    }
  };

  const handleClearBusDeparture = async (bayIdx: number, busId: string) => {
    try {
      const targetBus = buses.find((b) => b.busId === busId);
      if (targetBus) {
        onUpdateBus({ ...targetBus, status: 'On Route' });
      }

      setTerminalBays((prev) =>
        prev.map((bay, i) => (i === bayIdx ? { ...bay, status: 'Departed (En Route)', scheduledDeparture: 'En Route' } : bay))
      );

      const msgText = `${terminalBays[bayIdx].busNumber} has departed from ${terminalBays[bayIdx].bayNumber}. Next terminal bus will arrive in 8 mins.`;
      const queueMsg: QueueTextMessage = {
        id: 'qmsg-' + Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        recipientGroup: terminalBays[bayIdx].routeName,
        message: msgText,
        priority: 'terminal',
        status: 'delivered',
      };

      setQueueHistory((prev) => [queueMsg, ...prev]);
      showNotification(`${terminalBays[bayIdx].busNumber} cleared for corridor departure!`);
      speakAnnouncement(`Clearance: ${terminalBays[bayIdx].busNumber} departed ${terminalBays[bayIdx].bayNumber}.`);
    } catch {
      showNotification('Departure clearance logged.');
    }
  };

  const handleDispatchReliefBus = (stopName: string) => {
    const textMsg = `Relief bus dispatched to clear passenger waiting queue at ${stopName}. Estimated arrival in 4 minutes.`;
    const newMsg: QueueTextMessage = {
      id: 'qmsg-' + Date.now(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      recipientGroup: `${stopName} Platform Queue`,
      message: textMsg,
      priority: 'urgent',
      status: 'delivered',
    };

    setQueueHistory((prev) => [newMsg, ...prev]);
    showNotification(`Relief unit dispatched to ${stopName} waiting queue!`);
    speakAnnouncement(`Relief Dispatch: Extra capacity unit deployed to ${stopName}.`);
  };

  const handlePublishBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertHeadline.trim() || !alertBody.trim()) {
      showNotification('Please enter headline and message text');
      return;
    }

    try {
      const route = routes.find((r) => r.routeId === alertRoute);
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: alertHeadline,
          message: alertBody,
          severity: alertSeverity,
          affectedRouteId: alertRoute || undefined,
          affectedRouteName: route?.routeName || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.alert) {
        onAddAlert(data.alert);
        setAlertHeadline('');
        setAlertBody('');
        showNotification('Emergency transit advisory pushed to all passenger devices!');
        speakAnnouncement(`Dispatcher Bulletin: ${alertHeadline}. ${alertBody}`);
      }
    } catch {
      showNotification('Broadcast recorded');
    }
  };

  const handleStatusChange = async (busId: string, status: BusStatus) => {
    try {
      const res = await fetch(`/api/buses/${busId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success && data.bus) {
        onUpdateBus(data.bus);
        showNotification(`Bus ${data.bus.busNumber} status updated to ${status}`);
      }
    } catch {
      const bus = buses.find((b) => b.busId === busId);
      if (bus) {
        onUpdateBus({ ...bus, status });
        showNotification(`Updated status to ${status}`);
      }
    }
  };

  const handleSaveDriverAssignment = (busId: string) => {
    const bus = buses.find((b) => b.busId === busId);
    if (!bus) return;

    const updatedBus: Bus = {
      ...bus,
      driverName: assignedDriverName || bus.driverName,
      routeId: assignedRouteId || bus.routeId,
    };

    onUpdateBus(updatedBus);
    setEditingBusId(null);
    showNotification(`Assigned ${assignedDriverName} to ${bus.busNumber} on route ${assignedRouteId}`);
  };

  const handleToggleStopClosure = (routeId: string, stopId: string) => {
    const isClosed = closedStopIds.includes(stopId);
    const updated = isClosed ? closedStopIds.filter((id) => id !== stopId) : [...closedStopIds, stopId];
    setClosedStopIds(updated);

    const route = localRoutes.find((r) => r.routeId === routeId);
    const stop = route?.stops.find((s) => s.stopId === stopId);

    if (!isClosed) {
      const alert: ServiceAlert = {
        alertId: 'closure-' + Date.now(),
        title: `Stop Temporarily Unavailable`,
        message: `${stop?.stopName || 'Stop'} on ${route?.routeName || 'route'} is temporarily closed due to roadway maintenance. Please use adjacent stops.`,
        severity: 'warning',
        affectedRouteId: routeId,
        affectedStopId: stopId,
        createdAt: new Date().toISOString(),
        active: true,
      };
      onAddAlert(alert);
      showNotification(`Stop closed. Public advisory published to passengers!`);
      speakAnnouncement(`Advisory: ${stop?.stopName} is temporarily closed.`);
    } else {
      showNotification(`Stop reopened for transit service.`);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8 overflow-y-auto transition-colors">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Tactical Command Header & Telemetry Badges */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 animate-pulse"></span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                TRANSPORT OPERATOR / DISPATCHER COMMAND
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live fleet radar, terminal departure queues, broadcast text communications &amp; stop crowding controls
            </p>
          </div>

          {/* Telemetry Summary Counters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3 py-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
              <span className="text-slate-400 text-[10px] uppercase block">Total Fleet</span>
              <b className="text-slate-900 dark:text-white text-sm font-black">{buses.length} Units</b>
            </div>
            <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-xs">
              <span className="text-emerald-700 dark:text-emerald-400 text-[10px] uppercase block">Active Buses</span>
              <b className="text-emerald-900 dark:text-emerald-300 text-sm font-black">{activeBuses.length} Live</b>
            </div>
            <div className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800/60 text-xs">
              <span className="text-rose-700 dark:text-rose-400 text-[10px] uppercase block">Delayed Buses</span>
              <b className="text-rose-900 dark:text-rose-300 text-sm font-black">{delayedBuses.length} Warning</b>
            </div>
            <div className="px-3 py-1.5 bg-teal-50 dark:bg-cyan-950/40 rounded-xl border border-teal-200 dark:border-cyan-800/60 text-xs">
              <span className="text-teal-700 dark:text-cyan-400 text-[10px] uppercase block">Standby</span>
              <b className="text-teal-900 dark:text-cyan-300 text-sm font-black">{idleBuses.length} Ready</b>
            </div>
          </div>
        </div>

        {/* Role Functionality Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto text-xs">
          {[
            { id: 'queues', Icon: Layers, label: '1. Dispatch Queues & Broadcast Text' },
            { id: 'radar', Icon: Radio, label: '2. Monitor Active & Delayed Buses' },
            { id: 'buses', Icon: BusIcon, label: '3. Manage Buses & Assign Drivers' },
            { id: 'routes', Icon: RouteIcon, label: '4. Manage Routes, Stops & Schedules' },
            { id: 'announcements', Icon: Megaphone, label: `5. Service Alerts (${alerts.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === t.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <t.Icon className="w-4 h-4 shrink-0" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ========================================================================= */}
        {/* TAB 0: DISPATCH QUEUES & SEND QUEUES TEXT BROADCAST (CORE USER REQUEST)    */}
        {/* ========================================================================= */}
        {activeTab === 'queues' && (
          <div className="space-y-6">
            {/* Top Queue Telemetry Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
                <span className="text-[10px] text-slate-400 uppercase font-black block">Queued at Terminal</span>
                <span className="text-3xl font-black text-cyan-400 mt-1 block">5 Buses</span>
                <span className="text-xs text-slate-400 mt-0.5 block">Bays 1-5 Staging Headway</span>
              </div>
              <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
                <span className="text-[10px] text-slate-400 uppercase font-black block">Avg Passenger Wait</span>
                <span className="text-3xl font-black text-emerald-400 mt-1 block">4.2 mins</span>
                <span className="text-xs text-emerald-400/80 mt-0.5 block">Within 6m SLA target</span>
              </div>
              <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
                <span className="text-[10px] text-slate-400 uppercase font-black block">High Crowd Queues</span>
                <span className="text-3xl font-black text-amber-400 mt-1 block">2 Stops</span>
                <span className="text-xs text-amber-400/80 mt-0.5 block">Central Hub &amp; University</span>
              </div>
              <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
                <span className="text-[10px] text-slate-400 uppercase font-black block">Transmitted Queue Texts</span>
                <span className="text-3xl font-black text-white mt-1 block">{queueHistory.length}</span>
                <span className="text-xs text-cyan-400 mt-0.5 block">Live push &amp; audio alerts</span>
              </div>
            </div>

            {/* MAIN COMPOSER: SEND QUEUES TEXT & PUSH BROADCAST */}
            <div className="p-6 bg-slate-900 rounded-3xl border border-cyan-500/30 shadow-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-cyan-400" />
                    <span>Send Queues Text &amp; Push Broadcast</span>
                    <span className="text-[9px] font-black uppercase bg-cyan-400/20 text-cyan-300 border border-cyan-400/30 px-2 py-0.5 rounded-full">
                      Real-time Dispatcher Radio
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Transmit instant queue clearance instructions, terminal boarding notices, and delay text updates to waiting passengers and bus drivers.
                  </p>
                </div>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded-xl border border-emerald-800/40 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>Terminal Radio Connected</span>
                </span>
              </div>

              {/* Target Selector & Quick Presets */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                      Recipient Target Group
                    </label>
                    <select
                      value={queueTargetGroup}
                      onChange={(e) => setQueueTargetGroup(e.target.value)}
                      className="w-full p-2.5 bg-slate-950 rounded-xl border border-slate-700 text-white font-semibold focus:outline-none focus:border-cyan-400"
                    >
                      <option value="All Queued Passengers & Buses">All Queued Passengers &amp; Buses (System-wide)</option>
                      <option value="Terminal Bay 1 Queue (Bus 05-A)">Terminal Bay 1 Queue (Route 05: Metro Hub → University)</option>
                      <option value="Terminal Bay 2 Queue (Bus 07-Express)">Terminal Bay 2 Queue (Route 07: Central Station → Tech Park)</option>
                      <option value="Central Transit Hub Passenger Platform Queue">Central Transit Hub Passenger Platform Queue</option>
                      <option value="University Campus Gate Waiting Queue">University Campus Gate Waiting Queue</option>
                      <option value="Silicon Tech Park Commuter Queue">Silicon Tech Park Commuter Queue</option>
                      <option value="All Active Bus Drivers En Route">All Active Bus Drivers on Shift</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                      Broadcast Priority Tier
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'normal', Icon: Info, label: 'Normal Notice', color: 'bg-slate-950 border-slate-700 text-slate-300' },
                        { id: 'terminal', Icon: BusIcon, label: 'Bay Clearance', color: 'bg-cyan-950/40 border-cyan-700 text-cyan-300' },
                        { id: 'urgent', Icon: AlertOctagon, label: 'Urgent Delay', color: 'bg-rose-950/40 border-rose-700 text-rose-300' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setQueueMessagePriority(p.id as any)}
                          className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all ${
                            queueMessagePriority === p.id
                              ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                              : `${p.color} hover:border-slate-500`
                          }`}
                        >
                          <p.Icon className="w-3.5 h-3.5" />
                          <span>{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 1-Tap Queue Text Presets */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                    1-Tap Queue Text Presets (Click to Populate):
                  </span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {[
                      {
                        title: 'Bay 1 Ready',
                        text: 'Bus 05-A queued at Bay 1 ready for boarding. Departure cleared in 3 minutes.',
                        priority: 'terminal',
                      },
                      {
                        title: 'Corridor Headway Delay',
                        text: 'Route 07 queue delay: +8 min traffic headway adjustment. Relief bus en route.',
                        priority: 'urgent',
                      },
                      {
                        title: 'Platform Crowd Relief',
                        text: 'Central Transit Hub platform queue is full. Extra boarding express bus dispatched.',
                        priority: 'urgent',
                      },
                      {
                        title: 'Bay Reroute Notice',
                        text: 'Terminal Bay 2 maintenance: Route 07 boarding queue moved to temporary Bay 3.',
                        priority: 'terminal',
                      },
                      {
                        title: 'Weather Safety Speed',
                        text: 'Advisory: Coastal rain corridor active. All buses operating with 10-minute headway buffer.',
                        priority: 'normal',
                      },
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setQueueCustomMessage(preset.text);
                          setQueueMessagePriority(preset.priority as any);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-semibold transition-all"
                      >
                        {preset.title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text Area & Transmit Button */}
                <div className="space-y-2 pt-1">
                  <div className="relative">
                    <textarea
                      rows={3}
                      value={queueCustomMessage}
                      onChange={(e) => setQueueCustomMessage(e.target.value)}
                      placeholder="Type custom queue text, boarding clearance instructions, or delay notification to transmit to passenger screens & buses..."
                      className="w-full p-3 bg-slate-950 rounded-2xl border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 font-sans"
                    />
                    <span className="absolute bottom-2.5 right-3 text-[10px] font-mono text-slate-500">
                      {queueCustomMessage.length} chars
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    {/* Live Mobile Device Preview */}
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Smartphone className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>Live Screen Preview:</span>
                      <span className="italic text-slate-300 font-medium truncate max-w-xs sm:max-w-md">
                        {queueCustomMessage ? `"${queueCustomMessage}"` : '(Type message to preview notification...)'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSendQueueText()}
                      disabled={!queueCustomMessage.trim()}
                      className={`w-full sm:w-auto px-6 py-3 rounded-2xl text-xs font-black shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        queueCustomMessage.trim()
                          ? 'bg-gradient-to-r from-cyan-500 to-lime-400 hover:from-cyan-400 hover:to-lime-300 text-slate-950 active:scale-98 shadow-cyan-500/25'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      }`}
                    >
                      <Send className="w-4 h-4" />
                      <span>TRANSMIT QUEUE BROADCAST TEXT</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* TERMINAL BAY DEPARTURE QUEUES & CROWD BOTTLENECK MONITOR */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left (7 cols): Terminal Departure Bay Queues */}
              <div className="lg:col-span-7 p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-sm text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-cyan-400" />
                    <span>Terminal Platform Departure Queues</span>
                    <span className="text-[10px] bg-slate-800 text-cyan-400 px-2 py-0.5 rounded-full font-mono">
                      Bays 1-5
                    </span>
                  </h4>
                  <span className="text-[11px] text-slate-400">Central Metro Concourse</span>
                </div>

                <div className="space-y-3 text-xs">
                  {terminalBays.map((bay, idx) => (
                    <div
                      key={bay.bayNumber}
                      className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-700 text-cyan-300 flex items-center justify-center font-black text-xs">
                            {bay.bayNumber.replace('Bay ', 'B')}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <b className="text-white text-xs">{bay.busNumber}</b>
                              <span className="text-[10px] font-mono text-slate-400">
                                {bay.scheduledDeparture}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 block">
                              {bay.routeName}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1">
                          <span>
                            Queue Crowding: <strong className="text-amber-400">{bay.waitingPax} passengers</strong>
                          </span>
                          <span>·</span>
                          <span>
                            Status: <strong className="text-cyan-400">{bay.status}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {bay.status.includes('Departed') ? (
                          <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 font-bold text-xs">
                            <Check className="w-3.5 h-3.5" />
                            <span>Cleared En Route</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleClearBusDeparture(idx, bay.busId)}
                            className="px-3 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                          >
                            <span>Clear for Departure</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right (5 cols): Stop Waiting Queues & Crowd Bottlenecks */}
              <div className="lg:col-span-5 p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-sm text-white flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 text-rose-400" />
                    <span>Stop Passenger Wait Queues</span>
                  </h4>
                  <span className="text-[10px] text-rose-400 font-bold bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-800/40">
                    Live Crowd Sensors
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  {[
                    { stop: 'Central Transit Hub', count: 84, crowd: 'High Surge', route: 'Line 05', color: 'rose' },
                    { stop: 'University Campus Gate', count: 62, crowd: 'Moderate Surge', route: 'Line 05', color: 'amber' },
                    { stop: 'Silicon Tech Park West', count: 45, crowd: 'Moderate', route: 'Line 07', color: 'amber' },
                    { stop: 'Main Market Square', count: 28, crowd: 'Optimal Flow', route: 'Line 05', color: 'emerald' },
                  ].map((s, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <b className="text-white text-xs">{s.stop}</b>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            s.color === 'rose'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : s.color === 'amber'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {s.crowd}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Waiting Queue: <strong className="text-white">{s.count} pax</strong></span>
                        <button
                          onClick={() => handleDispatchReliefBus(s.stop)}
                          className="text-cyan-400 hover:text-cyan-300 font-bold hover:underline"
                        >
                          + Dispatch Relief Bus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Sent Queue Message History */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Recently Transmitted Queue Texts:
                  </span>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {queueHistory.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <b className="text-cyan-300">{item.recipientGroup}</b>
                          <span className="text-slate-500 font-mono">{item.timestamp}</span>
                        </div>
                        <p className="text-slate-200">{item.message}</p>
                        <div className="text-[9px] text-emerald-400 font-mono flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>Transmitted &amp; Synced to Passenger Screens</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: RADAR & MONITOR ACTIVE BUSES / DELAYED BUSES */}
        {activeTab === 'radar' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Tactical Map Radar */}
            <div className="lg:col-span-7 h-[550px] lg:h-[700px] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative">
              <TransitMap
                buses={buses}
                routes={localRoutes}
                selectedRouteId={selectedRouteId}
                selectedBusId={selectedBusId}
                onSelectBus={(bus) => onSelectBus(bus.busId)}
              />
            </div>

            {/* Right: Fleet Telemetry & Delay Filter */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-white">
                    Monitor Buses ({filteredBuses.length})
                  </h3>

                  {/* Status Filter Buttons */}
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl text-[11px]">
                    <button
                      onClick={() => setFilterStatus('all')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        filterStatus === 'all' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'
                      }`}
                    >
                      All ({buses.length})
                    </button>
                    <button
                      onClick={() => setFilterStatus('on_route')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        filterStatus === 'on_route' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
                      }`}
                    >
                      Live ({activeBuses.length})
                    </button>
                    <button
                      onClick={() => setFilterStatus('delayed')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        filterStatus === 'delayed' ? 'bg-rose-500 text-slate-950' : 'text-slate-400'
                      }`}
                    >
                      Delayed ({delayedBuses.length})
                    </button>
                  </div>
                </div>

                {/* Buses List */}
                <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                  {filteredBuses.map((bus) => {
                    const isDelayed = bus.status === 'Delayed' || bus.currentDelay >= 4;
                    const route = routes.find((r) => r.routeId === bus.routeId);

                    return (
                      <div
                        key={bus.busId}
                        onClick={() => onSelectBus(bus.busId)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                          selectedBusId === bus.busId
                            ? 'bg-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/10'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-white text-sm">{bus.busNumber}</span>
                            <span className="text-[10px] font-mono text-cyan-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              {bus.vehicleNumber}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isDelayed && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                +{bus.currentDelay}m DELAY
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                bus.status === 'On Route'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : bus.status === 'Available'
                                  ? 'bg-cyan-500/20 text-cyan-300'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {bus.status}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs text-slate-300 space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">Assigned Corridor:</span>
                            <b className="text-white">{route?.routeName || bus.routeId}</b>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">Driver:</span>
                            <span className="text-white font-medium">{bus.driverName}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">Speed &amp; Heading:</span>
                            <span className="font-mono text-emerald-400">
                              {bus.currentSpeed} km/h • {bus.heading}°
                            </span>
                          </div>
                        </div>

                        {/* Dispatcher Manual Override Controls */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1 text-[10px]">
                          <span className="text-slate-400 font-bold uppercase">Status Override:</span>
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(bus.busId, 'On Route');
                              }}
                              className={`px-2 py-1 rounded font-bold transition-all ${
                                bus.status === 'On Route'
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-slate-900 text-slate-400 hover:text-white'
                              }`}
                            >
                              On Route
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(bus.busId, 'Delayed');
                              }}
                              className={`px-2 py-1 rounded font-bold transition-all ${
                                bus.status === 'Delayed'
                                  ? 'bg-rose-500 text-slate-950'
                                  : 'bg-slate-900 text-slate-400 hover:text-white'
                              }`}
                            >
                              Delayed
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(bus.busId, 'Break');
                              }}
                              className={`px-2 py-1 rounded font-bold transition-all ${
                                bus.status === 'Break'
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-slate-900 text-slate-400 hover:text-white'
                              }`}
                            >
                              Break
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MANAGE BUSES & ASSIGN DRIVERS */}
        {activeTab === 'buses' && (
          <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-black text-white">Fleet Asset Management &amp; Driver Rosters</h3>
              <p className="text-xs text-slate-400">Configure vehicle metadata and pair certified commercial operators</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {buses.map((bus) => (
                <div key={bus.busId} className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-black text-white text-sm">{bus.busNumber}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">{bus.vehicleNumber}</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        bus.status === 'On Route' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {bus.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-slate-300 text-[11px]">
                    <div>Capacity: <b className="text-white">{bus.capacity} seats</b></div>
                    <div>Current Driver: <b className="text-cyan-400">{bus.driverName}</b></div>
                    <div>Assigned Corridor: <b className="text-white">{bus.routeId}</b></div>
                  </div>

                  {editingBusId === bus.busId ? (
                    <div className="pt-3 border-t border-slate-800 space-y-2">
                      <input
                        type="text"
                        placeholder="Driver Name (e.g. Officer R. Kumar)"
                        value={assignedDriverName}
                        onChange={(e) => setAssignedDriverName(e.target.value)}
                        className="w-full p-2 bg-slate-900 rounded-lg border border-slate-700 text-white text-xs"
                      />
                      <select
                        value={assignedRouteId}
                        onChange={(e) => setAssignedRouteId(e.target.value)}
                        className="w-full p-2 bg-slate-900 rounded-lg border border-slate-700 text-white text-xs"
                      >
                        {routes.map((r) => (
                          <option key={r.routeId} value={r.routeId}>{r.routeName}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveDriverAssignment(bus.busId)}
                          className="flex-1 py-1.5 bg-cyan-500 text-slate-950 font-bold rounded-lg text-xs"
                        >
                          Save Assignment
                        </button>
                        <button
                          onClick={() => setEditingBusId(null)}
                          className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingBusId(bus.busId);
                        setAssignedDriverName(bus.driverName);
                        setAssignedRouteId(bus.routeId);
                      }}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-850 border border-slate-700 text-cyan-300 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Reassign Driver &amp; Route</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: MANAGE ROUTES, BUS STOPS & SCHEDULES */}
        {activeTab === 'routes' && (
          <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-black text-white">Transit Network Infrastructure &amp; Stop Closures</h3>
              <p className="text-xs text-slate-400">
                Manage bus stops, toggle temporary construction closures, and monitor passenger arrival headways
              </p>
            </div>

            <div className="space-y-6">
              {localRoutes.map((route) => (
                <div key={route.routeId} className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-4 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                    <div>
                      <h4 className="text-sm font-black text-white">{route.routeName}</h4>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <span>{route.startLocation}</span>
                        <ArrowRight className="w-3 h-3 text-slate-500 inline" />
                        <span>{route.destination}</span>
                        <span>· Fare: ${route.fare.toFixed(2)} · Headway: {route.frequencyMinutes || 10}m</span>
                      </span>
                    </div>
                    <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded-xl border border-cyan-800/40">
                      {route.stops.length} Sequenced Stops
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {route.stops.map((stop) => {
                      const isClosed = closedStopIds.includes(stop.stopId);
                      return (
                        <div
                          key={stop.stopId}
                          className={`p-3 rounded-xl border transition-all ${
                            isClosed
                              ? 'bg-rose-950/20 border-rose-500/40'
                              : 'bg-slate-900 border-slate-800'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <b className="text-white text-xs block">{stop.stopName}</b>
                              <span className="text-[10px] text-slate-500 font-mono">Order #{stop.stopOrder}</span>
                            </div>
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                isClosed ? 'bg-rose-500 text-white' : 'bg-emerald-500/20 text-emerald-300'
                              }`}
                            >
                              {isClosed ? 'Closed' : 'Active'}
                            </span>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">
                              {isClosed ? 'Traffic Detour Active' : 'Normal Headway'}
                            </span>
                            <button
                              onClick={() => handleToggleStopClosure(route.routeId, stop.stopId)}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${
                                isClosed
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white'
                              }`}
                            >
                              {isClosed ? 'Reopen Stop' : 'Close Stop'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: PUBLISH SERVICE ANNOUNCEMENTS */}
        {activeTab === 'announcements' && (
          <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-black text-white">Public Service Announcements &amp; Disruption Bulletins</h3>
              <p className="text-xs text-slate-400">
                Push live notifications and voice announcements to passenger tracking screens across affected corridors
              </p>
            </div>

            <form onSubmit={handlePublishBroadcast} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Bulletin Headline</label>
                  <input
                    type="text"
                    required
                    value={alertHeadline}
                    onChange={(e) => setAlertHeadline(e.target.value)}
                    placeholder="e.g. Route 05 Delay Due to Market St Congestion"
                    className="w-full p-2.5 bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Severity Level</label>
                  <select
                    value={alertSeverity}
                    onChange={(e) => setAlertSeverity(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-950 rounded-xl border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="info">Informational (Minor)</option>
                    <option value="warning">Service Delay / Detour (Moderate)</option>
                    <option value="emergency">Emergency Disruption / Roadblock</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Target Corridor</label>
                  <select
                    value={alertRoute}
                    onChange={(e) => setAlertRoute(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 rounded-xl border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="">All Corridors (System-wide)</option>
                    {routes.map((r) => (
                      <option key={r.routeId} value={r.routeId}>{r.routeName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Detailed Passenger Bulletin</label>
                <textarea
                  required
                  value={alertBody}
                  onChange={(e) => setAlertBody(e.target.value)}
                  rows={3}
                  placeholder="Provide precise details for passengers: affected stops, recommended transfers, or estimated delay duration..."
                  className="w-full p-3 bg-slate-950 rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Radio className="w-4 h-4" />
                <span>BROADCAST TO ALL PASSENGER SCREENS &amp; AUDIO VOICE</span>
              </button>
            </form>

            {/* Currently Active Bulletins List */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h4 className="text-xs font-black uppercase text-slate-300">Live Active Announcements ({alerts.length})</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {alerts.map((alt) => (
                  <div key={alt.alertId} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {alt.severity === 'emergency' ? (
                          <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                        ) : alt.severity === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                        )}
                        <b className="text-white text-xs">{alt.title}</b>
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed">{alt.message}</p>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        Published: {new Date(alt.createdAt || (alt as any).timestamp || Date.now()).toLocaleTimeString()}
                      </span>
                    </div>

                    <button
                      onClick={() => onDeleteAlert(alt.alertId)}
                      className="text-slate-400 hover:text-rose-400 text-xs font-bold p-1 hover:bg-slate-850 rounded flex items-center gap-1"
                      title="Dismiss announcement"
                    >
                      <span>Dismiss</span>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
