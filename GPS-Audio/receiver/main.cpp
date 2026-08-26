/*
 * GuardianTrack Receiver — Main
 * ==============================
 * ESP32-S3 SuperMini fixed base station.
 *
 * Boot sequence:
 *   1. WiFi provisioning (captive portal if no saved creds)
 *   2. Read WiFi channel → init ESP-NOW on same channel
 *   3. Listen for wearable packets
 *   4. On complete audio: upload to backend, retry on failure
 *
 * The receiver has no sensors — its only job is
 * radio relay (ESP-NOW → WiFi → HTTPS).
 */

#include <Arduino.h>
#include "config.h"
#include "protocol.h"
#include "nvs_store.h"
#include "wifi_manager.h"
#include "espnow_rx.h"
#include "http_upload.h"
#include "local_queue.h"

// ── State ───────────────────────────────────────────────────────────────────

static bool _espnowReady = false;

// ── Callbacks ───────────────────────────────────────────────────────────────

static void onAudioReady(uint8_t* wavData, size_t wavSize, float lat, float lon) {
  Serial.println(F("═══════════════════════════════════════════"));
  Serial.printf("[MAIN] 🎙 Audio received! %u bytes, GPS: %.6f, %.6f\n",
                wavSize, lat, lon);
  Serial.println(F("═══════════════════════════════════════════"));

  if (!wifiIsConnected()) {
    Serial.println(F("[MAIN] WiFi not connected — queueing for later"));
    localQueueAdd(wavData, wavSize, lat, lon);
    return;
  }

  // Attempt immediate upload
  bool success = httpUpload(wavData, wavSize, lat, lon);

  if (success) {
    Serial.println(F("[MAIN] ✅ Upload successful!"));
  } else {
    Serial.println(F("[MAIN] ⚠ Upload failed — queueing for retry"));
    localQueueAdd(wavData, wavSize, lat, lon);
  }
}

static void onTelemetry(float lat, float lon, uint8_t battPct) {
  Serial.printf("[MAIN] 📍 Wearable location: %.6f, %.6f (batt: %d%%)\n",
                lat, lon, battPct);
}

// ── ESP-NOW Init (called after WiFi connects) ──────────────────────────────

static void initEspNow() {
  if (_espnowReady) return;

  uint8_t channel = wifiGetChannel();
  Serial.printf("[MAIN] WiFi connected on channel %d — initializing ESP-NOW\n", channel);

  if (espnowRxInit(channel)) {
    espnowRxSetAudioCallback(onAudioReady);
    espnowRxSetTelemetryCallback(onTelemetry);
    _espnowReady = true;
    Serial.println(F("[MAIN] ESP-NOW receiver active — waiting for wearable"));
  } else {
    Serial.println(F("[MAIN] ESP-NOW init failed!"));
  }
}

// ── Arduino Setup ───────────────────────────────────────────────────────────

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(1000);

  Serial.println(F("═══════════════════════════════════════════"));
  Serial.println(F("  GuardianTrack Receiver — Booting..."));
  Serial.println(F("═══════════════════════════════════════════"));

  // NVS for WiFi credentials
  nvsStoreInit();

  // WiFi provisioning (captive portal if no saved creds)
  wifiManagerInit();

  // HTTP upload client
  httpUploadInit();

  // Local retry queue
  localQueueInit();

  // If WiFi connected at boot, init ESP-NOW immediately
  if (wifiIsConnected()) {
    initEspNow();
  }

  Serial.println(F("[MAIN] Boot complete."));
  Serial.print(F("[MAIN] MAC Address: "));
  Serial.println(WiFi.macAddress());
  Serial.println(F("═══════════════════════════════════════════"));
}

// ── Arduino Loop ────────────────────────────────────────────────────────────

void loop() {
  // WiFi provisioning / reconnection
  wifiManagerUpdate();

  // Init ESP-NOW once WiFi is connected (if not already)
  if (wifiIsConnected() && !_espnowReady) {
    initEspNow();
  }

  // Process completed audio payloads
  espnowRxUpdate();

  // Retry queued uploads
  localQueueUpdate();

  delay(10);
}
