/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppSwitcher } from './components/inDrive/AppSwitcher';
import { PassengerApp } from './components/inDrive/PassengerApp';
import { DriverApp } from './components/inDrive/DriverApp';
import { DispatcherApp } from './components/inDrive/DispatcherApp';
import { AdminApp } from './components/inDrive/AdminApp';
import { AuthModal } from './components/Auth/AuthModal';
import { AuthGate } from './components/Auth/AuthGate';
import { LandingPage } from './components/Landing/LandingPage';
import { INITIAL_ROUTES, INITIAL_BUSES, INITIAL_ALERTS, INITIAL_ANALYTICS } from './services/transitData';
import {
  initializeFirestoreTransitData,
  subscribeToBuses,
  subscribeToRoutes,
  subscribeToAlerts,
  updateBusLocationInFirestore,
  updateBusStatusInFirestore,
  publishAlertInFirestore,
  dismissAlertInFirestore,
} from './services/firestoreService';
import { Bus, TransitRoute, ServiceAlert, AnalyticsSummary, BusStop } from './types';
import { Bell, Volume2, VolumeX } from 'lucide-react';

function MainApp() {
  const {
    role,
    setRole,
    switchRoleWithAuth,
    passengerSession,
    driverSession,
    adminSession,
    notification,
    authModalOpen,
    authModalTargetRole,
    closeAuthModal,
    voiceAnnouncementsEnabled,
    setVoiceAnnouncementsEnabled,
    speakAnnouncement,
  } = useAuth();

  const [routes, setRoutes] = useState<TransitRoute[]>(INITIAL_ROUTES);
  const [buses, setBuses] = useState<Bus[]>(INITIAL_BUSES);
  const [alerts, setAlerts] = useState<ServiceAlert[]>(INITIAL_ALERTS);
  const [analytics, setAnalytics] = useState<AnalyticsSummary>(INITIAL_ANALYTICS);

  const [selectedRouteId, setSelectedRouteId] = useState<string>('route-05');
  const [selectedBusId, setSelectedBusId] = useState<string>('bus-05-a');
  const [selectedStopId, setSelectedStopId] = useState<string>('stop-05-1');

  // 1. Initialize & attach REAL Firestore database listeners
  useEffect(() => {
    // Seed real Firestore documents if empty
    initializeFirestoreTransitData().catch(console.error);

    // Subscribe to real-time updates from Firestore
    const unsubBuses = subscribeToBuses((realBuses) => {
      if (realBuses.length > 0) {
        setBuses(realBuses);
        // Sync analytics counters
        setAnalytics((prev) => ({
          ...prev,
          totalBuses: realBuses.length,
          activeBuses: realBuses.filter((b) => b.status === 'On Route').length,
          delayedBuses: realBuses.filter((b) => b.status === 'Delayed' || b.currentDelay >= 4).length,
          offlineBuses: realBuses.filter((b) => b.status === 'Offline' || b.status === 'Break').length,
        }));
      }
    });

    const unsubRoutes = subscribeToRoutes((realRoutes) => {
      if (realRoutes.length > 0) {
        setRoutes(realRoutes);
      }
    });

    const unsubAlerts = subscribeToAlerts((realAlerts) => {
      setAlerts(realAlerts);
    });

    return () => {
      unsubBuses();
      unsubRoutes();
      unsubAlerts();
    };
  }, []);

  const handleSelectBus = (busId: string) => {
    setSelectedBusId(busId);
    const bus = buses.find((b) => b.busId === busId);
    if (bus && bus.routeId) setSelectedRouteId(bus.routeId);
  };

  const handleSelectRoute = (routeId: string) => {
    setSelectedRouteId(routeId);
    const bus = buses.find((b) => b.routeId === routeId && b.status !== 'Offline');
    if (bus) setSelectedBusId(bus.busId);
  };

  const handleSelectStop = (stop: BusStop, route: TransitRoute) => {
    setSelectedStopId(stop.stopId);
    setSelectedRouteId(route.routeId);
  };

  // Real Firestore Bus & Trip Update
  const handleTripBusUpdate = (updatedBus: Bus) => {
    setBuses((prev) => prev.map((b) => (b.busId === updatedBus.busId ? updatedBus : b)));
    updateBusLocationInFirestore(
      updatedBus.busId,
      updatedBus.currentLat,
      updatedBus.currentLng,
      updatedBus.currentSpeed,
      updatedBus.heading,
      updatedBus.currentDelay
    ).catch(console.error);
  };

  // Real Firestore Alert Publishing
  const handleAddAlert = (newAlert: ServiceAlert) => {
    setAlerts((prev) => [newAlert, ...prev]);
    publishAlertInFirestore(newAlert).catch(console.error);
  };

  // Real Firestore Alert Dismissal
  const handleDeleteAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.alertId !== alertId));
    dismissAlertInFirestore(alertId).catch(console.error);
    fetch(`/api/alerts/${alertId}`, { method: 'DELETE' }).catch(() => {});
  };

  // Real Firestore Bus Status change (Dispatcher override)
  const handleUpdateBusStatus = (bus: Bus) => {
    setBuses((prev) => prev.map((b) => (b.busId === bus.busId ? bus : b)));
    updateBusStatusInFirestore(bus.busId, bus.status).catch(console.error);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans select-none transition-colors">
      {/* 1. Dedicated inDrive Top App Switcher */}
      <AppSwitcher alerts={alerts} />

      {/* 2. COMPLETELY SEPARATE UI VIEWS (as in inDrive) */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* VIEW 0: DUAL-PERSONA LANDING PAGE FOR PASSENGERS & DRIVERS */}
        {role === 'landing' && (
          <LandingPage
            routes={routes}
            buses={buses}
            alerts={alerts}
            onLaunchPassenger={() => switchRoleWithAuth('passenger')}
            onLaunchDriver={() => switchRoleWithAuth('driver')}
            onLaunchDispatcher={() => switchRoleWithAuth('operator')}
            onLaunchAdmin={() => switchRoleWithAuth('admin')}
          />
        )}

        {/* VIEW 1: inDrive PASSENGER APP */}
        {role === 'passenger' && (
          !passengerSession ? (
            <AuthGate requiredRole="passenger" />
          ) : (
            <PassengerApp
              routes={routes}
              buses={buses}
              selectedRouteId={selectedRouteId}
              selectedBusId={selectedBusId}
              selectedStopId={selectedStopId}
              onSelectRoute={handleSelectRoute}
              onSelectBus={handleSelectBus}
              onSelectStop={handleSelectStop}
            />
          )
        )}

        {/* VIEW 2: inDrive DRIVER APP */}
        {role === 'driver' && (
          !driverSession ? (
            <AuthGate requiredRole="driver" />
          ) : (
            <DriverApp
              buses={buses}
              routes={routes}
              onTripUpdate={handleTripBusUpdate}
            />
          )
        )}

        {/* VIEW 3: DISPATCHER COMMAND CENTER */}
        {role === 'operator' && (
          !adminSession ? (
            <AuthGate requiredRole="operator" />
          ) : (
            <DispatcherApp
              buses={buses}
              routes={routes}
              alerts={alerts}
              selectedBusId={selectedBusId}
              selectedRouteId={selectedRouteId}
              onUpdateBus={handleUpdateBusStatus}
              onAddAlert={handleAddAlert}
              onDeleteAlert={handleDeleteAlert}
              onSelectBus={handleSelectBus}
            />
          )
        )}

        {/* VIEW 4: INTELLIGENCE & ADMIN SUITE */}
        {role === 'admin' && (
          !adminSession ? (
            <AuthGate requiredRole="admin" />
          ) : (
            <AdminApp
              analytics={analytics}
              routes={routes}
              buses={buses}
            />
          )
        )}
      </main>

      {/* Floating System Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-slate-900/95 text-white backdrop-blur-md rounded-2xl shadow-2xl border border-emerald-400/40 text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <Bell className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Floating Sound Toggle */}
      <button
        onClick={() => {
          const next = !voiceAnnouncementsEnabled;
          setVoiceAnnouncementsEnabled(next);
          if (next) speakAnnouncement('Voice audio active.');
        }}
        className={`fixed bottom-6 left-6 z-50 p-3 rounded-full shadow-lg border transition-all cursor-pointer ${
          voiceAnnouncementsEnabled
            ? 'bg-emerald-100 dark:bg-emerald-900 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
        }`}
        title="Toggle Audio Announcements"
      >
        {voiceAnnouncementsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
      </button>

      {/* Role-Specific Email/Password Authentication & Registration Dialog */}
      <AuthModal
        isOpen={authModalOpen}
        targetRole={authModalTargetRole}
        onClose={closeAuthModal}
        onSuccess={(target) => setRole(target)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
