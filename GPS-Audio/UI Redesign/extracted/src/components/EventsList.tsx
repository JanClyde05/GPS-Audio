import React, { useState, useMemo } from 'react';
import { GuardianEvent, EventFilter, ViewDensity } from '../types';
import { formatTime, formatCoords, formatBytes, formatDuration, formatExactTimestamp } from '../utils/formatters';
import { 
  Volume2, 
  Radio, 
  Search, 
  Play, 
  ChevronRight, 
  Filter, 
  SlidersHorizontal, 
  RefreshCw,
  Clock,
  MapPin,
  ListFilter
} from 'lucide-react';

interface EventsListProps {
  events: GuardianEvent[];
  onSelectEvent: (event: GuardianEvent) => void;
  selectedEventId?: string;
  onSeedData: () => void;
}

export const EventsList: React.FC<EventsListProps> = ({
  events,
  onSelectEvent,
  selectedEventId,
  onSeedData,
}) => {
  const [filter, setFilter] = useState<EventFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [density, setDensity] = useState<ViewDensity>('comfortable');

  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      // 1. Category filter
      if (filter === 'audio' && evt.isTelemetry) return false;
      if (filter === 'telemetry' && !evt.isTelemetry) return false;

      // 2. Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchId = evt.id.toLowerCase().includes(q);
      const matchTitle = evt.title?.toLowerCase().includes(q);
      const matchType = evt.type?.toLowerCase().includes(q);
      const matchCoords = `${evt.lat},${evt.lon}`.includes(q);
      return matchId || matchTitle || matchType || matchCoords;
    });
  }, [events, filter, searchQuery]);

  const audioCount = useMemo(() => events.filter((e) => !e.isTelemetry).length, [events]);
  const telemetryCount = useMemo(() => events.filter((e) => e.isTelemetry).length, [events]);

  return (
    <div className="w-full rounded-xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs transition-colors flex flex-col">
      
      {/* Header & Filter Controls */}
      <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-black uppercase tracking-tight text-neutral-950 dark:text-white flex items-center gap-2">
              <span>Incident & Telemetry Stream</span>
              <span className="text-xs font-mono font-bold text-neutral-500 dark:text-neutral-400">
                ({filteredEvents.length})
              </span>
            </h2>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mt-0.5">
              Audio recordings and real-time GPS telemetry feed
            </p>
          </div>

          {/* Density Toggle */}
          <div className="flex items-center rounded-lg border border-neutral-300 dark:border-neutral-700 p-0.5 bg-neutral-100 dark:bg-neutral-950">
            <button
              onClick={() => setDensity('comfortable')}
              className={`px-3 py-1 text-xs font-bold uppercase font-mono tracking-wider rounded transition-colors ${
                density === 'comfortable'
                  ? 'bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setDensity('compact')}
              className={`px-3 py-1 text-xs font-bold uppercase font-mono tracking-wider rounded transition-colors ${
                density === 'compact'
                  ? 'bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              Compact
            </button>
          </div>
        </div>

        {/* Filter Pills and Search Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
          
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-bold uppercase tracking-wider transition-colors whitespace-nowrap border shadow-xs ${
                filter === 'all'
                  ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 border-neutral-950 dark:border-white'
                  : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-950 dark:text-neutral-400 border-neutral-300 dark:border-neutral-800 hover:border-neutral-400'
              }`}
            >
              ALL ({events.length})
            </button>

            <button
              onClick={() => setFilter('audio')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-bold uppercase tracking-wider transition-colors whitespace-nowrap border flex items-center gap-1.5 shadow-xs ${
                filter === 'audio'
                  ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 border-neutral-950 dark:border-white'
                  : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-950 dark:text-neutral-400 border-neutral-300 dark:border-neutral-800 hover:border-neutral-400'
              }`}
            >
              <Volume2 className="w-3 h-3" />
              <span>AUDIO ({audioCount})</span>
            </button>

            <button
              onClick={() => setFilter('telemetry')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-bold uppercase tracking-wider transition-colors whitespace-nowrap border flex items-center gap-1.5 shadow-xs ${
                filter === 'telemetry'
                  ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 border-neutral-950 dark:border-white'
                  : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-950 dark:text-neutral-400 border-neutral-300 dark:border-neutral-800 hover:border-neutral-400'
              }`}
            >
              <Radio className="w-3 h-3" />
              <span>GPS ({telemetryCount})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px] sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="FILTER BY COORDS, TYPE..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs font-mono font-medium uppercase rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-neutral-500 dark:focus:border-neutral-500"
            />
          </div>
        </div>
      </div>

      {/* Events List Body */}
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800 max-h-[540px] overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full border border-neutral-300 dark:border-neutral-700 flex items-center justify-center bg-neutral-100 dark:bg-neutral-950 text-neutral-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-neutral-950 dark:text-white">No entries detected</p>
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm">
                {events.length === 0
                  ? 'All event logs have been cleared. Incoming signals from the wearable will populate automatically.'
                  : 'No logs match your current category and search parameters.'}
              </p>
            </div>
            {events.length === 0 && (
              <button
                onClick={onSeedData}
                className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Load Sample Telemetry Data</span>
              </button>
            )}
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const isSelected = evt.id === selectedEventId;
            const isAudio = !evt.isTelemetry;

            if (density === 'compact') {
              return (
                <div
                  key={evt.id}
                  onClick={() => onSelectEvent(evt)}
                  className={`px-4 py-3 flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer hover:bg-neutral-100/70 dark:hover:bg-neutral-800/60 ${
                    isSelected ? 'bg-neutral-100 dark:bg-neutral-800 font-bold border-l-4 border-l-neutral-950 dark:border-l-white' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isAudio ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                    />
                    <span className="font-mono font-bold uppercase tracking-wider text-neutral-950 dark:text-white truncate">
                      {isAudio ? 'AUDIO_ALERT' : 'GPS_FIX'}
                    </span>
                    <span className="font-mono font-semibold text-neutral-500 dark:text-neutral-400 hidden sm:inline">
                      {evt.id}
                    </span>
                    <span className="font-mono font-bold text-neutral-700 dark:text-neutral-300 truncate">
                      {formatCoords(evt.lat, evt.lon)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 font-mono font-bold text-neutral-500 dark:text-neutral-400">
                    <span>{formatTime(evt.createdAt)}</span>
                    {isAudio && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEvent(evt);
                        }}
                        className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-950 dark:text-white"
                        title="Play audio"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={evt.id}
                onClick={() => onSelectEvent(evt)}
                className={`p-4 sm:p-5 transition-colors cursor-pointer hover:bg-neutral-50/90 dark:hover:bg-neutral-800/40 flex items-start justify-between gap-4 ${
                  isSelected ? 'bg-neutral-100/90 dark:bg-neutral-800/70 border-l-4 border-l-neutral-950 dark:border-l-white' : ''
                }`}
              >
                {/* Left meta */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border shadow-xs ${
                      isAudio
                        ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 border-neutral-950 dark:border-white'
                        : 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white border-neutral-300 dark:border-neutral-700'
                    }`}
                  >
                    {isAudio ? <Volume2 className="w-4 h-4" /> : <Radio className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                          isAudio
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-900/80'
                            : 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700'
                        }`}
                      >
                        {isAudio ? 'Audio Alert' : 'GPS Telemetry'}
                      </span>

                      <span className="text-xs sm:text-sm font-extrabold tracking-tight text-neutral-950 dark:text-white">
                        {evt.title || (isAudio ? 'Microphone Sound Trigger' : 'Routine Position Uplink')}
                      </span>
                    </div>

                    {/* Coordinates and attributes */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400 font-mono font-medium mt-1.5">
                      <div className="flex items-center gap-1 font-bold text-neutral-800 dark:text-neutral-200">
                        <MapPin className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                        <span>{formatCoords(evt.lat, evt.lon)}</span>
                      </div>

                      {isAudio && evt.audioSize ? (
                        <>
                          <span>•</span>
                          <span>SIZE: {formatBytes(evt.audioSize)}</span>
                          <span>•</span>
                          <span>DUR: {formatDuration(evt.audioSize)}</span>
                        </>
                      ) : null}

                      {evt.batt ? (
                        <>
                          <span>•</span>
                          <span className="font-bold">BATT: {evt.batt}%</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Right time & play button */}
                <div className="flex flex-col items-end gap-2.5 shrink-0">
                  <div className="flex items-center gap-1 text-xs font-mono font-bold text-neutral-500 dark:text-neutral-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatTime(evt.createdAt)}</span>
                  </div>

                  {isAudio && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(evt);
                      }}
                      className="px-3 py-1 rounded bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>PLAY</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
