import { describe, it, expect } from 'vitest';
import { INITIAL_ROUTES, INITIAL_BUSES, INITIAL_ALERTS } from '../services/transitData';
import { DigitalTicket } from '../types';

describe('Fleet Management and Transit Integrity', () => {
  it('initializes routes with stops and populated waypoints', () => {
    expect(INITIAL_ROUTES.length).toBeGreaterThanOrEqual(4);
    INITIAL_ROUTES.forEach((route) => {
      expect(route.stops.length).toBeGreaterThanOrEqual(5);
      expect(route.waypoints.length).toBeGreaterThan(0);
      expect(route.fare).toBeGreaterThan(0);
    });
  });

  it('initializes fleet buses with valid capacities and status', () => {
    expect(INITIAL_BUSES.length).toBeGreaterThanOrEqual(5);
    INITIAL_BUSES.forEach((bus) => {
      expect(bus.capacity).toBeGreaterThan(0);
      expect(['Available', 'On Route', 'Delayed', 'Break', 'Offline']).toContain(bus.status);
    });
  });

  it('validates active service alerts format', () => {
    expect(INITIAL_ALERTS.length).toBeGreaterThan(0);
    INITIAL_ALERTS.forEach((alert) => {
      expect(alert.alertId).toBeDefined();
      expect(alert.title.length).toBeGreaterThan(0);
      expect(['info', 'warning', 'emergency']).toContain(alert.severity);
    });
  });

  it('structures digital ticketing with valid expiry and QR code payload', () => {
    const mockTicket: DigitalTicket = {
      ticketId: 'TCK-TEST99',
      userId: 'usr-1',
      routeId: 'route-05',
      routeName: 'Route 05',
      fromStop: 'Central Transit Hub',
      toStop: 'University Campus Gate',
      passengerName: 'Jane Doe',
      fare: 2.50,
      status: 'valid',
      qrCode: 'METROPULSE|TCK-TEST99|Central|Univ',
      purchaseTime: new Date().toISOString(),
      expiryTime: new Date(Date.now() + 10800000).toISOString(),
    };

    expect(mockTicket.status).toBe('valid');
    expect(mockTicket.qrCode).toContain('METROPULSE');
    expect(new Date(mockTicket.expiryTime).getTime()).toBeGreaterThan(new Date(mockTicket.purchaseTime).getTime());
  });
});
