import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Bus, TransitRoute, BusStop } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Crosshair } from 'lucide-react';

interface TransitMapProps {
  buses: Bus[];
  routes: TransitRoute[];
  selectedRouteId?: string;
  selectedBusId?: string;
  selectedStopId?: string;
  onSelectBus?: (bus: Bus) => void;
  onSelectStop?: (stop: BusStop, route: TransitRoute) => void;
  driverMarkerPos?: [number, number];
  isSimulatedTrip?: boolean;
}

export const TransitMap: React.FC<TransitMapProps> = ({
  buses,
  routes,
  selectedRouteId,
  selectedBusId,
  selectedStopId,
  onSelectBus,
  onSelectStop,
  driverMarkerPos,
  isSimulatedTrip,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const polylinesLayerRef = useRef<L.LayerGroup | null>(null);
  const { isDarkMode } = useAuth();

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = [37.7780, -122.4150];
    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 13,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const tileUrl = isDarkMode
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    const tileLayer = L.tileLayer(tileUrl, {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = tileLayer;
    polylinesLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer on Dark Mode Toggle
  useEffect(() => {
    if (!tileLayerRef.current || !mapInstanceRef.current) return;
    const tileUrl = isDarkMode
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    tileLayerRef.current.setUrl(tileUrl);
  }, [isDarkMode]);

  // Render Routes and Polylines
  useEffect(() => {
    if (!polylinesLayerRef.current || !mapInstanceRef.current) return;
    polylinesLayerRef.current.clearLayers();

    const routesToRender = selectedRouteId
      ? routes.filter((r) => r.routeId === selectedRouteId)
      : routes;

    routesToRender.forEach((route) => {
      const isSelected = route.routeId === selectedRouteId;
      const polylinePoints = route.waypoints.length > 0
        ? route.waypoints
        : route.stops.map((s) => [s.latitude, s.longitude] as [number, number]);

      // Outer glow for selected route
      if (isSelected) {
        L.polyline(polylinePoints, {
          color: route.color,
          weight: 9,
          opacity: 0.35,
          lineCap: 'round',
        }).addTo(polylinesLayerRef.current!);
      }

      // Main line
      L.polyline(polylinePoints, {
        color: route.color,
        weight: isSelected ? 5 : 3.5,
        opacity: isSelected ? 0.95 : 0.65,
        dashArray: isSelected ? undefined : '6, 6',
        lineCap: 'round',
      }).addTo(polylinesLayerRef.current!);
    });
  }, [routes, selectedRouteId]);

  // Render Stops and Buses
  useEffect(() => {
    if (!markersLayerRef.current || !mapInstanceRef.current) return;
    markersLayerRef.current.clearLayers();

    const activeRoutes = selectedRouteId
      ? routes.filter((r) => r.routeId === selectedRouteId)
      : routes;

    // 1. Bus Stops
    activeRoutes.forEach((route) => {
      route.stops.forEach((stop) => {
        const isStopSelected = stop.stopId === selectedStopId;
        const stopIcon = L.divIcon({
          className: 'custom-stop-icon',
          html: `
            <div style="
              width: ${isStopSelected ? '22px' : '16px'};
              height: ${isStopSelected ? '22px' : '16px'};
              background: ${isStopSelected ? '#f59e0b' : '#ffffff'};
              border: 3px solid ${route.color};
              border-radius: 50%;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              cursor: pointer;
              transition: transform 0.2s ease;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="width: 5px; height: 5px; background: ${route.color}; border-radius: 50%;"></div>
            </div>
          `,
          iconSize: [isStopSelected ? 22 : 16, isStopSelected ? 22 : 16],
          iconAnchor: [isStopSelected ? 11 : 8, isStopSelected ? 11 : 8],
        });

        const stopMarker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon })
          .addTo(markersLayerRef.current!);

        stopMarker.on('click', () => {
          if (onSelectStop) onSelectStop(stop, route);
        });

        stopMarker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 13px; line-height: 1.4; padding: 2px;">
            <div style="font-weight: 700; color: #1e293b;">${stop.stopName}</div>
            <div style="color: #64748b; font-size: 11px;">${stop.landmark || 'Stop #' + stop.stopOrder}</div>
            <div style="margin-top: 6px; display: inline-block; padding: 2px 8px; border-radius: 12px; background: ${route.color}20; color: ${route.color}; font-weight: 600; font-size: 11px;">
              ${route.routeName}
            </div>
          </div>
        `);
      });
    });

    // 2. Active Fleet Buses
    buses.forEach((bus) => {
      if (bus.status === 'Offline') return;
      const isBusSelected = bus.busId === selectedBusId;
      const isDelayed = bus.status === 'Delayed' || bus.currentDelay >= 4;

      const badgeColor = isDelayed ? '#ef4444' : '#10b981';
      const borderPulse = isBusSelected ? 'border: 3px solid #3b82f6; animation: pulse 1.5s infinite;' : '';

      const busIcon = L.divIcon({
        className: 'custom-bus-icon',
        html: `
          <div style="
            position: relative;
            width: 40px;
            height: 40px;
            background: ${isDelayed ? '#fee2e2' : '#ecfdf5'};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            cursor: pointer;
            ${borderPulse}
          ">
            <div style="
              width: 28px;
              height: 28px;
              background: ${badgeColor};
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: 800;
              font-size: 11px;
            ">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.6-.4-1-1-1H3c-.6 0-1 .4-1 1 0 .4.1.8.2 1.2l.8 2.8h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>
            </div>
            <div style="
              position: absolute;
              bottom: -6px;
              background: #0f172a;
              color: #f8fafc;
              font-size: 9px;
              font-weight: 700;
              padding: 1px 4px;
              border-radius: 4px;
              white-space: nowrap;
              border: 1px solid rgba(255,255,255,0.2);
            ">
              ${bus.busNumber.split('-')[0].replace('Bus ', '')}
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const busMarker = L.marker([bus.currentLat, bus.currentLng], { icon: busIcon })
        .addTo(markersLayerRef.current!);

      busMarker.on('click', () => {
        if (onSelectBus) onSelectBus(bus);
      });

      busMarker.bindPopup(`
        <div style="font-family: sans-serif; min-width: 170px; font-size: 12px; line-height: 1.4;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 800; font-size: 13px; color: #0f172a;">${bus.busNumber}</span>
            <span style="font-size: 10px; padding: 2px 6px; border-radius: 8px; font-weight: 700; background: ${badgeColor}20; color: ${badgeColor};">
              ${bus.status}
            </span>
          </div>
          <div style="color: #64748b; font-size: 11px; margin-top: 2px;">Driver: ${bus.driverName}</div>
          <div style="margin-top: 6px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: #f1f5f9; padding: 6px; border-radius: 6px;">
            <div><span style="color:#64748b;">Speed:</span> <b>${Math.round(bus.currentSpeed)} km/h</b></div>
            <div><span style="color:#64748b;">Delay:</span> <b style="color:${isDelayed ? '#ef4444' : '#10b981'};">${bus.currentDelay}m</b></div>
            <div><span style="color:#64748b;">Load:</span> <b>${Math.round((bus.currentOccupancy / bus.capacity) * 100)}%</b></div>
            <div><span style="color:#64748b;">Mode:</span> <b>${bus.isSimulated ? 'GPS Sim' : 'Live Phone'}</b></div>
          </div>
        </div>
      `);
    });

    // 3. Driver Live GPS Pin (if active)
    if (driverMarkerPos) {
      const driverIcon = L.divIcon({
        className: 'driver-gps-icon',
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background: #3b82f6;
            border: 3px solid #ffffff;
            border-radius: 50%;
            box-shadow: 0 0 15px rgba(59, 130, 246, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: pulse 1.2s infinite;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="#3b82f6"/></svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker(driverMarkerPos, { icon: driverIcon })
        .addTo(markersLayerRef.current!)
        .bindPopup(`<b>Driver Location (${isSimulatedTrip ? 'GPS Route Simulation' : 'Live Phone GPS'})</b>`);
    }
  }, [buses, routes, selectedRouteId, selectedBusId, selectedStopId, driverMarkerPos, isSimulatedTrip]);

  // Center on selected bus or stop
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (selectedBusId) {
      const bus = buses.find((b) => b.busId === selectedBusId);
      if (bus) {
        mapInstanceRef.current.panTo([bus.currentLat, bus.currentLng], { animate: true });
      }
    }
  }, [selectedBusId, buses]);

  const handleCenterFleet = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([37.7780, -122.4150], 13, { animate: true });
  };

  return (
    <div className="relative w-full h-full min-h-[400px] overflow-hidden rounded-2xl shadow-inner border border-slate-200 dark:border-slate-800">
      <div ref={mapContainerRef} className="w-full h-full min-h-[400px] z-0" />

      {/* Floating Map Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={handleCenterFleet}
          className="p-2.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
          title="Center Transit Map"
        >
          <Crosshair className="w-4 h-4 text-blue-500" />
          <span className="hidden sm:inline">Center Fleet</span>
        </button>
      </div>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-10 p-2.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl shadow-md border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>On Time</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
          <span>Delayed (≥4m)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full border-2 border-blue-500 bg-white"></span>
          <span>Stop</span>
        </div>
      </div>
    </div>
  );
};
