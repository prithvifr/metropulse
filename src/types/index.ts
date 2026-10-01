export type UserRole = 'passenger' | 'driver' | 'operator' | 'admin';
export type AppView = 'landing' | UserRole;

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export interface PassengerProfile {
  uid: string;
  email: string;
  fullName: string;
  phone?: string;
  role: 'passenger';
  createdAt: string;
  savedRoutes?: string[];
}

export interface DriverProfile {
  uid: string;
  email: string;
  driverName: string;
  licenseNumber: string;
  phone?: string;
  assignedBusId?: string;
  assignedVehicleNumber?: string;
  assignedRouteId?: string;
  shiftStatus: 'Available' | 'On Route' | 'Break' | 'Offline';
  rating: number;
  tripsCount: number;
  role: 'driver';
  createdAt: string;
}

export interface AdminProfile {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'operator';
  permissions: string[];
  createdAt: string;
}

export type BusStatus = 'Available' | 'On Route' | 'Delayed' | 'Break' | 'Offline';

export interface Bus {
  busId: string;
  busNumber: string;
  vehicleNumber: string;
  capacity: number;
  currentOccupancy: number; // For crowd level
  driverId: string;
  driverName: string;
  routeId: string;
  status: BusStatus;
  currentLat: number;
  currentLng: number;
  currentSpeed: number; // km/h
  heading: number; // degrees 0-360
  currentDelay: number; // in minutes
  lastUpdated: string;
  isSimulated?: boolean;
}

export interface BusStop {
  stopId: string;
  routeId: string;
  stopName: string;
  latitude: number;
  longitude: number;
  stopOrder: number;
  landmark?: string;
  expectedArrivalTime?: string;
}

export interface TransitRoute {
  routeId: string;
  routeName: string;
  routeNumber: string;
  startLocation: string;
  destination: string;
  estimatedDuration: number; // in minutes
  activeStatus: boolean;
  fare: number;
  color: string;
  frequencyMinutes: number;
  stops: BusStop[];
  waypoints: [number, number][]; // High resolution route polyline [lat, lng]
}

export type TripStatus = 'active' | 'completed' | 'cancelled';

export type TripIncidentType = 'traffic' | 'roadblock' | 'breakdown' | 'weather' | 'delay';

export interface TripIncident {
  incidentId: string;
  type: TripIncidentType;
  description: string;
  delayMinutes: number;
  reportedAt: string;
}

export interface ActiveTrip {
  tripId: string;
  busId: string;
  busNumber: string;
  driverId: string;
  driverName: string;
  routeId: string;
  routeName: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  currentLat: number;
  currentLng: number;
  currentStopId?: string;
  currentStopName: string;
  nextStopId?: string;
  nextStopName: string;
  tripStatus: TripStatus;
  delayMinutes: number;
  speed: number;
  heading: number;
  isSimulated: boolean;
  simulationIndex: number;
  incidents?: TripIncident[];
}

export type AlertSeverity = 'info' | 'warning' | 'emergency';

export interface ServiceAlert {
  alertId: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  affectedRouteId?: string;
  affectedRouteName?: string;
  affectedStopId?: string;
  createdAt: string;
  active: boolean;
}

export interface DigitalTicket {
  ticketId: string;
  userId: string;
  routeId: string;
  routeName: string;
  fromStop: string;
  toStop: string;
  passengerName: string;
  fare: number;
  status: 'valid' | 'used' | 'expired';
  qrCode: string;
  purchaseTime: string;
  expiryTime: string;
}

export interface ETAPrediction {
  targetStopName: string;
  targetStopId: string;
  distanceKm: number;
  currentSpeedKmh: number;
  estimatedMinutes: number;
  scheduledMinutes: number;
  delayMinutes: number;
  dwellTimeMinutes: number;
  status: 'On Time' | 'Delayed' | 'Early';
  confidenceScore: number; // percentage, e.g. 96%
  formattedArrival: string;
}

export interface TransferRouteOption {
  type: 'direct' | 'transfer';
  totalDurationMinutes: number;
  totalFare: number;
  legs: {
    route: TransitRoute;
    fromStop: string;
    toStop: string;
    stopsCount: number;
    busApproaching?: Bus;
    etaMinutes: number;
  }[];
  transferStop?: string;
  walkingDistanceMeters?: number;
}

export interface AnalyticsSummary {
  totalBuses: number;
  activeBuses: number;
  delayedBuses: number;
  offlineBuses: number;
  routesRunning: number;
  tripsCompletedToday: number;
  averageDelayMinutes: number;
  onTimePerformanceRate: number; // e.g. 94.2%
  averageEtaAccuracy: number; // e.g. 97.4%
  peakOperatingHours: { hour: string; trips: number; loadPercentage: number }[];
  routePerformance: {
    routeId: string;
    routeName: string;
    activeBuses: number;
    onTimeRate: number;
    avgDelay: number;
    dailyPassengers: number;
  }[];
}
