import { TransitRoute, Bus, ETAPrediction, TransferRouteOption, BusStop } from '../types';

/**
 * Calculates Haversine distance in kilometers between two GPS coordinates
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Predicts Estimated Arrival Time (ETA) to a target bus stop
 * considering bus speed, distance, dwell time at intermediate stops, and traffic delays
 */
export function predictETA(
  bus: Bus,
  route: TransitRoute,
  targetStop: BusStop,
  currentStopIndex?: number
): ETAPrediction {
  const distanceKm = calculateDistanceKm(bus.currentLat, bus.currentLng, targetStop.latitude, targetStop.longitude);
  
  // Effective speed in km/h (fallback to 25 km/h if bus is idling or stopped at signal)
  const effectiveSpeed = Math.max(bus.currentSpeed > 5 ? bus.currentSpeed : 22, 10);
  
  // Base travel time based on distance and speed (in minutes)
  const rawTravelMinutes = (distanceKm / effectiveSpeed) * 60;
  
  // Dwell time: 1.2 minutes per stop between current bus location and target stop
  const targetIndex = route.stops.findIndex((s) => s.stopId === targetStop.stopId);
  const fromIndex = currentStopIndex !== undefined ? currentStopIndex : 0;
  const intermediateStops = Math.max(0, targetIndex - fromIndex);
  const dwellTimeMinutes = intermediateStops * 1.2;
  
  // Current reported traffic delay
  const trafficDelayMinutes = Math.max(0, bus.currentDelay || 0);
  
  // Total calculated ETA
  const totalMinutes = Math.max(1, Math.round(rawTravelMinutes + dwellTimeMinutes + trafficDelayMinutes));
  
  // Scheduled baseline without delay
  const scheduledMinutes = Math.max(1, Math.round(rawTravelMinutes + dwellTimeMinutes));
  
  // Status determination
  let status: 'On Time' | 'Delayed' | 'Early' = 'On Time';
  if (trafficDelayMinutes >= 4) {
    status = 'Delayed';
  } else if (trafficDelayMinutes === 0 && effectiveSpeed > 30) {
    status = 'Early';
  }

  // Confidence score: based on speed stability and distance
  // Closer buses and stable speeds yield higher confidence
  const distanceFactor = Math.max(0.7, 1 - (distanceKm / 40));
  const confidenceScore = Math.min(99, Math.round(distanceFactor * 98));

  // Formatted string
  let formattedArrival = `${totalMinutes} min`;
  if (totalMinutes <= 1) {
    formattedArrival = 'Arriving now (< 1m)';
  } else if (totalMinutes < 60) {
    formattedArrival = `${totalMinutes} mins`;
  } else {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    formattedArrival = `${hours}h ${mins}m`;
  }

  return {
    targetStopName: targetStop.stopName,
    targetStopId: targetStop.stopId,
    distanceKm,
    currentSpeedKmh: Math.round(bus.currentSpeed),
    estimatedMinutes: totalMinutes,
    scheduledMinutes,
    delayMinutes: trafficDelayMinutes,
    dwellTimeMinutes: Math.round(dwellTimeMinutes * 10) / 10,
    status,
    confidenceScore,
    formattedArrival,
  };
}

/**
 * Searches routes connecting an origin stop and a destination stop.
 * Returns direct routes if available; otherwise calculates multi-leg transfer routes!
 */
export function findRoutesBetweenStops(
  routes: TransitRoute[],
  buses: Bus[],
  fromStopName: string,
  toStopName: string
): TransferRouteOption[] {
  if (!fromStopName || !toStopName || fromStopName === toStopName) {
    return [];
  }

  const cleanFrom = fromStopName.trim().toLowerCase();
  const cleanTo = toStopName.trim().toLowerCase();

  const results: TransferRouteOption[] = [];

  // 1. Direct Routes Search
  for (const route of routes) {
    const fromIdx = route.stops.findIndex((s) => s.stopName.toLowerCase().includes(cleanFrom));
    const toIdx = route.stops.findIndex((s) => s.stopName.toLowerCase().includes(cleanTo));

    if (fromIdx !== -1 && toIdx !== -1 && fromIdx < toIdx) {
      const stopsCount = toIdx - fromIdx;
      const legDuration = Math.round((stopsCount / route.stops.length) * route.estimatedDuration);
      const approachingBus = buses.find((b) => b.routeId === route.routeId && b.status !== 'Offline');
      const etaMinutes = approachingBus ? Math.max(2, Math.round(legDuration * 0.8)) : legDuration;

      results.push({
        type: 'direct',
        totalDurationMinutes: legDuration,
        totalFare: route.fare,
        legs: [
          {
            route,
            fromStop: route.stops[fromIdx].stopName,
            toStop: route.stops[toIdx].stopName,
            stopsCount,
            busApproaching: approachingBus,
            etaMinutes,
          },
        ],
      });
    }
  }

  // 2. Transfer Route Search (if none or as alternatives)
  for (const routeA of routes) {
    const fromIdx = routeA.stops.findIndex((s) => s.stopName.toLowerCase().includes(cleanFrom));
    if (fromIdx === -1) continue;

    for (const routeB of routes) {
      if (routeA.routeId === routeB.routeId) continue;
      const toIdx = routeB.stops.findIndex((s) => s.stopName.toLowerCase().includes(cleanTo));
      if (toIdx === -1) continue;

      // Find common transfer stop between routeA (after fromIdx) and routeB (before toIdx)
      for (let i = fromIdx + 1; i < routeA.stops.length; i++) {
        const stopA = routeA.stops[i];
        const matchInBIdx = routeB.stops.findIndex(
          (sb, idx) => idx < toIdx && sb.stopName.toLowerCase() === stopA.stopName.toLowerCase()
        );

        if (matchInBIdx !== -1) {
          const stopsCountA = i - fromIdx;
          const stopsCountB = toIdx - matchInBIdx;

          const durationA = Math.round((stopsCountA / routeA.stops.length) * routeA.estimatedDuration);
          const durationB = Math.round((stopsCountB / routeB.stops.length) * routeB.estimatedDuration);
          const transferWaitTime = 5; // standard transfer connection allowance
          const totalDuration = durationA + durationB + transferWaitTime;

          const busA = buses.find((b) => b.routeId === routeA.routeId && b.status !== 'Offline');
          const busB = buses.find((b) => b.routeId === routeB.routeId && b.status !== 'Offline');

          results.push({
            type: 'transfer',
            transferStop: stopA.stopName,
            totalDurationMinutes: totalDuration,
            totalFare: Math.round((routeA.fare + routeB.fare * 0.7) * 100) / 100, // Integrated fare discount
            walkingDistanceMeters: 45, // cross-platform transfer
            legs: [
              {
                route: routeA,
                fromStop: routeA.stops[fromIdx].stopName,
                toStop: stopA.stopName,
                stopsCount: stopsCountA,
                busApproaching: busA,
                etaMinutes: durationA,
              },
              {
                route: routeB,
                fromStop: routeB.stops[matchInBIdx].stopName,
                toStop: routeB.stops[toIdx].stopName,
                stopsCount: stopsCountB,
                busApproaching: busB,
                etaMinutes: durationB,
              },
            ],
          });
          break; // Stop after first optimal transfer point for this pair
        }
      }
    }
  }

  // Sort: Direct first, then by shortest totalDurationMinutes
  results.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'direct' ? -1 : 1;
    return a.totalDurationMinutes - b.totalDurationMinutes;
  });

  return results;
}
