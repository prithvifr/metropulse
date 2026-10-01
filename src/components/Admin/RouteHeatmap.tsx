import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { TransitRoute, Bus } from '../../types';
import { Flame, Route as RouteIcon, MapPin, Lightbulb } from 'lucide-react';

interface RouteHeatmapProps {
  routes: TransitRoute[];
  buses: Bus[];
}

export type HeatMetric = 'passenger_demand' | 'traffic_congestion' | 'bus_frequency';

interface StopDemandData {
  stopId: string;
  stopName: string;
  latitude: number;
  longitude: number;
  routeId: string;
  routeName: string;
  baseDemand: number; // Pax per hour
  congestionIndex: number; // 0 - 100%
  hourlyMultiplier: number;
  currentDemand: number;
}

interface CorridorHeatData {
  routeId: string;
  routeNumber: string;
  routeName: string;
  color: string;
  waypoints: [number, number][];
  totalDemand: number;
  avgCongestion: number;
  busCount: number;
}

export const RouteHeatmap: React.FC<RouteHeatmapProps> = ({ routes, buses }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Time-of-day slider (6:00 to 23:00)
  const [selectedHour, setSelectedHour] = useState<number>(8); // Default 8:00 AM morning peak
  const [selectedMetric, setSelectedMetric] = useState<HeatMetric>('passenger_demand');
  const [showVehicleMarkers, setShowVehicleMarkers] = useState<boolean>(true);
  const [showHeatHalos, setShowHeatHalos] = useState<boolean>(true);
  const [selectedCorridorId, setSelectedCorridorId] = useState<string>('all');
  const [hoveredEntity, setHoveredEntity] = useState<{
    type: 'stop' | 'corridor' | 'bus';
    title: string;
    subtitle: string;
    metricLabel: string;
    metricValue: string;
    status: string;
    x: number;
    y: number;
  } | null>(null);

  // Time-of-day passenger demand curve multiplier
  // Peak 1: 08:00 (1.8x), Peak 2: 17:30 (1.9x), Midday: 12:00 (1.1x), Night: 22:00 (0.4x)
  const getHourMultiplier = (hour: number) => {
    if (hour >= 7 && hour <= 9) return 1.85; // Morning rush
    if (hour >= 16 && hour <= 19) return 1.95; // Evening rush
    if (hour >= 11 && hour <= 14) return 1.15; // Midday lunch
    if (hour >= 21) return 0.45; // Late evening
    return 0.8;
  };

  const hourMultiplier = useMemo(() => getHourMultiplier(selectedHour), [selectedHour]);

  // Aggregate and score all stops with real baseline traffic and multiplier
  const stopDemands = useMemo<StopDemandData[]>(() => {
    const list: StopDemandData[] = [];

    routes.forEach((route) => {
      route.stops.forEach((stop, idx) => {
        // Base weights depending on stop significance
        let base = 850;
        let baseCongestion = 45;

        const nameLower = stop.stopName.toLowerCase();
        if (nameLower.includes('hub') || nameLower.includes('central') || nameLower.includes('station')) {
          base = 2800;
          baseCongestion = 82;
        } else if (nameLower.includes('university') || nameLower.includes('tech park') || nameLower.includes('market')) {
          base = 2200;
          baseCongestion = 75;
        } else if (nameLower.includes('airport') || nameLower.includes('harbor')) {
          base = 1900;
          baseCongestion = 68;
        } else if (nameLower.includes('medical') || nameLower.includes('center')) {
          base = 1400;
          baseCongestion = 58;
        }

        // Adjust based on hour
        const calculatedDemand = Math.round(base * hourMultiplier);
        const calculatedCongestion = Math.min(98, Math.round(baseCongestion * (0.6 + hourMultiplier * 0.4)));

        list.push({
          stopId: stop.stopId || `${route.routeId}-stop-${idx}`,
          stopName: stop.stopName,
          latitude: stop.latitude,
          longitude: stop.longitude,
          routeId: route.routeId,
          routeName: route.routeName,
          baseDemand: base,
          congestionIndex: calculatedCongestion,
          hourlyMultiplier: hourMultiplier,
          currentDemand: calculatedDemand,
        });
      });
    });

    return list;
  }, [routes, hourMultiplier]);

  // Corridor aggregate heat metrics
  const corridorHeats = useMemo<CorridorHeatData[]>(() => {
    return routes.map((route) => {
      const routeStops = stopDemands.filter((s) => s.routeId === route.routeId);
      const totalDemand = routeStops.reduce((sum, s) => sum + s.currentDemand, 0);
      const avgCongestion = routeStops.length > 0
        ? Math.round(routeStops.reduce((sum, s) => sum + s.congestionIndex, 0) / routeStops.length)
        : 50;

      const assignedBuses = buses.filter((b) => b.routeId === route.routeId);

      // Reconstruct or extract polyline waypoints
      const waypoints: [number, number][] =
        route.waypoints && route.waypoints.length > 0
          ? route.waypoints
          : route.stops.map((s) => [s.latitude, s.longitude] as [number, number]);

      return {
        routeId: route.routeId,
        routeNumber: route.routeNumber,
        routeName: route.routeName,
        color: route.color || '#3b82f6',
        waypoints,
        totalDemand,
        avgCongestion,
        busCount: assignedBuses.length,
      };
    });
  }, [routes, stopDemands, buses]);

  // D3 Heatmap Rendering Engine
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clean redraw

    const width = 860;
    const height = 520;
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };

    // Extract all coordinate extents to build an exact Mercator / Cartesian map projection
    const allLats: number[] = [];
    const allLngs: number[] = [];

    routes.forEach((r) => {
      r.stops.forEach((s) => {
        allLats.push(s.latitude);
        allLngs.push(s.longitude);
      });
      if (r.waypoints) {
        r.waypoints.forEach((pt) => {
          allLats.push(pt[0]);
          allLngs.push(pt[1]);
        });
      }
    });

    if (allLats.length === 0 || allLngs.length === 0) return;

    const minLat = d3.min(allLats)!;
    const maxLat = d3.max(allLats)!;
    const minLng = d3.min(allLngs)!;
    const maxLng = d3.max(allLngs)!;

    const latPad = (maxLat - minLat) * 0.1 || 0.01;
    const lngPad = (maxLng - minLng) * 0.1 || 0.01;

    // Linear spatial scale mapping Longitude (X) and Latitude (Y - inverted)
    const xScale = d3
      .scaleLinear()
      .domain([minLng - lngPad, maxLng + lngPad])
      .range([margin.left, width - margin.right]);

    const yScale = d3
      .scaleLinear()
      .domain([minLat - latPad, maxLat + latPad])
      .range([height - margin.bottom, margin.top]);

    // Defs for Glow Filters and Radial Heat Gradients
    const defs = svg.append('defs');

    // 1. Heat Glow Filter
    const filter = defs.append('filter').attr('id', 'heat-blur').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur').attr('stdDeviation', '6').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // 2. High-Demand Radial Gradients (Crimson / Ember / Amber)
    const radHeatRed = defs.append('radialGradient').attr('id', 'grad-heat-severe');
    radHeatRed.append('stop').attr('offset', '0%').attr('stop-color', '#ef4444').attr('stop-opacity', '0.85');
    radHeatRed.append('stop').attr('offset', '45%').attr('stop-color', '#f97316').attr('stop-opacity', '0.45');
    radHeatRed.append('stop').attr('offset', '100%').attr('stop-color', '#dc2626').attr('stop-opacity', '0');

    const radHeatYellow = defs.append('radialGradient').attr('id', 'grad-heat-medium');
    radHeatYellow.append('stop').attr('offset', '0%').attr('stop-color', '#eab308').attr('stop-opacity', '0.8');
    radHeatYellow.append('stop').attr('offset', '50%').attr('stop-color', '#84cc16').attr('stop-opacity', '0.35');
    radHeatYellow.append('stop').attr('offset', '100%').attr('stop-color', '#eab308').attr('stop-opacity', '0');

    const radHeatCyan = defs.append('radialGradient').attr('id', 'grad-heat-normal');
    radHeatCyan.append('stop').attr('offset', '0%').attr('stop-color', '#06b6d4').attr('stop-opacity', '0.7');
    radHeatCyan.append('stop').attr('offset', '55%').attr('stop-color', '#3b82f6').attr('stop-opacity', '0.25');
    radHeatCyan.append('stop').attr('offset', '100%').attr('stop-color', '#06b6d4').attr('stop-opacity', '0');

    // Subtle dark map background grid lines
    const gridGroup = svg.append('g').attr('class', 'map-grid').attr('opacity', 0.15);

    for (let x = margin.left; x <= width - margin.right; x += 50) {
      gridGroup.append('line').attr('x1', x).attr('y1', margin.top).attr('x2', x).attr('y2', height - margin.bottom).attr('stroke', '#64748b').attr('stroke-width', 0.5).attr('stroke-dasharray', '2,4');
    }
    for (let y = margin.top; y <= height - margin.bottom; y += 45) {
      gridGroup.append('line').attr('x1', margin.left).attr('y1', y).attr('x2', width - margin.right).attr('y2', y).attr('stroke', '#64748b').attr('stroke-width', 0.5).attr('stroke-dasharray', '2,4');
    }

    // Color interpolation scale for corridor lines
    const heatColorScale = d3
      .scaleSequential()
      .domain([40, 95])
      .interpolator(d3.interpolateRgbBasis(['#10b981', '#06b6d4', '#eab308', '#f97316', '#ef4444']));

    // Line generator for routes with natural curved street segments
    const lineGenerator = d3
      .line<[number, number]>()
      .x((d) => xScale(d[1]))
      .y((d) => yScale(d[0]))
      .curve(d3.curveCatmullRom.alpha(0.5));

    // ----------------------------------------------------
    // LAYER 1: AMBIENT CORRIDOR HEAT GLOW TRACKS (D3 Paths)
    // ----------------------------------------------------
    const corridorGlowGroup = svg.append('g').attr('class', 'corridor-glow');

    corridorHeats.forEach((corridor) => {
      if (selectedCorridorId !== 'all' && corridor.routeId !== selectedCorridorId) return;

      const pathData = lineGenerator(corridor.waypoints);
      if (!pathData) return;

      // Metric determining stroke weight & intensity
      let heatVal = corridor.avgCongestion;
      if (selectedMetric === 'passenger_demand') {
        heatVal = Math.min(95, Math.round((corridor.totalDemand / 6000) * 100));
      } else if (selectedMetric === 'bus_frequency') {
        heatVal = Math.min(95, corridor.busCount * 30);
      }

      const corridorColor = heatColorScale(heatVal);

      // Ambient wide blur layer
      if (showHeatHalos) {
        corridorGlowGroup
          .append('path')
          .attr('d', pathData)
          .attr('fill', 'none')
          .attr('stroke', corridorColor)
          .attr('stroke-width', Math.max(12, heatVal / 4.5))
          .attr('stroke-opacity', 0.28)
          .attr('stroke-linecap', 'round')
          .attr('stroke-linejoin', 'round')
          .attr('filter', 'url(#heat-blur)');
      }

      // Main corridor pipeline
      const mainPath = corridorGlowGroup
        .append('path')
        .attr('d', pathData)
        .attr('fill', 'none')
        .attr('stroke', corridorColor)
        .attr('stroke-width', Math.max(3.5, heatVal / 14))
        .attr('stroke-opacity', 0.88)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .style('cursor', 'pointer');

      // Pulse flow dashed line for heavy corridors
      if (heatVal >= 60) {
        corridorGlowGroup
          .append('path')
          .attr('d', pathData)
          .attr('fill', 'none')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0.6)
          .attr('stroke-dasharray', '8,12')
          .attr('stroke-linecap', 'round')
          .attr('class', 'flow-dash-pulse');
      }

      // Interactive hover
      mainPath
        .on('mouseenter', (event) => {
          mainPath.attr('stroke-width', 7).attr('stroke', '#ffffff');
          const [mx, my] = d3.pointer(event, svgRef.current);
          setHoveredEntity({
            type: 'corridor',
            title: corridor.routeName,
            subtitle: `Line ${corridor.routeNumber} Transit Arterial`,
            metricLabel:
              selectedMetric === 'passenger_demand'
                ? 'Total Hourly Demand'
                : selectedMetric === 'traffic_congestion'
                ? 'Congestion Index'
                : 'Active Fleet Units',
            metricValue:
              selectedMetric === 'passenger_demand'
                ? `${corridor.totalDemand.toLocaleString()} pax/hr`
                : selectedMetric === 'traffic_congestion'
                ? `${corridor.avgCongestion}% Peak Friction`
                : `${corridor.busCount} Active Buses`,
            status: corridor.avgCongestion >= 75 ? 'Heavy Corridor Strain' : 'Flowing Smoothly',
            x: mx,
            y: my,
          });
        })
        .on('mouseleave', () => {
          mainPath.attr('stroke-width', Math.max(3.5, heatVal / 14)).attr('stroke', corridorColor);
          setHoveredEntity(null);
        });
    });

    // ----------------------------------------------------
    // LAYER 2: PEAK PASSENGER DEMAND NODES (Stops & Halos)
    // ----------------------------------------------------
    const stopNodesGroup = svg.append('g').attr('class', 'stop-demand-nodes');

    // Deduplicate stops by coordinates so transfer hubs don't overlap awkwardly
    const uniqueStopsMap = new Map<string, StopDemandData>();
    stopDemands.forEach((stop) => {
      if (selectedCorridorId !== 'all' && stop.routeId !== selectedCorridorId) return;
      const key = `${stop.latitude.toFixed(4)}-${stop.longitude.toFixed(4)}`;
      if (!uniqueStopsMap.has(key)) {
        uniqueStopsMap.set(key, stop);
      } else {
        // Aggregate demand for transfer hub
        const existing = uniqueStopsMap.get(key)!;
        existing.currentDemand += stop.currentDemand;
        existing.congestionIndex = Math.max(existing.congestionIndex, stop.congestionIndex);
      }
    });

    uniqueStopsMap.forEach((stop) => {
      const cx = xScale(stop.longitude);
      const cy = yScale(stop.latitude);

      const isHighDemand = stop.currentDemand >= 2200;
      const isMediumDemand = stop.currentDemand >= 1300;

      const haloRadius = Math.min(46, Math.max(16, stop.currentDemand / 75));
      const gradId = isHighDemand ? 'url(#grad-heat-severe)' : isMediumDemand ? 'url(#grad-heat-medium)' : 'url(#grad-heat-cyan)';

      // 1. Radiating Outer Heat Dispersion Halo
      if (showHeatHalos) {
        stopNodesGroup
          .append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', haloRadius)
          .attr('fill', gradId)
          .attr('filter', 'url(#heat-blur)');
      }

      // 2. Animated Pulse Rings for top hubs
      if (isHighDemand) {
        stopNodesGroup
          .append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', haloRadius * 0.75)
          .attr('fill', 'none')
          .attr('stroke', '#ef4444')
          .attr('stroke-width', 1.5)
          .attr('stroke-opacity', 0.6)
          .attr('class', 'animate-ping');
      }

      // 3. Central Anchor Stop Node
      const nodeCircle = stopNodesGroup
        .append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', isHighDemand ? 7 : isMediumDemand ? 5.5 : 4)
        .attr('fill', isHighDemand ? '#ef4444' : isMediumDemand ? '#f59e0b' : '#06b6d4')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2)
        .attr('class', 'transition-all cursor-pointer shadow-md');

      // Stop Name Label
      if (isHighDemand || stop.stopName.includes('Hub') || stop.stopName.includes('Gate') || stop.stopName.includes('Tech')) {
        stopNodesGroup
          .append('text')
          .attr('x', cx)
          .attr('y', cy - 12)
          .attr('text-anchor', 'middle')
          .attr('fill', '#ffffff')
          .attr('font-size', '10px')
          .attr('font-weight', '800')
          .attr('paint-order', 'stroke')
          .attr('stroke', '#020617')
          .attr('stroke-width', 3)
          .text(stop.stopName.replace('Central ', '').replace('International ', ''));

        // Hourly Demand Badge
        stopNodesGroup
          .append('text')
          .attr('x', cx)
          .attr('y', cy + 18)
          .attr('text-anchor', 'middle')
          .attr('fill', isHighDemand ? '#fca5a5' : '#fde047')
          .attr('font-size', '9px')
          .attr('font-weight', '700')
          .attr('font-family', 'monospace')
          .attr('paint-order', 'stroke')
          .attr('stroke', '#020617')
          .attr('stroke-width', 2)
          .text(`${stop.currentDemand.toLocaleString()} pax/h`);
      }

      // Hover Tooltip Trigger
      nodeCircle
        .on('mouseenter', (event) => {
          nodeCircle.attr('r', 10).attr('stroke', '#38bdf8');
          const [mx, my] = d3.pointer(event, svgRef.current);
          setHoveredEntity({
            type: 'stop',
            title: stop.stopName,
            subtitle: `Transit Node · Connected to ${stop.routeName.split(':')[0]}`,
            metricLabel: 'Hourly Boarding Demand',
            metricValue: `${stop.currentDemand.toLocaleString()} passengers / hour`,
            status:
              stop.congestionIndex >= 75
                ? 'Severe Platform Crowding (Peak Surge)'
                : stop.congestionIndex >= 50
                ? 'Moderate Boarding Rate'
                : 'Light Free-Flowing Volume',
            x: mx,
            y: my,
          });
        })
        .on('mouseleave', () => {
          nodeCircle.attr('r', isHighDemand ? 7 : isMediumDemand ? 5.5 : 4).attr('stroke', '#ffffff');
          setHoveredEntity(null);
        });
    });

    // ----------------------------------------------------
    // LAYER 3: REAL-TIME ACTIVE FLEET GPS POSITIONS
    // ----------------------------------------------------
    if (showVehicleMarkers) {
      const busGroup = svg.append('g').attr('class', 'live-buses-heatmap');

      buses.forEach((bus) => {
        if (!bus.currentLat || !bus.currentLng) return;
        if (selectedCorridorId !== 'all' && bus.routeId !== selectedCorridorId) return;

        const bx = xScale(bus.currentLng);
        const by = yScale(bus.currentLat);

        const busG = busGroup
          .append('g')
          .attr('transform', `translate(${bx}, ${by})`)
          .style('cursor', 'pointer');

        // Outer beacon ring
        busG
          .append('circle')
          .attr('r', 11)
          .attr('fill', bus.status === 'Delayed' ? '#f43f5e' : '#10b981')
          .attr('fill-opacity', 0.25)
          .attr('stroke', bus.status === 'Delayed' ? '#f43f5e' : '#10b981')
          .attr('stroke-width', 1.5);

        // Core marker
        busG
          .append('circle')
          .attr('r', 5.5)
          .attr('fill', bus.status === 'Delayed' ? '#e11d48' : '#059669')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.5);

        // Vehicle badge text
        busG
          .append('text')
          .attr('x', 9)
          .attr('y', 3)
          .attr('fill', '#a7f3d0')
          .attr('font-size', '9px')
          .attr('font-weight', '900')
          .attr('font-family', 'monospace')
          .attr('paint-order', 'stroke')
          .attr('stroke', '#020617')
          .attr('stroke-width', 2.5)
          .text(bus.busNumber.replace('Bus ', ''));

        busG
          .on('mouseenter', (event) => {
            const [mx, my] = d3.pointer(event, svgRef.current);
            setHoveredEntity({
              type: 'bus',
              title: `${bus.busNumber} (${bus.vehicleNumber})`,
              subtitle: `Driver: ${bus.driverName} · Speed: ${bus.currentSpeed} km/h`,
              metricLabel: 'Vehicle Delay',
              metricValue: bus.currentDelay > 0 ? `+${bus.currentDelay} mins delay` : 'On Schedule (0m delay)',
              status: bus.status === 'Delayed' ? 'Delayed by Traffic Friction' : 'En Route Telemetry Active',
              x: mx,
              y: my,
            });
          })
          .on('mouseleave', () => {
            setHoveredEntity(null);
          });
      });
    }
  }, [
    routes,
    buses,
    stopDemands,
    corridorHeats,
    selectedMetric,
    selectedCorridorId,
    showHeatHalos,
    showVehicleMarkers,
  ]);

  // Top Congested Corridors Leaderboard
  const topCorridors = useMemo(() => {
    return [...corridorHeats].sort((a, b) => b.totalDemand - a.totalDemand);
  }, [corridorHeats]);

  // Top Demand Stops Leaderboard
  const topStops = useMemo(() => {
    return [...stopDemands]
      .sort((a, b) => b.currentDemand - a.currentDemand)
      .filter((s, idx, arr) => arr.findIndex((x) => x.stopName === s.stopName) === idx)
      .slice(0, 5);
  }, [stopDemands]);

  const formatHourString = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Interactive Scrubbing Toolbar */}
      <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-rose-500" />
              <h3 className="text-lg font-black text-white">
                D3.js Transit Corridor &amp; Passenger Demand Heatmap
              </h3>
              <span className="text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full">
                Live Spatial Intelligence
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Visualizing high-traffic transit corridors, peak boarding bottlenecks, and vehicle fleet density across metropolitan lines.
            </p>
          </div>

          {/* Quick Scenario Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 text-[11px] font-bold">Peak Rush Presets:</span>
            {[
              { label: 'Morning Peak (08:00)', hour: 8 },
              { label: 'Midday (12:00)', hour: 12 },
              { label: 'Evening Surge (17:30)', hour: 17 },
              { label: 'Night Owl (22:00)', hour: 22 },
            ].map((preset) => (
              <button
                key={preset.hour}
                onClick={() => setSelectedHour(preset.hour)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                  selectedHour === preset.hour
                    ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/20'
                    : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-600'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrubbing Slider & Heat Metric Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80 items-center text-xs">
          {/* Time Slider */}
          <div className="space-y-1 md:col-span-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">
                Operating Schedule Time:{' '}
                <strong className="text-rose-400 font-mono text-sm">{formatHourString(selectedHour)}</strong>
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Hourly Rush Multiplier: <strong className="text-white">{hourMultiplier.toFixed(2)}x</strong>
              </span>
            </div>
            <input
              type="range"
              min="6"
              max="23"
              step="1"
              value={selectedHour}
              onChange={(e) => setSelectedHour(Number(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer h-2 bg-slate-950 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>06:00 AM (Early Run)</span>
              <span>12:00 PM (Noon)</span>
              <span>18:00 PM (Evening Peak)</span>
              <span>23:00 PM (Last Service)</span>
            </div>
          </div>

          {/* Metric Selector */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Active Heat Visualization Metric
            </span>
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-[10px] font-bold">
              <button
                onClick={() => setSelectedMetric('passenger_demand')}
                className={`py-1.5 rounded-xl transition-all ${
                  selectedMetric === 'passenger_demand'
                    ? 'bg-rose-500 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Demand (pax/h)
              </button>
              <button
                onClick={() => setSelectedMetric('traffic_congestion')}
                className={`py-1.5 rounded-xl transition-all ${
                  selectedMetric === 'traffic_congestion'
                    ? 'bg-amber-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Congestion %
              </button>
              <button
                onClick={() => setSelectedMetric('bus_frequency')}
                className={`py-1.5 rounded-xl transition-all ${
                  selectedMetric === 'bus_frequency'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Bus Density
              </button>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-2">
            <label className="text-slate-400 font-bold">Corridor Focus:</label>
            <select
              value={selectedCorridorId}
              onChange={(e) => setSelectedCorridorId(e.target.value)}
              className="p-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-semibold text-xs"
            >
              <option value="all">Entire Transit Network (All Lines)</option>
              {routes.map((r) => (
                <option key={r.routeId} value={r.routeId}>
                  {r.routeName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-slate-300 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={showHeatHalos}
                onChange={(e) => setShowHeatHalos(e.target.checked)}
                className="accent-rose-500 rounded"
              />
              <span>Radial Heat Dispersions</span>
            </label>

            <label className="flex items-center gap-1.5 text-slate-300 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={showVehicleMarkers}
                onChange={(e) => setShowVehicleMarkers(e.target.checked)}
                className="accent-emerald-500 rounded"
              />
              <span>Live Fleet Bus Telemetry</span>
            </label>
          </div>
        </div>
      </div>

      {/* 2. Main D3 SVG Canvas Area with Floating Interactive Inspector */}
      <div
        ref={containerRef}
        className="relative bg-slate-950 rounded-3xl border-2 border-slate-800 shadow-2xl overflow-hidden"
      >
        {/* Heatmap Legend */}
        <div className="absolute top-4 left-4 z-10 p-3 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 text-xs space-y-2 pointer-events-none shadow-lg">
          <span className="font-extrabold text-[10px] text-slate-400 uppercase tracking-wider block">
            Corridor Density Spectrum
          </span>
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <div className="w-24 h-2.5 rounded-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-rose-600"></div>
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 font-mono w-24">
            <span>Free</span>
            <span>Surge</span>
          </div>
        </div>

        {/* Live Buses Count Chip */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 p-2 px-3 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span className="text-white font-bold">{buses.length} Fleet GPS Units Grounded</span>
        </div>

        {/* D3 SVG Element */}
        <svg
          ref={svgRef}
          viewBox="0 0 860 520"
          className="w-full h-auto min-h-[440px] max-h-[580px] select-none"
        />

        {/* Hover Inspector Tooltip */}
        {hoveredEntity && (
          <div
            className="absolute z-20 pointer-events-none p-3.5 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-rose-500/40 shadow-2xl text-xs space-y-1 transform -translate-x-1/2 -translate-y-full mb-3"
            style={{ left: hoveredEntity.x, top: hoveredEntity.y }}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {hoveredEntity.type}
              </span>
              <b className="text-white text-xs font-black truncate max-w-[200px]">
                {hoveredEntity.title}
              </b>
            </div>
            <p className="text-[11px] text-slate-400">{hoveredEntity.subtitle}</p>
            <div className="pt-1 border-t border-slate-800 flex justify-between gap-4 font-mono">
              <span className="text-slate-400 text-[10px]">{hoveredEntity.metricLabel}:</span>
              <b className="text-rose-400 text-xs">{hoveredEntity.metricValue}</b>
            </div>
            <div className="text-[10px] text-amber-300 font-semibold">{hoveredEntity.status}</div>
          </div>
        )}
      </div>

      {/* 3. Deep Dive Leaderboards: High-Traffic Corridors & Peak Demand Points */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        {/* Top Corridors Leaderboard */}
        <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
              <RouteIcon className="w-4 h-4 text-indigo-400" />
              <span>High-Traffic Transit Corridors</span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                {topCorridors.length} Lines
              </span>
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">Ranked by Hourly Commuter Volume</span>
          </div>

          <div className="space-y-3">
            {topCorridors.map((c, idx) => {
              const demandPercent = Math.min(100, Math.round((c.totalDemand / 12000) * 100));
              return (
                <div key={c.routeId} className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-black text-xs">
                        #{idx + 1}
                      </span>
                      <b className="text-white text-xs">{c.routeName}</b>
                    </div>
                    <span className="text-xs font-mono font-black text-rose-400">
                      {c.totalDemand.toLocaleString()} pax/hr
                    </span>
                  </div>

                  {/* Visual Bar Gauge */}
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        c.avgCongestion >= 75
                          ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                          : 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                      }`}
                      style={{ width: `${demandPercent}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                    <span>Friction Index: <b className="text-white">{c.avgCongestion}%</b></span>
                    <span>Fleet Units Active: <b className="text-cyan-400">{c.busCount} Buses</b></span>
                    <span>Status: <b className={c.avgCongestion >= 75 ? 'text-rose-400' : 'text-emerald-400'}>
                      {c.avgCongestion >= 75 ? 'Congested Surge' : 'Optimal Flow'}
                    </b></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Peak Passenger Demand Points (Stops) */}
        <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-400" />
              <span>Peak Passenger Demand Points (Top Stops)</span>
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">Platform Congestion Hotspots</span>
          </div>

          <div className="space-y-3">
            {topStops.map((stop, idx) => {
              return (
                <div key={stop.stopId} className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center font-black text-rose-400 text-xs">
                      {idx + 1}
                    </div>
                    <div>
                      <h5 className="font-black text-white text-xs">{stop.stopName}</h5>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Corridor: {stop.routeName.split(':')[0]} · Platform Crowding: {stop.congestionIndex}%
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-black text-rose-300 block">
                      {stop.currentDemand.toLocaleString()}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 block font-bold">
                      Boarding / hr
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Intelligent Dispatch Recommendation Notice */}
          <div className="p-4 bg-indigo-950/40 rounded-2xl border border-indigo-500/30 text-[11px] text-indigo-200 space-y-1">
            <b className="font-bold flex items-center gap-1.5 text-indigo-300">
              <Lightbulb className="w-4 h-4 text-amber-400" /> Automated Capacity Dispatch Advisory:
            </b>
            <p className="text-slate-300">
              During <strong className="text-white">{formatHourString(selectedHour)}</strong>, Central Transit Hub and University Campus Gate operate above 85% platform capacity. The system recommends dispatching 2 additional express relief buses along Route 05 to maintain 8-minute headway.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
