/*
 * GuardianTrack Receiver — Local Queue
 * =====================================
 * Store-and-retry for failed uploads.
 * Uses LittleFS to persist audio WAV + metadata.
 *
 * Files stored as:
 *   /queue/0.wav, /queue/0.meta  (meta = lat,lon as text)
 *   /queue/1.wav, /queue/1.meta
 *   ...
 */

#include "local_queue.h"
#include "config.h"
#include "http_upload.h"
#include "wifi_manager.h"

#include <LittleFS.h>

#define QUEUE_DIR    "/queue"
#define MAX_QUEUED   5   // Max stored payloads (limited by flash space)

static uint32_t _lastRetryMs = 0;
static uint8_t  _queueCount  = 0;

// ── Helpers ─────────────────────────────────────────────────────────────────

static String _wavPath(uint8_t idx) {
  return String(QUEUE_DIR) + "/" + String(idx) + ".wav";
}

static String _metaPath(uint8_t idx) {
  return String(QUEUE_DIR) + "/" + String(idx) + ".meta";
}

static void _recount() {
  _queueCount = 0;
  for (uint8_t i = 0; i < MAX_QUEUED; i++) {
    if (LittleFS.exists(_wavPath(i))) {
      _queueCount++;
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

void localQueueInit() {
  if (!LittleFS.exists(QUEUE_DIR)) {
    LittleFS.mkdir(QUEUE_DIR);
  }
  _recount();
  Serial.printf("[QUEUE] Initialized, %u pending items\n", _queueCount);
}

bool localQueueAdd(uint8_t* wavData, size_t wavSize, float lat, float lon) {
  // Find an empty slot
  int slot = -1;
  for (uint8_t i = 0; i < MAX_QUEUED; i++) {
    if (!LittleFS.exists(_wavPath(i))) {
      slot = i;
      break;
    }
  }

  if (slot < 0) {
    Serial.println(F("[QUEUE] Queue full! Dropping oldest..."));
    // Remove slot 0 and shift
    LittleFS.remove(_wavPath(0));
    LittleFS.remove(_metaPath(0));
    for (uint8_t i = 1; i < MAX_QUEUED; i++) {
      if (LittleFS.exists(_wavPath(i))) {
        LittleFS.rename(_wavPath(i), _wavPath(i - 1));
        LittleFS.rename(_metaPath(i), _metaPath(i - 1));
      }
    }
    slot = _queueCount - 1;
    if (slot < 0) slot = 0;
  }

  // Write WAV data
  File f = LittleFS.open(_wavPath(slot), "w");
  if (!f) {
    Serial.println(F("[QUEUE] Failed to write WAV file!"));
    return false;
  }
  f.write(wavData, wavSize);
  f.close();

  // Write metadata
  f = LittleFS.open(_metaPath(slot), "w");
  if (!f) {
    LittleFS.remove(_wavPath(slot));
    return false;
  }
  f.printf("%.6f,%.6f", lat, lon);
  f.close();

  _recount();
  Serial.printf("[QUEUE] Queued item %d (%u bytes). Total: %u\n",
                slot, wavSize, _queueCount);
  return true;
}

void localQueueUpdate() {
  if (_queueCount == 0) return;
  if (!wifiIsConnected()) return;
  if (millis() - _lastRetryMs < UPLOAD_RETRY_INTERVAL_MS) return;

  _lastRetryMs = millis();

  Serial.printf("[QUEUE] Retrying %u queued uploads...\n", _queueCount);

  for (uint8_t i = 0; i < MAX_QUEUED; i++) {
    if (!LittleFS.exists(_wavPath(i))) continue;

    // Read WAV
    File wf = LittleFS.open(_wavPath(i), "r");
    if (!wf) continue;

    size_t wavSize = wf.size();
    uint8_t* wavData = (uint8_t*)ps_malloc(wavSize);
    if (!wavData) wavData = (uint8_t*)malloc(wavSize);
    if (!wavData) {
      wf.close();
      continue;
    }

    wf.read(wavData, wavSize);
    wf.close();

    // Read metadata
    float lat = 0, lon = 0;
    File mf = LittleFS.open(_metaPath(i), "r");
    if (mf) {
      String meta = mf.readString();
      mf.close();
      int comma = meta.indexOf(',');
      if (comma > 0) {
        lat = meta.substring(0, comma).toFloat();
        lon = meta.substring(comma + 1).toFloat();
      }
    }

    // Attempt upload
    bool success = httpUpload(wavData, wavSize, lat, lon);
    free(wavData);

    if (success) {
      LittleFS.remove(_wavPath(i));
      LittleFS.remove(_metaPath(i));
      Serial.printf("[QUEUE] Item %d uploaded and removed\n", i);
    } else {
      Serial.printf("[QUEUE] Item %d retry failed, keeping\n", i);
      break;  // Stop retrying — backend likely still down
    }
  }

  _recount();
}

uint8_t localQueueCount() {
  return _queueCount;
}
