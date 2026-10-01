import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { INITIAL_ROUTES, INITIAL_BUSES, INITIAL_ALERTS, INITIAL_ANALYTICS } from './src/services/transitData.js';
import { Bus, ServiceAlert, ActiveTrip, DigitalTicket } from './src/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// In-memory synchronized store for real-time fleet operations
let buses: Bus[] = JSON.parse(JSON.stringify(INITIAL_BUSES));
let alerts: ServiceAlert[] = JSON.parse(JSON.stringify(INITIAL_ALERTS));
let activeTrips: Record<string, ActiveTrip> = {};
let tickets: Record<string, DigitalTicket> = {};
let analytics = JSON.parse(JSON.stringify(INITIAL_ANALYTICS));

// 1. Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'MetroPulse Transit Authority API',
    fleetActive: buses.filter(b => b.status === 'On Route').length,
    activeAlerts: alerts.filter(a => a.active).length,
  });
});

// 2. Transit Routes
app.get('/api/routes', (_req: Request, res: Response) => {
  res.json({ routes: INITIAL_ROUTES });
});

// 3. Transit Fleet Buses
app.get('/api/buses', (_req: Request, res: Response) => {
  res.json({ buses });
});

// 4. Update Bus Status (Dispatcher Control)
app.patch('/api/buses/:busId/status', (req: Request, res: Response) => {
  const { busId } = req.params;
  const { status, driverId, driverName, routeId } = req.body;

  const bus = buses.find(b => b.busId === busId);
  if (!bus) {
    return res.status(404).json({ error: 'Bus not found' });
  }

  if (status) bus.status = status;
  if (driverId !== undefined) bus.driverId = driverId;
  if (driverName !== undefined) bus.driverName = driverName;
  if (routeId !== undefined) bus.routeId = routeId;
  bus.lastUpdated = new Date().toISOString();

  // Recalculate fleet analytics
  analytics.activeBuses = buses.filter(b => b.status === 'On Route').length;
  analytics.delayedBuses = buses.filter(b => b.status === 'Delayed').length;
  analytics.offlineBuses = buses.filter(b => b.status === 'Offline').length;

  res.json({ success: true, bus });
});

// 5. Service Alerts
app.get('/api/alerts', (_req: Request, res: Response) => {
  res.json({ alerts: alerts.filter(a => a.active) });
});

app.post('/api/alerts', (req: Request, res: Response) => {
  const { title, message, severity, affectedRouteId, affectedRouteName } = req.body;

  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }

  const newAlert: ServiceAlert = {
    alertId: `alert-${Date.now()}`,
    title: String(title).slice(0, 128),
    message: String(message).slice(0, 512),
    severity: ['info', 'warning', 'emergency'].includes(severity) ? severity : 'info',
    affectedRouteId,
    affectedRouteName,
    createdAt: new Date().toISOString(),
    active: true,
  };

  alerts.unshift(newAlert);
  res.status(201).json({ success: true, alert: newAlert });
});

app.delete('/api/alerts/:alertId', (req: Request, res: Response) => {
  const { alertId } = req.params;
  alerts = alerts.map(a => a.alertId === alertId ? { ...a, active: false } : a);
  res.json({ success: true });
});

// 6. Driver Trip Management
app.post('/api/driver/trip/start', (req: Request, res: Response) => {
  const { busId, driverId, driverName, routeId, isSimulated } = req.body;

  const bus = buses.find(b => b.busId === busId);
  const route = INITIAL_ROUTES.find(r => r.routeId === routeId);

  if (!bus || !route) {
    return res.status(400).json({ error: 'Valid busId and routeId are required' });
  }

  const tripId = `trip-${Date.now()}`;
  const startStop = route.stops[0];
  const nextStop = route.stops[1] || route.stops[0];

  const trip: ActiveTrip = {
    tripId,
    busId: bus.busId,
    busNumber: bus.busNumber,
    driverId: driverId || 'driver-current',
    driverName: driverName || 'Assigned Driver',
    routeId: route.routeId,
    routeName: route.routeName,
    startTime: new Date().toISOString(),
    currentLat: startStop.latitude,
    currentLng: startStop.longitude,
    currentStopId: startStop.stopId,
    currentStopName: startStop.stopName,
    nextStopId: nextStop.stopId,
    nextStopName: nextStop.stopName,
    tripStatus: 'active',
    delayMinutes: 0,
    speed: 25,
    heading: 90,
    isSimulated: !!isSimulated,
    simulationIndex: 0,
  };

  activeTrips[tripId] = trip;

  // Update bus status
  bus.status = 'On Route';
  bus.currentLat = trip.currentLat;
  bus.currentLng = trip.currentLng;
  bus.currentSpeed = trip.speed;
  bus.currentDelay = 0;
  bus.routeId = route.routeId;
  bus.driverId = trip.driverId;
  bus.driverName = trip.driverName;
  bus.lastUpdated = new Date().toISOString();

  res.status(201).json({ success: true, trip });
});

// 7. Live Driver GPS Location Update (Mobile GPS or Simulation)
app.post('/api/driver/trip/location', (req: Request, res: Response) => {
  const { tripId, latitude, longitude, speed, heading, currentStopName, nextStopName, delayMinutes, simulationIndex } = req.body;

  const trip = activeTrips[tripId];
  if (!trip) {
    // If not found in memory, find bus directly
    return res.status(404).json({ error: 'Active trip session not found' });
  }

  if (latitude !== undefined && longitude !== undefined) {
    trip.currentLat = Number(latitude);
    trip.currentLng = Number(longitude);
  }
  if (speed !== undefined) trip.speed = Math.max(0, Number(speed));
  if (heading !== undefined) trip.heading = Number(heading);
  if (currentStopName) trip.currentStopName = currentStopName;
  if (nextStopName) trip.nextStopName = nextStopName;
  if (delayMinutes !== undefined) trip.delayMinutes = Number(delayMinutes);
  if (simulationIndex !== undefined) trip.simulationIndex = Number(simulationIndex);

  // Sync to fleet bus
  const bus = buses.find(b => b.busId === trip.busId);
  if (bus) {
    bus.currentLat = trip.currentLat;
    bus.currentLng = trip.currentLng;
    bus.currentSpeed = trip.speed;
    bus.heading = trip.heading;
    bus.currentDelay = trip.delayMinutes;
    bus.status = trip.delayMinutes >= 5 ? 'Delayed' : 'On Route';
    bus.lastUpdated = new Date().toISOString();
  }

  res.json({ success: true, trip, bus });
});

// 8. Driver Problem / Delay Report
app.post('/api/driver/trip/report', (req: Request, res: Response) => {
  const { tripId, delayMinutes, reason, issueType } = req.body;

  const trip = activeTrips[tripId];
  if (!trip) {
    return res.status(404).json({ error: 'Trip not found' });
  }

  trip.delayMinutes = Number(delayMinutes || 0);

  const bus = buses.find(b => b.busId === trip.busId);
  if (bus) {
    bus.currentDelay = trip.delayMinutes;
    if (issueType === 'breakdown') {
      bus.status = 'Break';
    } else if (trip.delayMinutes >= 4) {
      bus.status = 'Delayed';
    }
    bus.lastUpdated = new Date().toISOString();
  }

  // Create automatic passenger announcement if significant delay or issue
  if (trip.delayMinutes >= 5 || issueType === 'breakdown') {
    alerts.unshift({
      alertId: `alert-auto-${Date.now()}`,
      title: `${trip.busNumber} Notice: ${issueType === 'breakdown' ? 'Service Disruption' : 'Traffic Delay'}`,
      message: `${trip.routeName}: ${reason || 'Service delayed by ' + trip.delayMinutes + ' minutes.'}`,
      severity: issueType === 'breakdown' ? 'emergency' : 'warning',
      affectedRouteId: trip.routeId,
      affectedRouteName: trip.routeName,
      createdAt: new Date().toISOString(),
      active: true,
    });
  }

  res.json({ success: true, trip, bus });
});

// 9. End Trip
app.post('/api/driver/trip/end', (req: Request, res: Response) => {
  const { tripId } = req.body;

  const trip = activeTrips[tripId];
  if (!trip) {
    return res.status(404).json({ error: 'Trip not found' });
  }

  trip.tripStatus = 'completed';
  trip.endTime = new Date().toISOString();

  const bus = buses.find(b => b.busId === trip.busId);
  if (bus) {
    bus.status = 'Available';
    bus.currentSpeed = 0;
    bus.lastUpdated = new Date().toISOString();
  }

  analytics.tripsCompletedToday += 1;
  delete activeTrips[tripId];

  res.json({ success: true, message: 'Trip completed successfully' });
});

// 10. Digital Ticketing
app.post('/api/tickets/issue', (req: Request, res: Response) => {
  const { userId, routeId, routeName, fromStop, toStop, passengerName, fare } = req.body;

  if (!fromStop || !toStop) {
    return res.status(400).json({ error: 'Origin and destination stops are required' });
  }

  const ticketId = `TCK-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  const now = new Date();
  const expiry = new Date(now.getTime() + 3 * 3600000); // 3 hours validity

  const newTicket: DigitalTicket = {
    ticketId,
    userId: userId || 'guest-passenger',
    routeId: routeId || 'route-05',
    routeName: routeName || 'Metro Transit',
    fromStop,
    toStop,
    passengerName: passengerName || 'Passenger',
    fare: Number(fare || 2.50),
    status: 'valid',
    qrCode: `METROPULSE-PASS|${ticketId}|${fromStop}|${toStop}|EXP:${expiry.toISOString()}`,
    purchaseTime: now.toISOString(),
    expiryTime: expiry.toISOString(),
  };

  tickets[ticketId] = newTicket;
  res.status(201).json({ success: true, ticket: newTicket });
});

app.post('/api/tickets/validate', (req: Request, res: Response) => {
  const { qrPayload } = req.body;
  if (!qrPayload) {
    return res.status(400).json({ error: 'Ticket QR code payload is required' });
  }

  const parts = String(qrPayload).split('|');
  const ticketId = parts[1];
  const ticket = tickets[ticketId];

  if (!ticket) {
    return res.json({ valid: false, message: 'Ticket not found in central registry' });
  }

  if (ticket.status !== 'valid') {
    return res.json({ valid: false, message: `Ticket already used or ${ticket.status}` });
  }

  ticket.status = 'used';
  res.json({ valid: true, ticket, message: 'Ticket verified successfully for boarding!' });
});

// 11. Crowd Level Reporting
app.post('/api/crowd/report', (req: Request, res: Response) => {
  const { busId, crowdLevel } = req.body; // 'low' | 'medium' | 'high'
  const bus = buses.find(b => b.busId === busId);
  if (bus) {
    if (crowdLevel === 'low') bus.currentOccupancy = Math.round(bus.capacity * 0.3);
    else if (crowdLevel === 'medium') bus.currentOccupancy = Math.round(bus.capacity * 0.65);
    else if (crowdLevel === 'high') bus.currentOccupancy = Math.round(bus.capacity * 0.95);
  }
  res.json({ success: true, bus });
});

// 12. Analytics Summary
app.get('/api/analytics', (_req: Request, res: Response) => {
  res.json({ analytics });
});

// Mount Vite middleware in development or static serve in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`MetroPulse server running at http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
