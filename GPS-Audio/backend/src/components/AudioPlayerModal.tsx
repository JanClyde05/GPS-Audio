import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { GuardianEvent, ThemeMode } from '../types';
import { formatTime, formatExactTimestamp, formatCoords, formatBytes, formatDuration } from '../utils/formatters';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX, 
  Download, 
  X, 
  Compass, 
  Clock, 
  Battery, 
  HardDrive,
  Maximize2
} from 'lucide-react';

interface AudioPlayerModalProps {
  event: GuardianEvent | null;
  theme: ThemeMode;
  onClose: () => void;
  onNavigateToMap: (lat: number, lon: number) => void;
}

export const AudioPlayerModal: React.FC<AudioPlayerModalProps> = ({
  event,
  theme,
  onClose,
  onNavigateToMap,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const miniMapContainerRef = useRef<HTMLDivElement>(null);
  const miniMapInstanceRef = useRef<L.Map | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(3.0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [hasAudioError, setHasAudioError] = useState(false);

  // Initialize and update Mini Map
  useEffect(() => {
    if (!event || !miniMapContainerRef.current) return;

    if (miniMapInstanceRef.current) {
      miniMapInstanceRef.current.remove();
      miniMapInstanceRef.current = null;
    }

    const hasGps = Boolean(event.lat && event.lon && !(event.lat === 0 && event.lon === 0));
    const lat = hasGps ? event.lat : 14.5995;
    const lon = hasGps ? event.lon : 120.9842;

    const miniMap = L.map(miniMapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    }).setView([lat, lon], hasGps ? 16 : 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(miniMap);

    const iconHtml = `
      <div class="relative flex items-center justify-center w-6 h-6">
        <div class="w-5 h-5 rounded-full bg-rose-600 border-2 border-white shadow-md flex items-center justify-center text-white">
          <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
        </div>
      </div>
    `;

    const customIcon = L.divIcon({
      html: iconHtml,
      className: 'custom-div-icon',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    L.marker([lat, lon], { icon: customIcon }).addTo(miniMap);
    miniMapInstanceRef.current = miniMap;

    setTimeout(() => {
      miniMap.invalidateSize();
    }, 150);

    return () => {
      if (miniMapInstanceRef.current) {
        miniMapInstanceRef.current.remove();
        miniMapInstanceRef.current = null;
      }
    };
  }, [event, theme]);

  // Audio setup and URL resolution
  useEffect(() => {
    if (!event) return;
    setIsPlaying(false);
    setCurrentTime(0);
    setHasAudioError(false);

    if (audioRef.current) {
      const key = event.audioKey || (event.id.endsWith('.wav') ? event.id : `${event.id}.wav`);
      const audioUrl = event.audioUrl || `/api/events?audio=${encodeURIComponent(key)}`;
      audioRef.current.src = audioUrl;
      audioRef.current.load();
    }
  }, [event]);

  // Keyboard shortcut listener (Esc to close, Space to play/pause)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, onClose]);

  if (!event) return null;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Audio playback trigger:', err);
          setIsPlaying(true);
        });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
    }
  };

  const handleSkip = (seconds: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSpeedToggle = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    audioRef.current.muted = newMuteState;
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Mock visualizer waveform bars (heights based on hash of id for deterministic consistency)
  const barCount = 32;
  const bars = Array.from({ length: barCount }, (_, i) => {
    const seed = ((i + 1) * 37 + (event.id.charCodeAt(i % event.id.length) || 50)) % 100;
    return Math.max(15, Math.min(95, seed));
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      
      {/* Dark backdrop with smooth blur */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-neutral-950/70 backdrop-blur-sm transition-opacity duration-200"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl p-6 sm:p-7 z-10 transition-colors">
        
        {/* Hidden native HTML5 audio element */}
        <audio
          ref={audioRef}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
              if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
                setDuration(audioRef.current.duration);
              }
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
              setDuration(audioRef.current.duration);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
          onError={() => {
            console.warn('Audio payload failed to load or decode');
            setHasAudioError(true);
            setIsPlaying(false);
          }}
        />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-900/80 uppercase tracking-wider">
                AUDIO TELEMETRY CLIP
              </span>
              <span className="font-mono text-xs font-bold text-neutral-400">
                {event.id}
              </span>
            </div>
            <h3 className="text-lg font-black tracking-tight text-neutral-950 dark:text-white mt-1.5">
              {event.title || 'Wearable Acoustic Capture'}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Waveform Visualization Canvas */}
        <div className="rounded-lg bg-neutral-950 p-4 mb-4 border border-neutral-800 flex flex-col justify-end h-28 relative overflow-hidden shadow-inner">
          <div className="flex items-end justify-between gap-1 h-16 w-full z-10">
            {bars.map((height, idx) => {
              const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
              const barPct = (idx / barCount) * 100;
              const isPlayed = barPct <= progressPct;

              return (
                <div
                  key={idx}
                  className={`w-full rounded-xs transition-all duration-150 ${
                    isPlayed ? 'bg-white' : 'bg-neutral-700'
                  } ${isPlaying && isPlayed ? 'opacity-100 animate-pulse' : 'opacity-80'}`}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>

          {/* Timecode overlay */}
          <div className="flex items-center justify-between font-mono font-bold text-[11px] text-neutral-400 mt-2 z-10">
            <span>{formatSeconds(currentTime)}</span>
            <span>{formatSeconds(duration)}</span>
          </div>
        </div>

        {/* Scrub Slider */}
        <div className="mb-4">
          <input
            type="range"
            min="0"
            max={duration || 3.0}
            step="0.05"
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-950 dark:accent-white"
          />
        </div>

        {/* Playback Controls Toolbar */}
        <div className="flex items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-5 mb-5">
          <div className="flex items-center gap-2">
            
            {/* Rewind 5s */}
            <button
              onClick={() => handleSkip(-5)}
              className="p-2 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 transition-colors shadow-xs"
              title="Rewind 5 seconds"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Play/Pause Main Button */}
            <button
              onClick={togglePlay}
              className="px-5 py-2 rounded bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 font-black font-mono text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-xs"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>

            {/* Forward 5s */}
            <button
              onClick={() => handleSkip(5)}
              className="p-2 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 transition-colors shadow-xs"
              title="Forward 5 seconds"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Speed toggle */}
            <button
              onClick={handleSpeedToggle}
              className="px-2.5 py-1.5 font-mono text-xs font-bold rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 transition-colors shadow-xs"
              title="Change playback rate"
            >
              {playbackRate}x
            </button>

            {/* Mute toggle */}
            <button
              onClick={toggleMute}
              className="p-2 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 transition-colors shadow-xs"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Download audio */}
            <a
              href={`/api/events?audio=${encodeURIComponent(event.audioKey || event.id)}`}
              download={`guardian_${event.id}.wav`}
              className="p-2 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 transition-colors shadow-xs"
              title="Download raw audio WAV"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Telemetry & Capture Metadata Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs mb-5 font-mono">
          <div className="p-3 rounded bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800">
            <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 block uppercase mb-1">CAPTURE TIME</span>
            <span className="text-neutral-950 dark:text-white font-bold text-xs">
              {formatTime(event.createdAt)}
            </span>
          </div>

          <div className="p-3 rounded bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800">
            <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 block uppercase mb-1">PAYLOAD SIZE</span>
            <span className="text-neutral-950 dark:text-white font-bold text-xs">
              {formatBytes(event.audioSize)} ({formatDuration(event.audioSize)})
            </span>
          </div>

          <div className="p-3 rounded bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 block uppercase mb-1">GPS FIX</span>
              <button
                onClick={() => {
                  onNavigateToMap(event.lat, event.lon);
                  onClose();
                }}
                className="text-[10px] font-bold text-neutral-950 dark:text-white hover:underline flex items-center gap-1 font-mono uppercase tracking-wider"
              >
                <span>VIEW ON FULL MAP</span>
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>
            <span className="text-neutral-950 dark:text-white font-bold text-xs">
              {formatCoords(event.lat, event.lon)}
            </span>
          </div>
        </div>

        {/* Interactive Pinpoint Mini Map */}
        <div className="relative rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 h-36">
          <div
            ref={miniMapContainerRef}
            className={`w-full h-full ${theme === 'dark' ? 'dark-map-tiles' : 'light-map-tiles'}`}
          />
        </div>
      </div>
    </div>
  );
};
