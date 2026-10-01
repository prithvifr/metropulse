import { TransitRoute, Bus, ServiceAlert, AnalyticsSummary } from '../types';

// Helper to interpolate dense waypoints between stops for realistic bus motion
function interpolatePoints(p1: [number, number], p2: [number, number], steps: number = 8): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = p1[0] + (p2[0] - p1[0]) * t;
    const lng = p1[1] + (p2[1] - p1[1]) * t;
    points.push([lat, lng]);
  }
  return points;
}

function buildWaypointsFromStops(stops: { latitude: number; longitude: number }[]): [number, number][] {
  const result: [number, number][] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const segment = interpolatePoints([stops[i].latitude, stops[i].longitude], [stops[i + 1].latitude, stops[i + 1].longitude], 10);
    // Avoid duplicate endpoints
    if (i > 0) segment.shift();
    result.push(...segment);
  }
  return result;
}

export const INITIAL_ROUTES: TransitRoute[] = [
  {
    routeId: 'route-07',
    routeNumber: '07',
    routeName: 'Route 7: City Center → University Gate',
    startLocation: 'City Center',
    destination: 'University Gate',
    estimatedDuration: 26,
    activeStatus: true,
    fare: 2.50,
    color: '#059669', // emerald green
    frequencyMinutes: 10,
    stops: [
      { stopId: 'stop-07-1', routeId: 'route-07', stopName: 'City Center', latitude: 37.7879, longitude: -122.4075, stopOrder: 1, landmark: 'Metro Concourse & Central Square' },
      { stopId: 'stop-07-2', routeId: 'route-07', stopName: 'Main Market', latitude: 37.7815, longitude: -122.4110, stopOrder: 2, landmark: 'Market Square & Bazaar' },
      { stopId: 'stop-07-3', routeId: 'route-07', stopName: 'Railway Station', latitude: 37.7760, longitude: -122.3950, stopOrder: 3, landmark: 'Central Railway Terminal Bay 1' },
      { stopId: 'stop-07-4', routeId: 'route-07', stopName: 'Civic Area', latitude: 37.7795, longitude: -122.4180, stopOrder: 4, landmark: 'Civic Center & Library (Transfer Point)' },
      { stopId: 'stop-07-5', routeId: 'route-07', stopName: 'Medical Arts Center', latitude: 37.7720, longitude: -122.4280, stopOrder: 5, landmark: 'Hospital North Wing' },
      { stopId: 'stop-07-6', routeId: 'route-07', stopName: 'University Gate', latitude: 37.7590, longitude: -122.4460, stopOrder: 6, landmark: 'Main University Campus Gate' },
    ],
    waypoints: [],
  },
  {
    routeId: 'route-05',
    routeNumber: '05',
    routeName: 'Route 05: Metro Hub → University Campus',
    startLocation: 'Central Transit Hub',
    destination: 'University Campus Gate',
    estimatedDuration: 28,
    activeStatus: true,
    fare: 2.50,
    color: '#10b981', // green
    frequencyMinutes: 10,
    stops: [
      { stopId: 'stop-05-1', routeId: 'route-05', stopName: 'Central Transit Hub', latitude: 37.7879, longitude: -122.4075, stopOrder: 1, landmark: 'Near Metro Concourse B' },
      { stopId: 'stop-05-2', routeId: 'route-05', stopName: 'Main Market Square', latitude: 37.7815, longitude: -122.4110, stopOrder: 2, landmark: 'Opposite City Bazaar' },
      { stopId: 'stop-05-3', routeId: 'route-05', stopName: 'Civic Center & Library', latitude: 37.7795, longitude: -122.4180, stopOrder: 3, landmark: 'Plaza Entrance (Transfer Station)' },
      { stopId: 'stop-05-4', routeId: 'route-05', stopName: 'Medical Arts Center', latitude: 37.7720, longitude: -122.4280, stopOrder: 4, landmark: 'Hospital North Wing' },
      { stopId: 'stop-05-5', routeId: 'route-05', stopName: 'Innovation Quarter', latitude: 37.7650, longitude: -122.4350, stopOrder: 5, landmark: 'Tech Labs & Incubation Hub' },
      { stopId: 'stop-05-6', routeId: 'route-05', stopName: 'University Campus Gate', latitude: 37.7590, longitude: -122.4460, stopOrder: 6, landmark: 'Main University Arch' },
    ],
    waypoints: [],
  },
  {
    routeId: 'route-03',
    routeNumber: '03',
    routeName: 'Route 3: Harbor Pier → City Center & West',
    startLocation: 'Harbor Pier',
    destination: 'University Gate West',
    estimatedDuration: 24,
    activeStatus: true,
    fare: 2.00,
    color: '#047857', // forest green
    frequencyMinutes: 8,
    stops: [
      { stopId: 'stop-03-1', routeId: 'route-03', stopName: 'Harbor Pier', latitude: 37.8080, longitude: -122.4150, stopOrder: 1, landmark: 'Ferry Terminal 3' },
      { stopId: 'stop-03-2', routeId: 'route-03', stopName: 'Riverfront Promenade', latitude: 37.7990, longitude: -122.3980, stopOrder: 2, landmark: 'River Walk Overlook' },
      { stopId: 'stop-03-3', routeId: 'route-03', stopName: 'City Center', latitude: 37.7879, longitude: -122.4075, stopOrder: 3, landmark: 'City Center Concourse (Transfer Point)' },
      { stopId: 'stop-03-4', routeId: 'route-03', stopName: 'Civic Area', latitude: 37.7795, longitude: -122.4180, stopOrder: 4, landmark: 'West Library Gate' },
      { stopId: 'stop-03-5', routeId: 'route-03', stopName: 'Grand Boulevard Mall', latitude: 37.7680, longitude: -122.4120, stopOrder: 5, landmark: 'Boulevard Plaza' },
    ],
    waypoints: [],
  },
  {
    routeId: 'route-09',
    routeNumber: '09',
    routeName: 'Route 9: City Center → University Gate Express',
    startLocation: 'City Center',
    destination: 'University Gate',
    estimatedDuration: 20,
    activeStatus: true,
    fare: 2.50,
    color: '#15803d', // emerald 700
    frequencyMinutes: 10,
    stops: [
      { stopId: 'stop-09-1', routeId: 'route-09', stopName: 'City Center', latitude: 37.7879, longitude: -122.4075, stopOrder: 1, landmark: 'Transfer Concourse' },
      { stopId: 'stop-09-2', routeId: 'route-09', stopName: 'Main Market', latitude: 37.7815, longitude: -122.4110, stopOrder: 2, landmark: 'Market Junction' },
      { stopId: 'stop-09-3', routeId: 'route-09', stopName: 'Railway Station', latitude: 37.7760, longitude: -122.3950, stopOrder: 3, landmark: 'Platform 1' },
      { stopId: 'stop-09-4', routeId: 'route-09', stopName: 'Civic Area', latitude: 37.7795, longitude: -122.4180, stopOrder: 4, landmark: 'Civic Express' },
      { stopId: 'stop-09-5', routeId: 'route-09', stopName: 'University Gate', latitude: 37.7590, longitude: -122.4460, stopOrder: 5, landmark: 'University South Gate' },
    ],
    waypoints: [],
  },
  {
    routeId: 'route-tech',
    routeNumber: '11',
    routeName: 'Route 11: Railway Terminal → Silicon Tech Park',
    startLocation: 'Central Railway Terminal',
    destination: 'Silicon Tech Park',
    estimatedDuration: 32,
    activeStatus: true,
    fare: 3.00,
    color: '#0d9488', // teal
    frequencyMinutes: 12,
    stops: [
      { stopId: 'stop-11-1', routeId: 'route-tech', stopName: 'Central Railway Terminal', latitude: 37.7760, longitude: -122.3950, stopOrder: 1, landmark: 'Platform 1 Bus Bay' },
      { stopId: 'stop-11-2', routeId: 'route-tech', stopName: 'Financial Commercial Plaza', latitude: 37.7910, longitude: -122.4020, stopOrder: 2, landmark: 'Stock Exchange Tower' },
      { stopId: 'stop-11-3', routeId: 'route-tech', stopName: 'Civic Center & Library', latitude: 37.7795, longitude: -122.4180, stopOrder: 3, landmark: 'Civic Station (Transfer Point)' },
      { stopId: 'stop-11-4', routeId: 'route-tech', stopName: 'Eco Green City', latitude: 37.7700, longitude: -122.4150, stopOrder: 4, landmark: 'Solar Avenue Crossing' },
      { stopId: 'stop-11-5', routeId: 'route-tech', stopName: 'Silicon Tech Park', latitude: 37.7520, longitude: -122.3920, stopOrder: 5, landmark: 'Innovation Campus Ring' },
    ],
    waypoints: [],
  },
];

// Populate waypoints
INITIAL_ROUTES.forEach((route) => {
  route.waypoints = buildWaypointsFromStops(route.stops);
});

export const INITIAL_BUSES: Bus[] = [
  {
    busId: 'bus-07',
    busNumber: '07', // Exact matching Bus: 07 from the prompt
    vehicleNumber: 'MP-0707',
    capacity: 55,
    currentOccupancy: 28,
    driverId: 'driver-07',
    driverName: 'Officer Marcus Vance (ID: DR-07)',
    routeId: 'route-07',
    status: 'On Route',
    currentLat: 37.7815, // Exact Main Market location
    currentLng: -122.4110,
    currentSpeed: 28, // 28 km/h
    heading: 215,
    currentDelay: 0, // On Time
    lastUpdated: new Date().toISOString(),
    isSimulated: true,
  },
  {
    busId: 'bus-05-a',
    busNumber: 'Bus 05-A',
    vehicleNumber: 'MP-7705',
    capacity: 55,
    currentOccupancy: 34,
    driverId: 'driver-01',
    driverName: 'Rajesh Kumar (ID: DR-104)',
    routeId: 'route-05',
    status: 'On Route',
    currentLat: 37.7879,
    currentLng: -122.4075,
    currentSpeed: 25,
    heading: 215,
    currentDelay: 0,
    lastUpdated: new Date().toISOString(),
    isSimulated: true,
  },
  {
    busId: 'bus-05-b',
    busNumber: 'Bus 05-B',
    vehicleNumber: 'MP-7709',
    capacity: 60,
    currentOccupancy: 42,
    driverId: 'driver-02',
    driverName: 'Sarah Jenkins (ID: DR-208)',
    routeId: 'route-05',
    status: 'Delayed',
    currentLat: 37.7720,
    currentLng: -122.4280,
    currentSpeed: 14,
    heading: 220,
    currentDelay: 6,
    lastUpdated: new Date().toISOString(),
    isSimulated: true,
  },
  {
    busId: 'bus-03-a',
    busNumber: 'Bus 03',
    vehicleNumber: 'MP-0303',
    capacity: 50,
    currentOccupancy: 19,
    driverId: 'driver-03',
    driverName: 'Elena Rostova (ID: DR-303)',
    routeId: 'route-03',
    status: 'On Route',
    currentLat: 37.8080,
    currentLng: -122.4150,
    currentSpeed: 30,
    heading: 180,
    currentDelay: 0,
    lastUpdated: new Date().toISOString(),
    isSimulated: true,
  },
  {
    busId: 'bus-09-a',
    busNumber: 'Bus 09',
    vehicleNumber: 'MP-0909',
    capacity: 55,
    currentOccupancy: 24,
    driverId: 'driver-09',
    driverName: 'David Chen (ID: DR-909)',
    routeId: 'route-09',
    status: 'On Route',
    currentLat: 37.7879,
    currentLng: -122.4075,
    currentSpeed: 32,
    heading: 210,
    currentDelay: 0,
    lastUpdated: new Date().toISOString(),
    isSimulated: true,
  },
];

export const INITIAL_ALERTS: ServiceAlert[] = [
  {
    alertId: 'alert-01',
    title: 'Route 7 Normal Operations',
    message: 'Bus 07 is approaching Railway Station on schedule (ETA: 8 mins to University Gate).',
    severity: 'info',
    affectedRouteId: 'route-07',
    affectedRouteName: 'Route 7: City Center → University Gate',
    createdAt: new Date().toISOString(),
    active: true,
  },
  {
    alertId: 'alert-02',
    title: 'Transfer Connection Active',
    message: 'Passengers from Harbor Pier can transfer smoothly: Take Route 3 → Get off at City Center → Take Route 9 → University Gate.',
    severity: 'info',
    createdAt: new Date().toISOString(),
    active: true,
  },
];

export const INITIAL_ANALYTICS: AnalyticsSummary = {
  totalBuses: 5,
  activeBuses: 4,
  delayedBuses: 1,
  offlineBuses: 0,
  routesRunning: 5,
  tripsCompletedToday: 126,
  averageDelayMinutes: 0.8,
  onTimePerformanceRate: 98.4,
  averageEtaAccuracy: 97.2,
  peakOperatingHours: [
    { hour: '08:00 AM', trips: 34, loadPercentage: 88 },
    { hour: '09:00 AM', trips: 31, loadPercentage: 82 },
    { hour: '12:00 PM', trips: 22, loadPercentage: 64 },
    { hour: '05:00 PM', trips: 36, loadPercentage: 92 },
    { hour: '06:00 PM', trips: 33, loadPercentage: 86 },
  ],
  routePerformance: [
    { routeId: 'route-07', routeName: 'Route 7: City Center → University Gate', activeBuses: 2, onTimeRate: 98.2, avgDelay: 0.5, dailyPassengers: 4120 },
    { routeId: 'route-05', routeName: 'Route 05: Metro Hub → University Campus', activeBuses: 2, onTimeRate: 96.5, avgDelay: 1.2, dailyPassengers: 3250 },
    { routeId: 'route-03', routeName: 'Route 3: Harbor Pier → City Center & West', activeBuses: 1, onTimeRate: 99.1, avgDelay: 0.4, dailyPassengers: 2180 },
  ],
};
