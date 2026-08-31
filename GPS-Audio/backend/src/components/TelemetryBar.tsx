import React from 'react';
import { GuardianEvent } from '../types';
import { formatCoords, formatTime } from '../utils/formatters';
import { Battery, Activity, Compass, BellRing } from 'lucide-react';

interface TelemetryBarProps {
  latestEvent: GuardianEvent | null;
  events: GuardianEvent[];
}

export const TelemetryBar: React.FC<TelemetryBarProps> = ({ latestEvent, events }) => {
  const audioAlerts = events.filter((e) => !e.isTelemetry);
  
  // Only use telemetry events for the live position display — never fall back to audio events
  const telemetryEvt = events.find((e) => e.isTelemetry) || null;
  
  // Only treat telemetry as valid if it has non-zero GPS coordinates
  const hasValidGps = telemetryEvt !== null && 
    telemetryEvt.lat !== undefined && telemetryEvt.lon !== undefined &&
    !(telemetryEvt.lat === 0 && telemetryEvt.lon === 0);
  
  const isLiveTelemetry = hasValidGps;
  const hasTelemetry = telemetryEvt !== null && telemetryEvt !== undefined;
  const rawBatt = telemetryEvt?.batt !== undefined && telemetryEvt?.batt !== null ? Number(telemetryEvt.batt) : null;

  let battValueText = 'N/A';
  let battStatusLabel = 'NOT CONNECTED';
  let battSubLabel = 'BATTERY DATA UNREADABLE';
  let battFillWidth = 0;
  let battFillColor = 'bg-neutral-400 dark:bg-neutral-600';

  if (hasTelemetry && rawBatt !== null && !isNaN(rawBatt)) {
    battValueText = `${rawBatt}%`;
    battFillWidth = Math.min(100, Math.max(3, rawBatt));

    if (rawBatt === 0) {
      battStatusLabel = 'NOT CONNECTED';
      battSubLabel = 'BATTERY NOT CONNECTED (0%)';
      battFillColor = 'bg-rose-500';
    } else if (rawBatt <= 20) {
      battStatusLabel = 'LOW BATT';
      battSubLabel = `BATTERY LOW (${rawBatt}%)`;
      battFillColor = 'bg-amber-500';
    } else {
      battStatusLabel = 'NOMINAL';
      battSubLabel = `TELEMETRY BATT: ${rawBatt}%`;
      battFillColor = 'bg-emerald-500 dark:bg-emerald-400';
    }
  }

  const speed = hasValidGps && telemetryEvt?.speed !== undefined ? telemetryEvt.speed : 0.0;
  const accuracy = hasValidGps && telemetryEvt?.accuracy !== undefined ? telemetryEvt.accuracy : 0.0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {/* Tile 1: Live / Last Fix & Coords */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 shadow-xs transition-colors">
        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
            {isLiveTelemetry ? 'LIVE POSITION FIX' : 'LAST POSITION FIX'}
          </span>
          <Compass className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
        </div>
        <div className="font-mono text-sm sm:text-base font-black tracking-tight text-neutral-950 dark:text-white truncate">
          {hasValidGps ? formatCoords(telemetryEvt!.lat, telemetryEvt!.lon) : 'No GPS Signal'}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-mono font-semibold text-neutral-500 dark:text-neutral-400">
          <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${isLiveTelemetry ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="truncate">{isLiveTelemetry ? 'SYNC:' : 'AWAITING GPS:'} {hasValidGps ? formatTime(telemetryEvt?.createdAt) : 'NO FIX'}</span>
        </div>
      </div>

      {/* Tile 2: Battery & Hardware Health */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 shadow-xs transition-colors">
        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Power Level</span>
          <Battery className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl sm:text-3xl font-black tracking-tight text-neutral-950 dark:text-white">
            {battValueText}
          </span>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate">
            {battStatusLabel}
          </span>
        </div>
        <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-2 rounded-full mt-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${battFillColor}`}
            style={{ width: `${battFillWidth}%` }}
          />
        </div>
        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mt-1.5 truncate">
          {battSubLabel}
        </div>
      </div>

      {/* Tile 3: Kinematics & Fix Accuracy */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 shadow-xs transition-colors">
        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Fix Precision</span>
          <Activity className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl sm:text-3xl font-black tracking-tight text-neutral-950 dark:text-white">
            ±{accuracy.toFixed(1)}m
          </span>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            9 SATS
          </span>
        </div>
        <div className="text-[11px] font-mono font-semibold text-neutral-500 dark:text-neutral-400 mt-1.5 truncate">
          VEL: {speed.toFixed(1)} KM/H • HDOP 0.8
        </div>
      </div>

      {/* Tile 4: Incident & Alert Queue */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 shadow-xs transition-colors">
        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Audio Incidents</span>
          <BellRing className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl sm:text-3xl font-black tracking-tight text-neutral-950 dark:text-white">
            {audioAlerts.length}
          </span>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            CAPTURED
          </span>
        </div>
        <div className="text-[11px] font-mono font-semibold text-neutral-500 dark:text-neutral-400 mt-1.5 truncate">
          {audioAlerts.length > 0 ? `LAST: ${formatTime(audioAlerts[0]?.createdAt)}` : 'ZERO ANOMALIES'}
        </div>
      </div>
    </div>
  );
};
