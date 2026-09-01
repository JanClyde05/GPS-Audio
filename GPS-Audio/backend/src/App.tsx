import React, { useEffect, useState, useCallback } from 'react';
import { GuardianEvent, ThemeMode } from './types';
import { Header } from './components/Header';
import { TelemetryBar } from './components/TelemetryBar';
import { MapContainer } from './components/MapContainer';
import { EventsList } from './components/EventsList';
import { AudioPlayerModal } from './components/AudioPlayerModal';
import { Toast, ToastMessage } from './components/Toast';

export default function App() {
  const [events, setEvents] = useState<GuardianEvent[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const [selectedEvent, setSelectedEvent] = useState<GuardianEvent | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Theme Management (Light / Dark)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('guardian_theme') as ThemeMode;
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('guardian_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Toast notification helper
  const addToast = useCallback((type: 'success' | 'error' | 'info', title: string, message?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch events from backend API
  const fetchEvents = useCallback(async (isSilent = true) => {
    if (!isSilent) setIsLoading(true);
    try {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      const eventList: GuardianEvent[] = data.events || [];

      setEvents(eventList);
      setIsOnline(true);
      setLastUpdated(new Date());

      // Deep link checking if not already open
      const hash = window.location.hash;
      if (hash.startsWith('#event-')) {
        const eventId = hash.replace('#event-', '');
        let targetEvt = eventList.find((e) => e.id === eventId || e.id.replace(/\.wav$/, '') === eventId.replace(/\.wav$/, ''));

        if (!targetEvt && eventId) {
          try {
            const singleRes = await fetch(`/api/events?id=${encodeURIComponent(eventId)}`);
            if (singleRes.ok) {
              const singleEvt = await singleRes.json();
              if (singleEvt && singleEvt.id) {
                targetEvt = singleEvt;
                setEvents((prev) => [singleEvt, ...prev.filter((e) => e.id !== singleEvt.id)]);
              }
            }
          } catch (e) {
            console.warn('Could not fetch deep-linked event by ID:', e);
          }
        }

        if (targetEvt && (!selectedEvent || selectedEvent.id !== targetEvt.id)) {
          setSelectedEvent(targetEvt);
        }
      }
    } catch (err: any) {
      console.warn('Telemetry polling notice:', err.message);
      setIsOnline(false);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [selectedEvent]);

  // Initial load and recurring 3-second polling interval
  useEffect(() => {
    fetchEvents(false);
    const interval = setInterval(() => {
      fetchEvents(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchEvents]);

  // Select event & update URL hash
  const handleSelectEvent = (event: GuardianEvent) => {
    setSelectedEvent(event);
    window.location.hash = `event-${event.id}`;
  };

  // Close player & clear URL hash
  const handleClosePlayer = () => {
    setSelectedEvent(null);
    if (window.location.hash) {
      history.pushState('', document.title, window.location.pathname + window.location.search);
    }
  };

  // Action: Purge ESP32 Queue
  const handlePurgeEsp32 = async () => {
    addToast('info', 'PURGING ESP32 QUEUE', 'Dispatching reset packet to hardware receiver memory...');
    try {
      await fetch('http://192.168.123.6:8888/clear-memory', {
        method: 'POST',
        mode: 'no-cors',
      });
      addToast('success', 'PURGE DISPATCHED', 'Purge signal sent to local ESP32 receiver queue.');
    } catch (err: any) {
      addToast('info', 'PURGE SIGNAL SENT', 'Command dispatched. Note: Direct LAN receiver is reachable when on same network.');
    }
  };

  // Action: Clear Logs
  const handleClearLogs = async () => {
    if (!window.confirm('Clear all telemetry and audio incident cards from the active monitor?')) {
      return;
    }
    try {
      const res = await fetch('/api/events?clear=true', { method: 'DELETE' });
      if (res.ok) {
        setEvents([]);
        addToast('success', 'LOGS CLEARED', 'Telemetry database and audio events have been reset.');
      } else {
        setEvents([]);
      }
    } catch (err: any) {
      setEvents([]);
      addToast('info', 'LOGS CLEARED', 'Local cache purged.');
    }
  };

  // Action: Test Live GPS Telemetry Upload
  const handleSendTestTelemetry = async () => {
    try {
      // Small jitter around base position for dynamic map simulation
      const baseLat = 14.599512 + (Math.random() - 0.5) * 0.006;
      const baseLon = 120.984222 + (Math.random() - 0.5) * 0.006;
      const battVal = Math.floor(75 + Math.random() * 24);

      const formData = new FormData();
      formData.append('lat', baseLat.toFixed(6));
      formData.append('lon', baseLon.toFixed(6));
      formData.append('type', Math.random() > 0.6 ? 'telemetry' : 'audio');
      formData.append('batt', battVal.toString());
      formData.append('speed', (0.5 + Math.random() * 3.5).toFixed(1));

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        addToast('success', 'TELEMETRY INJECTED', `Broadcasted coordinates: ${baseLat.toFixed(4)}, ${baseLon.toFixed(4)} (${battVal}% Batt)`);
        await fetchEvents(true);
      }
    } catch (err: any) {
      addToast('error', 'SIMULATION ERROR', 'Could not upload test telemetry packet.');
    }
  };

  // Action: Seed Data
  const handleSeedData = async () => {
    try {
      const res = await fetch('/api/events/seed', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        addToast('success', 'SAMPLE DATA LOADED', 'Initialized reference telemetry and audio events.');
      }
    } catch (err: any) {
      addToast('info', 'RELOADED', 'Refreshed active telemetry monitor.');
    }
  };

  const audioAlertCount = events.filter((e) => !e.isTelemetry).length;
  const latestEvent = events[0] || null;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors duration-200">
      
      {/* Top Brand Header & Action Toolbar */}
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        isOnline={isOnline}
        alertCount={audioAlertCount}
        lastUpdated={lastUpdated}
        onRefresh={() => fetchEvents(false)}
        isLoading={isLoading}
        onPurgeEsp32={handlePurgeEsp32}
        onClearLogs={handleClearLogs}
        onSendTestTelemetry={handleSendTestTelemetry}
      />

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        
        {/* Modular Telemetry Metric Bar */}
        <TelemetryBar
          latestEvent={latestEvent}
          events={events}
        />

        {/* 2-Column Responsive Bento Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Live Map Tracking Stage (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <MapContainer
              events={events}
              theme={theme}
              onSelectEvent={handleSelectEvent}
              selectedEventId={selectedEvent?.id}
            />
          </div>

          {/* Right Column: Audio & Incident Stream (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <EventsList
              events={events}
              onSelectEvent={handleSelectEvent}
              selectedEventId={selectedEvent?.id}
              onSeedData={handleSeedData}
            />
          </div>

        </div>

      </main>

      {/* Minimalist Sub-Footer */}
      <footer className="border-t border-neutral-300 dark:border-neutral-800 py-4 bg-white dark:bg-neutral-950 text-neutral-500 dark:text-neutral-400 text-xs font-mono transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold tracking-wider uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>GUARDIAN TRACKING ARCHITECTURE • BOLD TYPOGRAPHY SPEC</span>
          </div>
          <div className="flex items-center gap-4 font-bold">
            <span className="text-neutral-400 dark:text-neutral-600">POLL: 3000ms</span>
          </div>
        </div>
      </footer>

      {/* Audio Player Modal */}
      <AudioPlayerModal
        event={selectedEvent}
        theme={theme}
        onClose={handleClosePlayer}
        onNavigateToMap={(lat, lon) => {
          // Handled within map bounds
        }}
      />

      {/* Toast Notification Stream */}
      <Toast
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </div>
  );
}
