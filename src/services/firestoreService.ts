import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  Bus,
  TransitRoute,
  ServiceAlert,
  ActiveTrip,
  TripIncident,
  DigitalTicket,
  UserProfile,
  UserRole,
  PassengerProfile,
  DriverProfile,
  AdminProfile,
} from '../types';
import { INITIAL_ROUTES, INITIAL_BUSES, INITIAL_ALERTS } from './transitData';

export const INITIAL_HISTORICAL_TRIPS: ActiveTrip[] = [
  {
    tripId: 'trip-2026-101',
    busId: 'bus-05-a',
    busNumber: 'Bus 05-A',
    driverId: 'dr-104',
    driverName: 'Officer Rajesh Kumar',
    routeId: 'route-05',
    routeName: 'Route 05: Metro City Central -> University Campus',
    startTime: new Date(Date.now() - 4 * 3600000).toISOString(),
    endTime: new Date(Date.now() - 3.4 * 3600000).toISOString(),
    durationMinutes: 36,
    currentLat: 37.7879,
    currentLng: -122.4075,
    currentStopName: 'University Campus Gate',
    nextStopName: 'Terminal Bay 3',
    tripStatus: 'completed',
    delayMinutes: 6,
    speed: 34,
    heading: 195,
    isSimulated: false,
    simulationIndex: 20,
    incidents: [
      {
        incidentId: 'inc-101-1',
        type: 'traffic',
        description: 'Morning commuter traffic congestion near Market St intersection',
        delayMinutes: 6,
        reportedAt: new Date(Date.now() - 3.8 * 3600000).toISOString(),
      },
    ],
  },
  {
    tripId: 'trip-2026-102',
    busId: 'bus-07-express',
    busNumber: 'Bus 07-Express',
    driverId: 'dr-319',
    driverName: 'Officer Michael Chen',
    routeId: 'route-07',
    routeName: 'Route 07: Central Station -> Silicon Tech Park',
    startTime: new Date(Date.now() - 3 * 3600000).toISOString(),
    endTime: new Date(Date.now() - 2.5 * 3600000).toISOString(),
    durationMinutes: 30,
    currentLat: 37.7749,
    currentLng: -122.4194,
    currentStopName: 'Silicon Tech Park West',
    nextStopName: 'Innovation Hub',
    tripStatus: 'completed',
    delayMinutes: 0,
    speed: 48,
    heading: 140,
    isSimulated: false,
    simulationIndex: 25,
    incidents: [],
  },
  {
    tripId: 'trip-2026-103',
    busId: 'bus-12-airport',
    busNumber: 'Bus 12-Airport Shuttle',
    driverId: 'dr-412',
    driverName: 'Officer Elena Rostova',
    routeId: 'route-12',
    routeName: 'Route 12: Maritime Harbor -> International Airport',
    startTime: new Date(Date.now() - 2.2 * 3600000).toISOString(),
    endTime: new Date(Date.now() - 1.4 * 3600000).toISOString(),
    durationMinutes: 48,
    currentLat: 37.759,
    currentLng: -122.446,
    currentStopName: 'Terminal 2 International Departures',
    nextStopName: 'AirTrain Station',
    tripStatus: 'completed',
    delayMinutes: 14,
    speed: 31,
    heading: 210,
    isSimulated: false,
    simulationIndex: 30,
    incidents: [
      {
        incidentId: 'inc-103-1',
        type: 'roadblock',
        description: 'Airport Access Road single-lane closure for resurfacing',
        delayMinutes: 10,
        reportedAt: new Date(Date.now() - 1.9 * 3600000).toISOString(),
      },
      {
        incidentId: 'inc-103-2',
        type: 'weather',
        description: 'Heavy coastal fog reduced operational speed along bridge',
        delayMinutes: 4,
        reportedAt: new Date(Date.now() - 1.6 * 3600000).toISOString(),
      },
    ],
  },
  {
    tripId: 'trip-2026-104',
    busId: 'bus-05-b',
    busNumber: 'Bus 05-B',
    driverId: 'dr-208',
    driverName: 'Officer Sarah Jenkins',
    routeId: 'route-05',
    routeName: 'Route 05: Metro City Central -> University Campus',
    startTime: new Date(Date.now() - 1.2 * 3600000).toISOString(),
    endTime: new Date(Date.now() - 0.7 * 3600000).toISOString(),
    durationMinutes: 30,
    currentLat: 37.7879,
    currentLng: -122.4075,
    currentStopName: 'Central Transit Hub',
    nextStopName: 'Market Square',
    tripStatus: 'completed',
    delayMinutes: 2,
    speed: 38,
    heading: 85,
    isSimulated: false,
    simulationIndex: 12,
    incidents: [],
  },
  {
    tripId: 'trip-2026-105',
    busId: 'bus-03-loop',
    busNumber: 'Bus 03-Downtown',
    driverId: 'dr-104',
    driverName: 'Officer Rajesh Kumar',
    routeId: 'route-03',
    routeName: 'Route 03: Financial District -> Civic Arts Loop',
    startTime: new Date(Date.now() - 0.6 * 3600000).toISOString(),
    endTime: new Date(Date.now() - 0.2 * 3600000).toISOString(),
    durationMinutes: 24,
    currentLat: 37.795,
    currentLng: -122.395,
    currentStopName: 'Civic Arts Center',
    nextStopName: 'Symphony Hall',
    tripStatus: 'completed',
    delayMinutes: 0,
    speed: 26,
    heading: 270,
    isSimulated: false,
    simulationIndex: 18,
    incidents: [],
  },
];

// Collection references - SEPARATE COLLECTIONS PER ROLE
const ROUTES_COL = 'routes';
const BUSES_COL = 'buses';
const ALERTS_COL = 'alerts';
const TRIPS_COL = 'trips';
const TICKETS_COL = 'tickets';
const USERS_COL = 'users';
const PASSENGERS_COL = 'passengers';
const DRIVERS_COL = 'drivers';
const ADMINS_COL = 'admins';

/**
 * Helper to serialize a TransitRoute for Firestore.
 * Firestore rejects nested arrays like [number, number][].
 * We convert waypoints to an array of objects: { lat: number, lng: number }[]
 */
function serializeRouteForFirestore(route: TransitRoute) {
  return {
    ...route,
    waypoints: (route.waypoints || []).map(([lat, lng]) => ({ lat, lng })),
  };
}

/**
 * Helper to deserialize a TransitRoute from Firestore.
 * Restores waypoints to [number, number][] so Leaflet polylines and ETA calculations work seamlessly.
 */
function deserializeRouteFromFirestore(data: any): TransitRoute {
  let waypoints: [number, number][] = [];
  if (Array.isArray(data.waypoints)) {
    waypoints = data.waypoints.map((pt: any) => {
      if (Array.isArray(pt)) {
        return [Number(pt[0]), Number(pt[1])] as [number, number];
      }
      if (pt && typeof pt === 'object' && 'lat' in pt && 'lng' in pt) {
        return [Number(pt.lat), Number(pt.lng)] as [number, number];
      }
      return [0, 0] as [number, number];
    });
  }

  return {
    ...data,
    waypoints,
  };
}

/**
 * Seeds initial network data into real Firestore if empty
 */
export async function initializeFirestoreTransitData(): Promise<void> {
  try {
    // 1. Check Routes
    const routesSnap = await getDocs(collection(db, ROUTES_COL));
    if (routesSnap.empty) {
      console.info('Seeding transit routes to real Firestore database...');
      for (const route of INITIAL_ROUTES) {
        await setDoc(doc(db, ROUTES_COL, route.routeId), serializeRouteForFirestore(route));
      }
    }

    // 2. Check Buses
    const busesSnap = await getDocs(collection(db, BUSES_COL));
    if (busesSnap.empty) {
      console.info('Seeding fleet buses to real Firestore database...');
      for (const bus of INITIAL_BUSES) {
        await setDoc(doc(db, BUSES_COL, bus.busId), bus);
      }
    }

    // 3. Check Alerts
    const alertsSnap = await getDocs(collection(db, ALERTS_COL));
    if (alertsSnap.empty) {
      console.info('Seeding initial alerts to real Firestore database...');
      for (const alert of INITIAL_ALERTS) {
        await setDoc(doc(db, ALERTS_COL, alert.alertId), alert);
      }
    }

    // 4. Check Historical Trips
    const tripsSnap = await getDocs(collection(db, TRIPS_COL));
    if (tripsSnap.empty) {
      console.info('Seeding initial trip history to real Firestore database...');
      for (const trip of INITIAL_HISTORICAL_TRIPS) {
        await setDoc(doc(db, TRIPS_COL, trip.tripId), trip);
      }
    }

    // 5. Default Admin User in Firestore
    const adminRef = doc(db, USERS_COL, 'admin-prithvi');
    const adminDoc = await getDoc(adminRef);
    if (!adminDoc.exists()) {
      await setDoc(adminRef, {
        userId: 'admin-prithvi',
        email: 'rprithvi388@gmail.com',
        displayName: 'Prithvi R (Administrator)',
        role: 'admin',
        createdAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error in initializeFirestoreTransitData:', error);
    // Don't crash if network issue, but log
  }
}

/**
 * Real-time listener for buses collection in Firestore
 */
export function subscribeToBuses(callback: (buses: Bus[]) => void): () => void {
  try {
    return onSnapshot(
      collection(db, BUSES_COL),
      (snapshot) => {
        const buses: Bus[] = [];
        snapshot.forEach((docSnap) => {
          buses.push(docSnap.data() as Bus);
        });
        callback(buses);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, BUSES_COL);
      }
    );
  } catch (err) {
    console.error('Failed to subscribe to buses:', err);
    return () => {};
  }
}

/**
 * Real-time listener for transit routes in Firestore
 */
export function subscribeToRoutes(callback: (routes: TransitRoute[]) => void): () => void {
  try {
    return onSnapshot(
      collection(db, ROUTES_COL),
      (snapshot) => {
        const routes: TransitRoute[] = [];
        snapshot.forEach((docSnap) => {
          routes.push(deserializeRouteFromFirestore(docSnap.data()));
        });
        callback(routes);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, ROUTES_COL);
      }
    );
  } catch (err) {
    console.error('Failed to subscribe to routes:', err);
    return () => {};
  }
}

/**
 * Real-time listener for active service alerts in Firestore
 */
export function subscribeToAlerts(callback: (alerts: ServiceAlert[]) => void): () => void {
  try {
    return onSnapshot(
      collection(db, ALERTS_COL),
      (snapshot) => {
        const alerts: ServiceAlert[] = [];
        snapshot.forEach((docSnap) => {
          const alert = docSnap.data() as ServiceAlert;
          if (alert.active !== false) {
            alerts.push(alert);
          }
        });
        callback(alerts);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, ALERTS_COL);
      }
    );
  } catch (err) {
    console.error('Failed to subscribe to alerts:', err);
    return () => {};
  }
}

/**
 * Real-time listener for registered users in Firestore (RBAC)
 */
export function subscribeToUsers(callback: (users: UserProfile[]) => void): () => void {
  try {
    return onSnapshot(
      collection(db, USERS_COL),
      (snapshot) => {
        const users: UserProfile[] = [];
        snapshot.forEach((docSnap) => {
          users.push(docSnap.data() as UserProfile);
        });
        callback(users);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, USERS_COL);
      }
    );
  } catch (err) {
    console.error('Failed to subscribe to users:', err);
    return () => {};
  }
}

/**
 * Updates bus live GPS coordinates, speed, and delay directly in Firestore
 */
export async function updateBusLocationInFirestore(
  busId: string,
  latitude: number,
  longitude: number,
  speed: number,
  heading: number,
  delayMinutes: number
): Promise<void> {
  const busRef = doc(db, BUSES_COL, busId);
  try {
    await updateDoc(busRef, {
      currentLat: latitude,
      currentLng: longitude,
      currentSpeed: speed,
      heading,
      currentDelay: delayMinutes,
      status: delayMinutes >= 4 ? 'Delayed' : 'On Route',
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${BUSES_COL}/${busId}`);
  }
}

/**
 * Updates bus operating status directly in Firestore
 */
export async function updateBusStatusInFirestore(busId: string, status: string): Promise<void> {
  const busRef = doc(db, BUSES_COL, busId);
  try {
    await updateDoc(busRef, {
      status,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${BUSES_COL}/${busId}`);
  }
}

/**
 * Starts a real trip in Firestore
 */
export async function startTripInFirestore(trip: ActiveTrip): Promise<void> {
  const tripRef = doc(db, TRIPS_COL, trip.tripId);
  const busRef = doc(db, BUSES_COL, trip.busId);
  try {
    await setDoc(tripRef, trip);
    await updateDoc(busRef, {
      status: 'On Route',
      currentLat: trip.currentLat,
      currentLng: trip.currentLng,
      currentSpeed: trip.speed,
      currentDelay: 0,
      driverName: trip.driverName,
      driverId: trip.driverId,
      routeId: trip.routeId,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${TRIPS_COL}/${trip.tripId}`);
  }
}

/**
 * Real-time listener for trips collection in Firestore
 */
export function subscribeToTrips(callback: (trips: ActiveTrip[]) => void): () => void {
  try {
    return onSnapshot(
      collection(db, TRIPS_COL),
      (snapshot) => {
        const trips: ActiveTrip[] = [];
        snapshot.forEach((docSnap) => {
          trips.push(docSnap.data() as ActiveTrip);
        });
        // Sort trips newest first by default
        trips.sort((a, b) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime());
        callback(trips);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, TRIPS_COL);
      }
    );
  } catch (err) {
    console.error('Failed to subscribe to trips:', err);
    return () => {};
  }
}

/**
 * Fetches all past trips from Firestore
 */
export async function fetchTripsFromFirestore(): Promise<ActiveTrip[]> {
  try {
    const snap = await getDocs(collection(db, TRIPS_COL));
    const trips: ActiveTrip[] = [];
    snap.forEach((docSnap) => {
      trips.push(docSnap.data() as ActiveTrip);
    });
    trips.sort((a, b) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime());
    return trips;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, TRIPS_COL);
    return [];
  }
}

/**
 * Records an incident on an active or past trip in Firestore
 */
export async function recordTripIncidentInFirestore(
  tripId: string,
  incident: TripIncident
): Promise<void> {
  const tripRef = doc(db, TRIPS_COL, tripId);
  try {
    const snap = await getDoc(tripRef);
    if (snap.exists()) {
      const data = snap.data() as ActiveTrip;
      const existingIncidents = data.incidents || [];
      await updateDoc(tripRef, {
        incidents: [...existingIncidents, incident],
        delayMinutes: Math.max(data.delayMinutes || 0, incident.delayMinutes),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${TRIPS_COL}/${tripId}`);
  }
}

/**
 * Ends a trip session in Firestore, computing and persisting duration
 */
export async function endTripInFirestore(
  tripId: string,
  busId: string,
  durationMinutes?: number
): Promise<void> {
  const tripRef = doc(db, TRIPS_COL, tripId);
  const busRef = doc(db, BUSES_COL, busId);
  try {
    let calcDuration = durationMinutes;
    if (!calcDuration) {
      const snap = await getDoc(tripRef);
      if (snap.exists()) {
        const data = snap.data() as ActiveTrip;
        if (data.startTime) {
          calcDuration = Math.max(1, Math.round((Date.now() - new Date(data.startTime).getTime()) / 60000));
        }
      }
    }

    await updateDoc(tripRef, {
      tripStatus: 'completed',
      endTime: new Date().toISOString(),
      durationMinutes: calcDuration || 25,
    });
    await updateDoc(busRef, {
      status: 'Available',
      currentSpeed: 0,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${TRIPS_COL}/${tripId}`);
  }
}

/**
 * Publishes a real service announcement in Firestore
 */
export async function publishAlertInFirestore(alert: ServiceAlert): Promise<void> {
  const alertRef = doc(db, ALERTS_COL, alert.alertId);
  try {
    await setDoc(alertRef, alert);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${ALERTS_COL}/${alert.alertId}`);
  }
}

/**
 * Dismisses an alert in Firestore
 */
export async function dismissAlertInFirestore(alertId: string): Promise<void> {
  const alertRef = doc(db, ALERTS_COL, alertId);
  try {
    await updateDoc(alertRef, { active: false });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${ALERTS_COL}/${alertId}`);
  }
}

/**
 * Issues a real ticket in Firestore
 */
export async function issueTicketInFirestore(ticket: DigitalTicket): Promise<void> {
  const ticketRef = doc(db, TICKETS_COL, ticket.ticketId);
  try {
    await setDoc(ticketRef, ticket);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${TICKETS_COL}/${ticket.ticketId}`);
  }
}

/**
 * Validates a digital pass in Firestore
 */
export async function validateTicketInFirestore(ticketId: string): Promise<boolean> {
  const ticketRef = doc(db, TICKETS_COL, ticketId);
  try {
    const snap = await getDoc(ticketRef);
    if (!snap.exists()) return false;
    await updateDoc(ticketRef, { status: 'used' });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${TICKETS_COL}/${ticketId}`);
  }
}

/**
 * Saves or updates a user profile & role in Firestore
 */
export async function saveUserRoleInFirestore(userId: string, role: UserRole, email: string, displayName: string): Promise<void> {
  const userRef = doc(db, USERS_COL, userId);
  try {
    await setDoc(
      userRef,
      {
        userId,
        email,
        displayName,
        role,
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${USERS_COL}/${userId}`);
  }
}

/**
 * 1. PASSENGER CREDENTIALS & PROFILES (SAVED SEPARATELY)
 */
export async function savePassengerProfileInFirestore(profile: PassengerProfile): Promise<void> {
  const pRef = doc(db, PASSENGERS_COL, profile.uid);
  try {
    await setDoc(pRef, profile, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${PASSENGERS_COL}/${profile.uid}`);
  }
}

export async function getPassengerProfileFromFirestore(uid: string): Promise<PassengerProfile | null> {
  const pRef = doc(db, PASSENGERS_COL, uid);
  try {
    const snap = await getDoc(pRef);
    if (!snap.exists()) return null;
    return snap.data() as PassengerProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${PASSENGERS_COL}/${uid}`);
  }
}

export function subscribeToPassengers(callback: (passengers: PassengerProfile[]) => void): () => void {
  try {
    return onSnapshot(
      collection(db, PASSENGERS_COL),
      (snapshot) => {
        const list: PassengerProfile[] = [];
        snapshot.forEach((d) => list.push(d.data() as PassengerProfile));
        callback(list);
      },
      (error) => handleFirestoreError(error, OperationType.GET, PASSENGERS_COL)
    );
  } catch {
    return () => {};
  }
}

/**
 * 2. DRIVER CREDENTIALS & PROFILES (SAVED SEPARATELY)
 */
export async function saveDriverProfileInFirestore(profile: DriverProfile): Promise<void> {
  const dRef = doc(db, DRIVERS_COL, profile.uid);
  try {
    await setDoc(dRef, profile, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${DRIVERS_COL}/${profile.uid}`);
  }
}

export async function getDriverProfileFromFirestore(uid: string): Promise<DriverProfile | null> {
  const dRef = doc(db, DRIVERS_COL, uid);
  try {
    const snap = await getDoc(dRef);
    if (!snap.exists()) return null;
    return snap.data() as DriverProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${DRIVERS_COL}/${uid}`);
  }
}

export function subscribeToDrivers(callback: (drivers: DriverProfile[]) => void): () => void {
  try {
    return onSnapshot(
      collection(db, DRIVERS_COL),
      (snapshot) => {
        const list: DriverProfile[] = [];
        snapshot.forEach((d) => list.push(d.data() as DriverProfile));
        callback(list);
      },
      (error) => handleFirestoreError(error, OperationType.GET, DRIVERS_COL)
    );
  } catch {
    return () => {};
  }
}

/**
 * 3. ADMIN CREDENTIALS & PROFILES (SAVED SEPARATELY)
 */
export async function saveAdminProfileInFirestore(profile: AdminProfile): Promise<void> {
  const aRef = doc(db, ADMINS_COL, profile.uid);
  try {
    await setDoc(aRef, profile, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${ADMINS_COL}/${profile.uid}`);
  }
}

export async function getAdminProfileFromFirestore(uid: string): Promise<AdminProfile | null> {
  const aRef = doc(db, ADMINS_COL, uid);
  try {
    const snap = await getDoc(aRef);
    if (!snap.exists()) return null;
    return snap.data() as AdminProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${ADMINS_COL}/${uid}`);
  }
}

