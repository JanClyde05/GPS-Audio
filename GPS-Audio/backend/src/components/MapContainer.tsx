import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { GuardianEvent, ThemeMode } from '../types';
import { formatCoords, formatTime, formatBytes } from '../utils/formatters';
import { Crosshair, Maximize2, Layers, Volume2, Copy, Check, Radio } from 'lucide-react';

interface MapContainerProps {
  events: GuardianEvent[];
  theme: ThemeMode;
  onSelectEvent: (event: GuardianEvent) => void;
  selectedEventId?: string;
}

export const MapContainer: React.FC<MapContainerProps> = ({
  events,
  theme,
  onSelectEvent,
  selectedEventId,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.FeatureGroup | null>(null);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [mapStyle, setMapStyle] = useState<'monochrome' | 'standard'>('monochrome');

  const telemetryEvt = events.find((e) => e.isTelemetry) || (events[0]?.isTelemetry ? events[0] : null);
  const activeEvt = telemetryEvt || events[0] || null;

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = activeEvt?.lat && activeEvt.lat !== 0 ? activeEvt.lat : 17.649834;
    const initialLon = activeEvt?.lon && activeEvt.lon !== 0 ? activeEvt.lon : 121.744034;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([initialLat, initialLon], 15);

    // Modern clean tile layer
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const markersGroup = L.featureGroup().addTo(map);
    markersGroupRef.current = markersGroup;
    mapInstanceRef.current = map;

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map tiles & markers when events or theme change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    if (events.length === 0) return;

    const bounds: [number, number][] = [];

    events.forEach((evt) => {
      if (!evt.lat || !evt.lon || (evt.lat === 0 && evt.lon === 0)) return;

      const isLive = evt.isTelemetry === true;
      const isSelected = evt.id === selectedEventId;

      // Custom high-fidelity SVG icon for Leaflet
      const iconHtml = isLive
        ? `
          <div class="relative flex items-center justify-center w-8 h-8">
            <div class="absolute w-8 h-8 rounded-full bg-emerald-500/30 pulse-ring"></div>
            <div class="w-4 h-4 rounded-full bg-neutral-950 dark:bg-white border-2 border-white dark:border-neutral-950 shadow-md flex items-center justify-center">
              <div class="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
            </div>
          </div>
        `
        : `
          <div class="relative flex items-center justify-center w-7 h-7 cursor-pointer group">
            <div class="w-6 h-6 rounded-full ${
              isSelected
                ? 'bg-rose-600 ring-4 ring-rose-300 dark:ring-rose-900/50'
                : 'bg-neutral-900 dark:bg-neutral-100'
            } text-white dark:text-neutral-900 border border-white dark:border-neutral-900 shadow-md flex items-center justify-center transition-transform group-hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            </div>
          </div>
        `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-div-icon',
        iconSize: isLive ? [32, 32] : [28, 28],
        iconAnchor: isLive ? [16, 16] : [14, 14],
        popupAnchor: [0, -14],
      });

      const marker = L.marker([evt.lat, evt.lon], { icon: customIcon }).addTo(markersGroup);

      // Bind interactive popup
      const popupDiv = document.createElement('div');
      popupDiv.className = 'p-2 min-w-[210px] font-sans text-xs';
      popupDiv.innerHTML = `
        <div class="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-1.5 mb-2">
          <span class="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            ${isLive ? '📡 Live Telemetry' : '🔊 Audio Trigger'}
          </span>
          <span class="font-mono text-[10px] font-bold text-neutral-400">
            ${formatTime(evt.createdAt)}
          </span>
        </div>
        <div class="font-mono text-xs text-neutral-900 dark:text-white font-bold mb-1">
          ${formatCoords(evt.lat, evt.lon)}
        </div>
        <div class="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 mb-2.5">
          ${evt.isTelemetry ? `BATT: ${evt.batt !== undefined && evt.batt !== null ? `${evt.batt}%` : 'N/A'} • VEL: ${(evt.speed ?? 0.0).toFixed(1)} km/h` : `SIZE: ${formatBytes(evt.audioSize)}`}
        </div>
      `;

      if (!evt.isTelemetry) {
        const playBtn = document.createElement('button');
        playBtn.className = 'w-full py-1.5 px-3 rounded bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs';
        playBtn.innerHTML = `<span>Inspect & Play Audio</span>`;
        playBtn.onclick = (e) => {
          e.stopPropagation();
          onSelectEvent(evt);
        };
        popupDiv.appendChild(playBtn);
      }

      marker.bindPopup(popupDiv, {
        className: 'custom-leaflet-popup',
        closeButton: false,
      });

      marker.on('click', () => {
        if (!evt.isTelemetry) {
          onSelectEvent(evt);
        }
      });

      bounds.push([evt.lat, evt.lon]);
    });

    if (bounds.length > 0) {
      if (bounds.length === 1) {
        map.setView(bounds[0], 16, { animate: true });
      } else {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }
    }
  }, [events, selectedEventId, theme]);

  const handleCenterLive = () => {
    if (!mapInstanceRef.current || !activeEvt?.lat || !activeEvt?.lon) return;
    mapInstanceRef.current.setView([activeEvt.lat, activeEvt.lon], 16, { animate: true });
  };

  const handleFitAll = () => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;
    const bounds = markersGroupRef.current.getBounds();
    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  };

  const handleCopyCoords = () => {
    if (!activeEvt?.lat || !activeEvt?.lon) return;
    const text = `${activeEvt.lat.toFixed(6)}, ${activeEvt.lon.toFixed(6)}`;
    navigator.clipboard.writeText(text);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 shadow-sm transition-colors">
      
      {/* Map Header / HUD Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 sm:px-5 py-3.5 border-b border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900/95 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
          <span className="text-xs font-mono font-black uppercase tracking-wider text-neutral-950 dark:text-white">
            Geo-Spatial Tracking Stage
          </span>
          <span className="text-[11px] font-mono font-bold text-neutral-400 dark:text-neutral-500 hidden sm:inline">
            // LIVE RADAR
          </span>
        </div>

        {/* Live Coordinate readout with Copy button */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 font-mono font-bold text-xs px-3 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700">
            <span>{activeEvt ? formatCoords(activeEvt.lat, activeEvt.lon) : 'No GPS Signal'}</span>
          </div>

          <button
            onClick={handleCopyCoords}
            className="p-1.5 text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xs transition-colors"
            title="Copy coordinates"
            aria-label="Copy coordinates"
          >
            {copiedCoords ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Map Container */}
      <div
        ref={mapContainerRef}
        className={`w-full h-[320px] sm:h-[400px] md:h-[480px] ${
          mapStyle === 'monochrome'
            ? theme === 'dark'
              ? 'dark-map-tiles'
              : 'light-map-tiles'
            : ''
        }`}
      />

      {/* Floating Map Navigation Controls */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5 shadow-md">
        <button
          onClick={handleCenterLive}
          className="p-2 rounded-lg bg-white/95 dark:bg-neutral-900/95 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Center on Live Wearable"
          aria-label="Center on Live Wearable"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        <button
          onClick={handleFitAll}
          className="p-2 rounded-lg bg-white/95 dark:bg-neutral-900/95 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Fit all waypoints"
          aria-label="Fit all waypoints"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => setMapStyle(mapStyle === 'monochrome' ? 'standard' : 'monochrome')}
          className="p-2 rounded-lg bg-white/95 dark:bg-neutral-900/95 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Toggle Monochrome / Standard Map Tones"
          aria-label="Toggle Monochrome / Standard Map Tones"
        >
          <Layers className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Legend Badge */}
      <div className="absolute top-16 left-4 z-20 hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm border border-neutral-200 dark:border-neutral-800 text-[11px] font-mono text-neutral-600 dark:text-neutral-300">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Active Device</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-neutral-950 dark:bg-neutral-100" />
          <span>Audio Alert Pin</span>
        </div>
      </div>
    </div>
  );
};
