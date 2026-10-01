import { describe, it, expect } from 'vitest';
import { calculateDistanceKm, predictETA, findRoutesBetweenStops } from '../utils/etaCalculator';
import { INITIAL_ROUTES, INITIAL_BUSES } from '../services/transitData';
import { Bus, TransitRoute } from '../types';

describe('Transit ETA Calculator & Distance Engine', () => {
  it('calculates Haversine distance correctly between coordinates', () => {
    // Distance between Central Transit Hub (37.7879, -122.4075) and Main Market (37.7815, -122.4110)
    const dist = calculateDistanceKm(37.7879, -122.4075, 37.7815, -122.4110);
    expect(dist).toBeGreaterThan(0.5);
    expect(dist).toBeLessThan(1.5);

    // Distance to same point should be 0
    expect(calculateDistanceKm(37.7879, -122.4075, 37.7879, -122.4075)).toBe(0);
  });

  it('predicts arrival time including speed, distance, dwell time and delays', () => {
    const route = INITIAL_ROUTES[0]; // Route 05
    const targetStop = route.stops[5]; // University Gate
    const mockBus: Bus = {
      busId: 'test-bus-1',
      busNumber: 'Bus Test',
      vehicleNumber: 'MP-001',
      capacity: 50,
      currentOccupancy: 20,
      driverId: 'dr-1',
      driverName: 'Test Driver',
      routeId: route.routeId,
      status: 'On Route',
      currentLat: route.stops[0].latitude,
      currentLng: route.stops[0].longitude,
      currentSpeed: 30, // 30 km/h
      heading: 180,
      currentDelay: 5, // 5 min delay reported
      lastUpdated: new Date().toISOString(),
    };

    const eta = predictETA(mockBus, route, targetStop, 0);

    expect(eta.distanceKm).toBeGreaterThan(0);
    expect(eta.delayMinutes).toBe(5);
    expect(eta.dwellTimeMinutes).toBeGreaterThan(0);
    expect(eta.status).toBe('Delayed');
    expect(eta.confidenceScore).toBeGreaterThanOrEqual(70);
    expect(eta.formattedArrival).toBeDefined();
  });

  it('sets status to On Time when delay is zero', () => {
    const route = INITIAL_ROUTES[0];
    const targetStop = route.stops[1];
    const mockBus: Bus = {
      ...INITIAL_BUSES[0],
      currentDelay: 0,
      currentSpeed: 25,
    };

    const eta = predictETA(mockBus, route, targetStop, 0);
    expect(eta.status).toBe('On Time');
    expect(eta.delayMinutes).toBe(0);
  });
});

describe('Smart Route Search & Transfer Route Recommender', () => {
  it('finds direct route when stops exist on same route in order', () => {
    const results = findRoutesBetweenStops(
      INITIAL_ROUTES,
      INITIAL_BUSES,
      'Central Transit Hub',
      'University Campus Gate'
    );

    expect(results.length).toBeGreaterThan(0);
    const direct = results.find((r) => r.type === 'direct');
    expect(direct).toBeDefined();
    expect(direct?.legs.length).toBe(1);
    expect(direct?.legs[0].fromStop).toBe('Central Transit Hub');
    expect(direct?.legs[0].toStop).toBe('University Campus Gate');
  });

  it('recommends multi-leg transfer route when no direct route exists', () => {
    // Travel from "Main Market Square" (on Route 05) to "Silicon Tech Park" (on Route 07)
    // Transfer junction is "Civic Center & Library"
    const results = findRoutesBetweenStops(
      INITIAL_ROUTES,
      INITIAL_BUSES,
      'Main Market Square',
      'Silicon Tech Park'
    );

    expect(results.length).toBeGreaterThan(0);
    const transfer = results.find((r) => r.type === 'transfer');
    expect(transfer).toBeDefined();
    expect(transfer?.transferStop).toBe('Civic Center & Library');
    expect(transfer?.legs.length).toBe(2);
    expect(transfer?.legs[0].fromStop).toBe('Main Market Square');
    expect(transfer?.legs[1].toStop).toBe('Silicon Tech Park');
  });

  it('gracefully handles identical stops or empty inputs', () => {
    const sameStop = findRoutesBetweenStops(INITIAL_ROUTES, INITIAL_BUSES, 'Main Market', 'Main Market');
    expect(sameStop).toEqual([]);

    const empty = findRoutesBetweenStops(INITIAL_ROUTES, INITIAL_BUSES, '', '');
    expect(empty).toEqual([]);
  });
});
