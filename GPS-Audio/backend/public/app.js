// =============================================================================
// GuardianTrack — Parent Dashboard App
// Fetches events from /api/events, renders map + audio player.
// =============================================================================

// ── State ───────────────────────────────────────────────────────────────────

let map = null;
let markers = [];
let miniMap = null;
let miniMarker = null;
let events = [];

// ── Initialize ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadEvents();

  // Auto-refresh every 3 seconds for real-time live map tracking
  setInterval(loadEvents, 3000);

  // Check for deep-linked event
  const hash = window.location.hash;
  if (hash.startsWith('#event-')) {
    const eventId = hash.replace('#event-', '');
    setTimeout(() => {
      const evt = events.find(e => e.id === eventId);
      if (evt) openPlayer(evt);
    }, 1500);
  }
});

// ── Map ─────────────────────────────────────────────────────────────────────

function initMap() {
  map = L.map('map', {
    zoomControl: true,
    attributionControl: false
  }).setView([14.5995, 120.9842], 13);  // Default: Manila

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(map);
}

function updateMap(eventList) {
  // Clear existing markers
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  if (eventList.length === 0) return;

  const bounds = [];

  eventList.forEach((evt) => {
    // Skip events with no valid GPS coordinates
    if (!evt.lat || !evt.lon || (evt.lat === 0 && evt.lon === 0)) return;

    // Use the isTelemetry flag to identify the live wearable location pin
    const isLive = evt.isTelemetry === true;
    const marker = L.circleMarker([evt.lat, evt.lon], {
      radius: isLive ? 12 : 7,
      fillColor: isLive ? '#3b82f6' : '#ef4444',
      color: isLive ? '#2563eb' : '#dc2626',
      weight: isLive ? 3 : 2,
      opacity: 1,
      fillOpacity: isLive ? 0.9 : 0.6,
    }).addTo(map);

    const time = formatTime(evt.createdAt || evt.timestamp);
    marker.bindPopup(`
      <div style="font-family:Inter,sans-serif;font-size:13px;">
        <strong>${isLive ? '📡 Live Wearable Location' : '🔴 Audio Alert Location'}</strong><br>
        ${time}<br>
        ${evt.lat.toFixed(6)}, ${evt.lon.toFixed(6)}
      </div>
    `);

    markers.push(marker);
    bounds.push([evt.lat, evt.lon]);
  });

  if (bounds.length > 0) {
    if (bounds.length === 1) {
      map.setView(bounds[0], 16);
    } else {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }
}

// ── Events ──────────────────────────────────────────────────────────────────

async function loadEvents() {
  const statusDot  = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  try {
    const res = await fetch('/api/events');
    const data = await res.json();

    events = data.events || [];

    statusDot.classList.add('online');
    const audioEvents = events.filter(e => !e.isTelemetry);
    statusText.textContent = `${audioEvents.length} alert${audioEvents.length !== 1 ? 's' : ''}`;

    renderEvents(events);
    updateMap(events);

    document.getElementById('event-count').textContent =
      `${audioEvents.length} alert${audioEvents.length !== 1 ? 's' : ''}`;

  } catch (err) {
    console.error('Failed to load events:', err);
    statusDot.classList.remove('online');
    statusText.textContent = 'Offline';
  }
}

function renderEvents(eventList) {
  const container = document.getElementById('events-list');

  // Filter out pure telemetry events from the audio list
  const audioList = eventList.filter(e => !e.isTelemetry);

  if (audioList.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📡</div>
        <p>No alerts yet</p>
        <p class="empty-sub">Audio alerts from the wearable will appear here</p>
      </div>
    `;
    return;
  }

  container.innerHTML = audioList.map(evt => {
    const time = formatTime(evt.createdAt || evt.timestamp);
    const duration = evt.audioSize
      ? `~${Math.round(evt.audioSize / (8000 * 2))}s`
      : '';
    const coords = (evt.lat && evt.lon && !(evt.lat === 0 && evt.lon === 0))
      ? `${evt.lat.toFixed(4)}, ${evt.lon.toFixed(4)}`
      : 'No GPS';

    return `
      <div class="event-card" onclick='openPlayer(${JSON.stringify(evt)})' id="card-${evt.id}">
        <div class="event-icon">🚨</div>
        <div class="event-info">
          <div class="event-time">${time}</div>
          <div class="event-details">
            <span>📍 ${coords}</span>
            ${duration ? `<span>⏱ ${duration}</span>` : ''}
          </div>
        </div>
        <button class="event-play" onclick="event.stopPropagation(); openPlayer(${JSON.stringify(evt).replace(/"/g, '&quot;')})">
          ▶
        </button>
      </div>
    `;
  }).join('');
}

// ── Audio Player Modal ──────────────────────────────────────────────────────

function openPlayer(evt) {
  const modal    = document.getElementById('player-modal');
  const meta     = document.getElementById('player-meta');
  const audio    = document.getElementById('audio-player');

  const time     = formatTime(evt.createdAt || evt.timestamp);
  const coords   = (evt.lat && evt.lon) ? `${evt.lat.toFixed(6)}, ${evt.lon.toFixed(6)}` : 'No GPS';
  const duration = evt.audioSize ? `~${Math.round(evt.audioSize / (8000 * 2))} seconds` : '';

  meta.innerHTML = `
    <div>🕐 <strong>Time:</strong> ${time}</div>
    <div>📍 <strong>Location:</strong> ${coords}</div>
    ${duration ? `<div>⏱ <strong>Duration:</strong> ${duration}</div>` : ''}
    <div>📦 <strong>Size:</strong> ${formatBytes(evt.audioSize || 0)}</div>
  `;

  // Set audio source
  audio.src = `/api/events?audio=${encodeURIComponent(evt.audioKey)}`;
  audio.load();

  // Show modal
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Init mini map
  setTimeout(() => {
    if (miniMap) {
      miniMap.remove();
    }

    miniMap = L.map('player-map-mini', {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(miniMap);

    if (evt.lat && evt.lon && !(evt.lat === 0 && evt.lon === 0)) {
      miniMap.setView([evt.lat, evt.lon], 16);
      miniMarker = L.marker([evt.lat, evt.lon]).addTo(miniMap);
    } else {
      miniMap.setView([14.5995, 120.9842], 5);
    }
  }, 100);

  // Update hash for deep-linking
  window.location.hash = `event-${evt.id}`;
}

function closePlayer() {
  const modal = document.getElementById('player-modal');
  const audio = document.getElementById('audio-player');

  audio.pause();
  audio.src = '';
  modal.classList.remove('active');
  document.body.style.overflow = '';

  if (miniMap) {
    miniMap.remove();
    miniMap = null;
  }

  window.location.hash = '';
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePlayer();
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(input) {
  if (!input) return 'Unknown';

  let date;
  if (typeof input === 'string') {
    date = new Date(input);
  } else if (typeof input === 'number') {
    // If it's a small number, it might be millis() from ESP32 — use current time
    date = input > 1e12 ? new Date(input) : new Date();
  } else {
    date = new Date();
  }

  if (isNaN(date.getTime())) return 'Unknown';

  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

async function purgeEsp32Queue() {
  if (!confirm('Purge all pending ongoing uploads from the ESP32 Receiver memory?')) return;

  const btn = document.getElementById('btn-purge-esp32');
  if (btn) btn.innerText = '⏳ Purging...';

  try {
    await fetch('http://192.168.123.6:8888/clear-memory', { method: 'POST', mode: 'no-cors' });
    alert('⚡ Request sent to ESP32 Receiver to purge its ongoing upload queue!');
  } catch (err) {
    console.error('Failed to purge ESP32 queue:', err);
  } finally {
    if (btn) btn.innerText = '⚡ Purge ESP32 Queue';
  }
}

async function clearDashboardLogs() {
  if (!confirm('Clear all event cards and audio alert history from the dashboard log?')) return;

  const btn = document.getElementById('btn-clear-logs');
  if (btn) btn.innerText = '⏳ Clearing...';

  try {
    await fetch('/api/events?clear=true', { method: 'DELETE' });
    await loadEvents();
  } catch (err) {
    console.error('Failed to clear dashboard logs:', err);
  } finally {
    if (btn) btn.innerText = '🗑️ Clear Logs';
  }
}

async function sendTestTelemetry() {
  const btn = document.getElementById('btn-test-gps');
  if (btn) btn.innerText = '⏳ Sending...';

  try {
    const formData = new FormData();
    formData.append('lat', '17.649862');
    formData.append('lon', '121.744133');
    formData.append('type', 'telemetry');
    formData.append('batt', '85');

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    console.log('Test telemetry uploaded:', data);

    await loadEvents();
  } catch (err) {
    console.error('Failed to send test telemetry:', err);
  } finally {
    if (btn) btn.innerText = '🧪 Test Location';
  }
}
