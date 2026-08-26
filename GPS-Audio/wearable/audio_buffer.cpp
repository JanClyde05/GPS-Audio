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
  _capacity = AUDIO_BUFFER_SIZE;

  // Try PSRAM first (ESP32-S3 typically has 2–8 MB)
  _buffer = (uint8_t*)ps_malloc(_capacity);
  if (_buffer) {
    Serial.printf("[ABUF] Allocated %u bytes in PSRAM\n", _capacity);
  } else {
    // Fallback to regular heap (will likely fail for large buffers)
    _buffer = (uint8_t*)malloc(_capacity);
    if (_buffer) {
      Serial.printf("[ABUF] Allocated %u bytes in heap (no PSRAM)\n", _capacity);
    } else {
      Serial.println(F("[ABUF] FATAL: Failed to allocate audio buffer!"));
      return false;
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
