/*
 * GuardianTrack Receiver — Configuration
 * ========================================
 * WiFi, backend, and system constants.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  WiFi credentials are provisioned via captive portal        │
 * │  (no hardcoded SSID/password).                             │
 * │  Backend URL and ntfy topic: update before deploying.      │
 * └─────────────────────────────────────────────────────────────┘
 */

#ifndef GUARDIANTRACK_RECEIVER_CONFIG_H
#define GUARDIANTRACK_RECEIVER_CONFIG_H

// ── Wi-Fi (Captive Portal Provisioning) ─────────────────────────────────────
// Credentials stored in NVS after first captive portal setup.
#define WIFI_AP_SSID "GuardianTrack_Setup" // SoftAP name for provisioning
#define WIFI_CONNECT_TIMEOUT_MS 15000      // Per-attempt connection timeout
#define WIFI_RETRY_INTERVAL_MS 30000       // Reconnect retry interval

// ── Backend API ─────────────────────────────────────────────────────────────
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  UNCOMMENT ONE OF THE OPTIONS BELOW BEFORE FLASHING:                     │
// └──────────────────────────────────────────────────────────────────────────┘

// --- OPTION A: Localhost Dev Server (Local Wi-Fi Testing) ---
// #define BACKEND_URL       "http://192.168.123.6:8888"

// --- OPTION B: Production Netlify Cloud Server ---
#define BACKEND_URL "https://gps-audio-tracker.netlify.app"

#define UPLOAD_ENDPOINT "/api/upload"

// ── ntfy Notifications ──────────────────────────────────────────────────────
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  ntfy topic: gps-audio-notifications                                   │
// │  URL: https://ntfy.sh/gps-audio-notifications                          │
// │  NOTE: ntfy is called from the backend (server-side), NOT from here.   │
// └──────────────────────────────────────────────────────────────────────────┘

// ── Upload Retry ────────────────────────────────────────────────────────────
#define UPLOAD_RETRY_INTERVAL_MS 60000 // Retry failed uploads every 60s
#define UPLOAD_MAX_RETRIES 5           // Max retry attempts per payload
#define HTTP_TIMEOUT_MS 15000          // HTTP request timeout

// ── Audio Reassembly Buffer ─────────────────────────────────────────────────
#define RX_AUDIO_BUFFER_SIZE                                                   \
  (8000 * 2 * 35) // ~35 seconds max (margin over 30s)

// ── NVS ─────────────────────────────────────────────────────────────────────
#define NVS_NAMESPACE "guardian"

// ── System ──────────────────────────────────────────────────────────────────
#define SERIAL_BAUD 115200

#endif // GUARDIANTRACK_RECEIVER_CONFIG_H
