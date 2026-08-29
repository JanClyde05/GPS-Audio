import React, { useState } from 'react';
import { 
  Radio, 
  RotateCw, 
  Moon, 
  Sun, 
  Trash2, 
  Zap, 
  Navigation, 
  Layers, 
  BookOpen,
  MoreVertical
} from 'lucide-react';
import { ThemeMode } from '../types';

interface HeaderProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  isOnline: boolean;
  alertCount: number;
  lastUpdated: Date | null;
  onRefresh: () => void;
  isLoading: boolean;
  onPurgeEsp32: () => void;
  onClearLogs: () => void;
  onSendTestTelemetry: () => void;
  onOpenDesignRules: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  onToggleTheme,
  isOnline,
  alertCount,
  lastUpdated,
  onRefresh,
  isLoading,
  onPurgeEsp32,
  onClearLogs,
  onSendTestTelemetry,
  onOpenDesignRules,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Brand Mark & Identity */}
          <div className="flex items-center gap-3.5">
            <div className="w-8 h-8 rounded border border-neutral-900 dark:border-neutral-100 flex items-center justify-center bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 shadow-xs">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-neutral-950 dark:text-white uppercase">
                  GuardianTrack
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-900 tracking-wider">
                  v2.4
                </span>
              </div>
              <p className="text-[11px] font-medium tracking-wide uppercase text-neutral-400 dark:text-neutral-500 hidden sm:block">
                Precision Wearable Telemetry & Audio Monitor
              </p>
            </div>
          </div>

          {/* Telemetry Uplink Status Pill */}
          <div className="hidden md:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-100/60 dark:bg-neutral-900/80 shadow-xs">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
              {isOnline ? 'UPLINK ONLINE' : 'UPLINK OFFLINE'}
            </span>
            <span className="text-neutral-300 dark:text-neutral-700">|</span>
            <span className="text-xs font-mono font-bold text-neutral-500 dark:text-neutral-400 tracking-wide">
              {alertCount} ALERT{alertCount !== 1 ? 'S' : ''}
            </span>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            
            {/* Design Spec Rulebook button */}
            <button
              onClick={onOpenDesignRules}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold font-mono uppercase tracking-wider text-neutral-800 dark:text-neutral-200 hover:text-neutral-950 dark:hover:text-white rounded border border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 bg-white dark:bg-neutral-900 shadow-xs transition-colors"
              title="View Minimalist Design Rules & Typography Spec"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Design Rules</span>
            </button>

            {/* Quick Simulation / Purge Trigger Buttons for Desktop */}
            <div className="hidden lg:flex items-center gap-1.5">
              <button
                onClick={onSendTestTelemetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold font-mono uppercase tracking-wider rounded text-neutral-800 dark:text-neutral-200 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 transition-colors shadow-xs"
                title="Send test GPS packet"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Test GPS</span>
              </button>

              <button
                onClick={onPurgeEsp32}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold font-mono uppercase tracking-wider rounded text-neutral-800 dark:text-neutral-200 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 transition-colors shadow-xs"
                title="Purge ESP32 Receiver Upload Queue"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Purge ESP32</span>
              </button>

              <button
                onClick={onClearLogs}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold font-mono uppercase tracking-wider rounded text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 border border-rose-300 dark:border-rose-900/70 transition-colors shadow-xs"
                title="Clear all dashboard logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Logs</span>
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white rounded border border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 bg-white dark:bg-neutral-900 shadow-xs transition-colors"
              title="Refresh telemetry"
              aria-label="Refresh telemetry data"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-neutral-900 dark:text-white' : ''}`} />
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={onToggleTheme}
              className="p-2 text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white rounded border border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 bg-white dark:bg-neutral-900 shadow-xs transition-colors"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-neutral-700 dark:text-neutral-300 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xs"
              aria-label="Toggle mobile menu"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-neutral-200 dark:border-neutral-800 flex flex-col gap-2">
            <div className="flex items-center justify-between px-1 py-1 text-xs text-neutral-500 font-mono">
              <span>DEVICE LINK: {isOnline ? 'ONLINE' : 'DISCONNECTED'}</span>
              <span>{alertCount} ALERTS</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => { onSendTestTelemetry(); setMobileMenuOpen(false); }}
                className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900"
              >
                <Navigation className="w-3.5 h-3.5" />
                Test GPS
              </button>

              <button
                onClick={() => { onPurgeEsp32(); setMobileMenuOpen(false); }}
                className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900"
              >
                <Zap className="w-3.5 h-3.5" />
                Purge ESP32
              </button>

              <button
                onClick={() => { onOpenDesignRules(); setMobileMenuOpen(false); }}
                className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 col-span-1"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Design Rules
              </button>

              <button
                onClick={() => { onClearLogs(); setMobileMenuOpen(false); }}
                className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-rose-600 dark:text-rose-400 rounded border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 col-span-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Logs
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
