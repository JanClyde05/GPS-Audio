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
  const batteryLevel = latestEvent?.batt !== undefined ? Number(latestEvent.batt) : 88;
  const speed = latestEvent?.speed !== undefined ? latestEvent.speed : 1.2;
  const accuracy = latestEvent?.accuracy !== undefined ? latestEvent.accuracy : 3.5;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {/* Tile 1: Live Fix & Coords */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 shadow-xs transition-colors">
        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Position Fix</span>
          <Compass className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
        </div>
        <div className="font-mono text-sm sm:text-base font-black tracking-tight text-neutral-950 dark:text-white truncate">
          {latestEvent ? formatCoords(latestEvent.lat, latestEvent.lon) : '14.599512° N, 120.984222° E'}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-mono font-semibold text-neutral-500 dark:text-neutral-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0" />
          <span className="truncate">SYNC: {formatTime(latestEvent?.createdAt)}</span>
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
            {batteryLevel}%
          </span>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {batteryLevel > 20 ? 'NOMINAL' : 'LOW VOLT'}
          </span>
        </div>
        <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-2 rounded-full mt-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              batteryLevel > 20 ? 'bg-neutral-950 dark:bg-white' : 'bg-rose-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(5, batteryLevel))}%` }}
          />
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
