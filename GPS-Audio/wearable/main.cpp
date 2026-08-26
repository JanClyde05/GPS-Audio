/*
 * GuardianTrack Wearable — Main
 * ==============================
 * ESP32-S3 SuperMini body-worn device.
 *
 * Trigger flow:
 *   1. Triple-click button → starts recording audio
 *   2. Long-press button   → stops recording, sends GPS + audio via ESP-NOW
 *
 * FreeRTOS tasks:
 *   Core 0: GPS polling (low priority, 1 Hz)
 *   Core 1: Audio capture (high priority, only during recording)
 *
 * Idle behavior: periodic telemetry (GPS) sent every 30 seconds.
 */

#include <Arduino.h>
#include "config.h"
#include "protocol.h"
#include "gps.h"
#include "button.h"
#include "mic_capture.h"
#include "audio_buffer.h"
#include "espnow_tx.h"
#include "radio_channel.h"
#include "power.h"

// ── Recording State ─────────────────────────────────────────────────────────

static volatile bool isRecording = false;
static volatile bool sendPending = false;

// ── FreeRTOS Task Handles ───────────────────────────────────────────────────

static TaskHandle_t gpsTaskHandle   = NULL;
static TaskHandle_t audioTaskHandle = NULL;

// ── Button Callbacks ────────────────────────────────────────────────────────

static void onTripleClick() {
  if (isRecording) {
    Serial.println(F("[MAIN] Already recording — ignoring triple-click"));
    return;
  }

  Serial.println(F("[MAIN] ▶ RECORDING STARTED"));
  bufferReset();
  isRecording = true;

  // Notify the audio task to start capturing
  if (audioTaskHandle) {
    xTaskNotifyGive(audioTaskHandle);
  }
}

static void onLongPress() {
  if (!isRecording) {
    Serial.println(F("[MAIN] Not recording — ignoring long-press"));
    return;
  }

  Serial.println(F("[MAIN] ⏹ RECORDING STOPPED — preparing to send"));
  isRecording = false;
  sendPending = true;
}

// ── GPS Task (Core 0) ──────────────────────────────────────────────────────

static void gpsTask(void* param) {
  (void)param;

  for (;;) {
    gpsUpdate();
    vTaskDelay(pdMS_TO_TICKS(100));  // Feed parser every 100ms
  }
}

// ── Audio Capture Task (Core 1) ─────────────────────────────────────────────

static void audioTask(void* param) {
  (void)param;

  // Temporary buffer for reading mic chunks
  const size_t chunkSamples = 256;
  int16_t chunk[chunkSamples];

  for (;;) {
    // Wait until notified (by triple-click)
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY);

    Serial.println(F("[AUDIO] Capture task activated"));

    // Initialize mic
    if (!micInit()) {
      Serial.println(F("[AUDIO] Mic init failed!"));
      isRecording = false;
      continue;
    }

    // Record until stopped or buffer full
    while (isRecording && !bufferIsFull()) {
      size_t samplesRead = micReadChunk(chunk, chunkSamples);
      if (samplesRead > 0) {
        bufferWrite(chunk, samplesRead);
      }
    }

    // Deinit mic to free resources
    micDeinit();

    if (bufferIsFull()) {
      Serial.println(F("[AUDIO] Buffer full — auto-stopping"));
      isRecording = false;
      sendPending = true;
    }

    Serial.printf("[AUDIO] Recorded %u bytes (%.1f seconds)\n",
                  bufferGetSize(),
                  (float)bufferGetSize() / (AUDIO_SAMPLE_RATE * 2));
  }
}

// ── Telemetry Timer ─────────────────────────────────────────────────────────

static uint32_t lastTelemetryMs = 0;

static void sendPeriodicTelemetry() {
  if (isRecording || sendPending) return;  // Don't interrupt active operations

  if (millis() - lastTelemetryMs >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMs = millis();

    if (gpsHasFix()) {
      sendTelemetry(gpsGetLat(), gpsGetLon(), powerGetBatteryPct());
    } else {
      Serial.printf("[MAIN] No GPS fix yet (sats: %u) — skipping telemetry\n",
                    gpsGetSatellites());
    }
  }
}

// ── Arduino Setup ───────────────────────────────────────────────────────────

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(1000);  // Wait for serial monitor

  Serial.println(F("═══════════════════════════════════════════"));
  Serial.println(F("  GuardianTrack Wearable — Booting..."));
  Serial.println(F("═══════════════════════════════════════════"));

  // Initialize subsystems
  powerInit();
  gpsInit();
  buttonInit(onTripleClick, onLongPress);

  // Initialize audio buffer (PSRAM)
  if (!bufferInit()) {
    Serial.println(F("[MAIN] FATAL: Audio buffer allocation failed!"));
  }

  // Initialize radio (WiFi STA mode, channel lock, ESP-NOW)
  radioChannelInit();
  if (!espnowTxInit()) {
    Serial.println(F("[MAIN] FATAL: ESP-NOW init failed!"));
  }

  // Create FreeRTOS tasks
  xTaskCreatePinnedToCore(gpsTask,   "GPS",   4096, NULL, 1, &gpsTaskHandle,   0);
  xTaskCreatePinnedToCore(audioTask, "Audio", 8192, NULL, 3, &audioTaskHandle, 1);

  Serial.println(F("[MAIN] Boot complete. Waiting for button trigger."));
  Serial.println(F("  Triple-click = start recording"));
  Serial.println(F("  Long-press   = stop + send"));
  Serial.println(F("═══════════════════════════════════════════"));
}

// ── Arduino Loop ────────────────────────────────────────────────────────────

void loop() {
  buttonUpdate();

  // Handle pending send (after recording stops)
  if (sendPending) {
    sendPending = false;

    Serial.println(F("[MAIN] 📡 Sending audio + GPS via ESP-NOW..."));

    bool success = sendAudioBuffer();

    if (success) {
      Serial.println(F("[MAIN] ✅ Audio sent successfully!"));
    } else {
      Serial.println(F("[MAIN] ⚠ Audio send had issues (check receiver)"));
    }

    bufferReset();
  }

  // Periodic GPS telemetry when idle
  sendPeriodicTelemetry();

  delay(10);  // Yield to other tasks
}
