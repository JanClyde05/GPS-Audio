/*
 * GuardianTrack Wearable — Audio Buffer
 * Manages a large contiguous buffer in PSRAM for recording audio.
 * 30 seconds at 8kHz 16-bit mono = 480,000 bytes.
 */

#include "audio_buffer.h"
#include "config.h"
#include "protocol.h"

static uint8_t* _buffer   = nullptr;
static size_t   _capacity = 0;
static size_t   _used     = 0;

bool bufferInit() {
  _capacity = AUDIO_BUFFER_SIZE;  // 480,000 bytes (30 seconds)

  // Try PSRAM first (ESP32-S3 SuperMini with PSRAM)
  _buffer = (uint8_t*)ps_malloc(_capacity);
  if (_buffer) {
    Serial.printf("[ABUF] Successfully allocated %u bytes (30s) in PSRAM\n", _capacity);
  } else {
    // Fallback to internal heap with safe 10-second buffer (160,000 bytes = 10.0s recording)
    _capacity = 160000;
    _buffer = (uint8_t*)malloc(_capacity);
    if (_buffer) {
      Serial.printf("[ABUF] WARNING: PSRAM not active! Allocated %u bytes (~10.0s) in internal heap.\n", _capacity);
      Serial.println(F("[ABUF] NOTICE: Enable PSRAM in Arduino IDE (Tools > PSRAM > OPI PSRAM) for full 30s recording."));
    } else {
      // Fallback to 8-second buffer (128,000 bytes) if 160KB fails
      _capacity = 128000;
      _buffer = (uint8_t*)malloc(_capacity);
      if (_buffer) {
        Serial.printf("[ABUF] Allocated %u bytes (~8.0s) in internal heap.\n", _capacity);
      } else {
        Serial.println(F("[ABUF] FATAL: Failed to allocate audio buffer memory!"));
        return false;
      }
    }
  }

  _used = 0;
  return true;
}

void bufferReset() {
  _used = 0;
}

bool bufferWrite(const int16_t* samples, size_t count) {
  size_t bytesToWrite = count * sizeof(int16_t);

  if (_used + bytesToWrite > _capacity) {
    // Buffer full — clip at capacity
    bytesToWrite = _capacity - _used;
    count = bytesToWrite / sizeof(int16_t);
    if (count == 0) return false;  // Truly full
  }

  memcpy(_buffer + _used, samples, count * sizeof(int16_t));
  _used += count * sizeof(int16_t);
  return true;
}

uint8_t* bufferGetData() {
  return _buffer;
}

size_t bufferGetSize() {
  return _used;
}

size_t bufferGetCapacity() {
  return _capacity;
}

bool bufferIsFull() {
  return _used >= _capacity;
}
