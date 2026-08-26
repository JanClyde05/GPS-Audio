// =============================================================================
// GuardianTrack WiFi Captive Portal — Client-Side Logic
// Adapted from MedDispenser portal
// =============================================================================

let selectedSsid = '';

// --- Tab Switching ---
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-' + tabName).classList.add('active');
  });
});

// --- Network Scanning ---
function scanNetworks() {
  const list = document.getElementById('network-list');
  list.innerHTML = '<div class="loading"><div class="spinner"></div><p>Scanning nearby networks...</p></div>';

  fetch('/scan')
    .then(res => res.json())
    .then(networks => {
      if (networks.length === 0) {
        list.innerHTML = '<div class="loading"><p>No networks found. Try rescanning.</p></div>';
        return;
      }
      networks.sort((a, b) => b.rssi - a.rssi);
      list.innerHTML = networks.map(net => {
        const signal = getSignalIcon(net.rssi);
        const lock = net.enc ? '&#x1f512;' : '';
        return `
          <div class="network-item" onclick="selectNetwork('${escapeHtml(net.ssid)}', ${net.enc})">
            <div class="network-info">
              <div class="network-ssid">${escapeHtml(net.ssid)}</div>
              <div class="network-meta">${net.rssi} dBm</div>
            </div>
            <span class="network-signal">${signal}</span>
            <span class="network-lock">${lock}</span>
          </div>
        `;
      }).join('');
    })
    .catch(() => {
      list.innerHTML = '<div class="loading"><p>Scan failed. Try again.</p></div>';
    });
}

function getSignalIcon(rssi) {
  if (rssi > -50) return '&#x2588;&#x2588;&#x2588;&#x2588;';
  if (rssi > -60) return '&#x2588;&#x2588;&#x2588;&#x2591;';
  if (rssi > -70) return '&#x2588;&#x2588;&#x2591;&#x2591;';
  return '&#x2588;&#x2591;&#x2591;&#x2591;';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function selectNetwork(ssid, encrypted) {
  selectedSsid = ssid;
  if (encrypted) {
    document.getElementById('modal-ssid-display').textContent = ssid;
    document.getElementById('modal-pass').value = '';
    document.getElementById('password-modal').classList.add('active');
    setTimeout(() => document.getElementById('modal-pass').focus(), 100);
  } else {
    connectToNetwork(ssid, '');
  }
}

function closeModal() {
  document.getElementById('password-modal').classList.remove('active');
}

function connectFromModal() {
  const pass = document.getElementById('modal-pass').value;
  closeModal();
  connectToNetwork(selectedSsid, pass);
}

function connectManual() {
  const ssid = document.getElementById('manual-ssid').value.trim();
  const pass = document.getElementById('manual-pass').value;
  if (!ssid) { document.getElementById('manual-ssid').focus(); return; }
  connectToNetwork(ssid, pass);
}

function connectToNetwork(ssid, pass) {
  showStatus('Connecting to ' + ssid + '...');
  fetch('/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ssid, pass })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === 'connecting') {
      pollConnectionStatus();
    } else {
      showStatus('Connection failed: ' + (data.message || 'Unknown error'));
    }
  })
  .catch(() => { showStatus('Request failed. Please try again.'); });
}

function pollConnectionStatus() {
  let attempts = 0;
  const poll = () => {
    attempts++;
    if (attempts > 30) { showStatus('Connection timed out. Please try again.'); return; }
    fetch('/status')
      .then(res => res.json())
      .then(data => {
        if (data.connectResult === 'success') {
          showSuccess(data.ip || '', data.channel || '');
        } else if (data.connectResult === 'failed') {
          showStatus('Connection failed. Check password and try again.');
        } else {
          setTimeout(poll, 1000);
        }
      })
      .catch(() => { showSuccess('', ''); });
  };
  setTimeout(poll, 2000);
}

function showStatus(text) {
  document.getElementById('status-bar').style.display = 'flex';
  document.getElementById('status-text').textContent = text;
}

function showSuccess(ip, channel) {
  document.querySelector('.container').innerHTML = `
    <div class="success-message">
      <div class="success-icon">&#x2705;</div>
      <h2>Connected!</h2>
      <p>${ip ? 'IP: ' + ip : 'GuardianTrack receiver is now online!'}</p>
      ${channel ? '<p>WiFi Channel: ' + channel + '</p>' : ''}
      <p class="success-note">You can close this page now.</p>
    </div>
  `;
}

function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
}

document.addEventListener('DOMContentLoaded', () => { scanNetworks(); });
