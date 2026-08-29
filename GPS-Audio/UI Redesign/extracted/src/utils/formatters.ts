/**
 * GuardianTrack - Minimalist Data Formatters
 */

export function formatTime(input?: string | number | null): string {
  if (!input) return 'Unknown';

  let date: Date;
  if (typeof input === 'string') {
    date = new Date(input);
  } else if (typeof input === 'number') {
    date = input > 1e12 ? new Date(input) : new Date(input * 1000);
  } else {
    date = new Date();
  }

  if (isNaN(date.getTime())) return 'Unknown';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatExactTimestamp(input?: string | number | null): string {
  if (!input) return '—';
  const date = new Date(input);
  if (isNaN(date.getTime())) return String(input);
  return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}

export function formatCoords(lat?: number, lon?: number): string {
  if (lat === undefined || lon === undefined || (lat === 0 && lon === 0)) {
    return 'No GPS Signal';
  }
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lon).toFixed(6)}° ${lonDir}`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export function formatDuration(audioSize?: number): string {
  if (!audioSize || audioSize === 0) return '0s';
  // Standard 8kHz 16-bit mono = 16000 bytes/sec
  const seconds = Math.max(1, Math.round(audioSize / 16000));
  return `${seconds}s`;
}
