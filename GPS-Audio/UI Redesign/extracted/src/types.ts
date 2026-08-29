export interface GuardianEvent {
  id: string;
  lat: number;
  lon: number;
  type: 'telemetry' | 'audio' | 'sos';
  isTelemetry?: boolean;
  audioKey?: string;
  audioUrl?: string;
  audioSize?: number;
  batt?: number | string;
  signal?: number | string;
  speed?: number;
  accuracy?: number;
  createdAt: string | number;
  timestamp?: string | number;
  deviceModel?: string;
  status?: 'normal' | 'alert' | 'critical';
  title?: string;
  notes?: string;
}

export type EventFilter = 'all' | 'audio' | 'telemetry';
export type ThemeMode = 'dark' | 'light';
export type ViewDensity = 'comfortable' | 'compact';
