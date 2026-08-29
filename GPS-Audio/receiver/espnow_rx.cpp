/*
 * GuardianTrack Receiver — ESP-NOW Receiver
 * ==========================================
 * Listens for ESP-NOW packets from wearable.
 * Reassembles audio chunks in-place into a WAV buffer (zero secondary allocations).
 * Fires callback when AUDIO_END is received.
 */

#include "espnow_rx.h"
#include "config.h"
#include "protocol.h"

#include <esp_now.h>
#include <esp_wifi.h>
#include <WiFi.h>
#include <string.h>

// ── WAV Header Helper ───────────────────────────────────────────────────────

static void _writeWavHeader(uint8_t* header, uint32_t dataSize) {
  uint32_t fileSize   = 36 + dataSize;
  uint32_t sampleRate = AUDIO_SAMPLE_RATE;
  uint16_t numChan    = AUDIO_CHANNELS;
  uint16_t bitsPerSmp = AUDIO_BITS;
  uint32_t byteRate   = sampleRate * numChan * (bitsPerSmp / 8);
  uint16_t blockAlign = numChan * (bitsPerSmp / 8);

  // RIFF header
  memcpy(header +  0, "RIFF", 4);
  memcpy(header +  4, &fileSize,   4);
  memcpy(header +  8, "WAVE", 4);
  // fmt sub-chunk
  memcpy(header + 12, "fmt ", 4);
  uint32_t fmtSize = 16;
  memcpy(header + 16, &fmtSize, 4);
  uint16_t audioFmt = 1;  // PCM
  memcpy(header + 20, &audioFmt,   2);
  memcpy(header + 22, &numChan,    2);
  memcpy(header + 24, &sampleRate, 4);
  memcpy(header + 28, &byteRate,   4);
  memcpy(header + 32, &blockAlign, 2);
  memcpy(header + 34, &bitsPerSmp, 2);
  // data sub-chunk
  memcpy(header + 36, "data", 4);
  memcpy(header + 40, &dataSize, 4);
}

// ── Reassembly State ────────────────────────────────────────────────────────

static uint8_t* _audioBuffer     = nullptr;
static size_t   _pcmOffset       = 0;
static size_t   _audioCapacity   = 0;
static uint16_t _chunksReceived   = 0;

// Completed payload pointers
static size_t   _completedSize   = 0;
static float    _completedLat    = 0;
static float    _completedLon    = 0;
static volatile bool _payloadReady = false;

// Callbacks
static AudioReadyCallback _audioCallback = nullptr;
static TelemetryCallback  _telemetryCb   = nullptr;

// ── ESP-NOW Receive Callback (ISR context — keep fast!) ─────────────────────

#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
static void _onReceive(const esp_now_recv_info_t* recvInfo,
                       const uint8_t* data, int len) {
  (void)recvInfo;
#else
static void _onReceive(const uint8_t* macAddr,
                       const uint8_t* data, int len) {
  (void)macAddr;
#endif
  if (len < (int)sizeof(PacketHeader)) return;

  const PacketHeader* hdr = (const PacketHeader*)data;

  switch (hdr->packetType) {

    case PKT_TELEMETRY: {
      if (len < (int)sizeof(TelemetryPayload)) return;
      const TelemetryPayload* pkt = (const TelemetryPayload*)data;
      Serial.printf("[ENOW] Telemetry: lat=%.6f lon=%.6f batt=%d%%\n",
                    pkt->latitude, pkt->longitude, pkt->batteryPct);
      if (_telemetryCb) {
        _telemetryCb(pkt->latitude, pkt->longitude, pkt->batteryPct);
      }
      break;
    }

    case PKT_AUDIO_CHUNK: {
      if (len < (int)(sizeof(PacketHeader) + sizeof(uint16_t))) return;
      const AudioChunkPayload* pkt = (const AudioChunkPayload*)data;

      // Store PCM data offset by 44 bytes to leave room for the WAV header
      size_t targetOffset = 44 + _pcmOffset;

      if (_audioBuffer && (targetOffset + pkt->chunkLen) <= _audioCapacity) {
        memcpy(_audioBuffer + targetOffset, pkt->data, pkt->chunkLen);
        _pcmOffset += pkt->chunkLen;
        _chunksReceived++;

        if (_chunksReceived % 50 == 0) {
          Serial.printf("[ENOW] Audio chunk %u received (%u bytes PCM)\n",
                        _chunksReceived, _pcmOffset);
        }
      } else {
        Serial.println(F("[ENOW] WARNING: Audio buffer overflow, chunk dropped!"));
      }
      break;
    }

    case PKT_AUDIO_END: {
      if (len < (int)sizeof(AudioEndPayload)) return;
      const AudioEndPayload* pkt = (const AudioEndPayload*)data;

      Serial.printf("[ENOW] Audio END received: %u/%u chunks, %u bytes\n",
                    _chunksReceived, pkt->totalChunks, _pcmOffset);

      if (_pcmOffset > 0 && !_payloadReady) {
        // Write WAV header directly in-place into the first 44 bytes of _audioBuffer!
        _writeWavHeader(_audioBuffer, _pcmOffset);

        _completedSize = 44 + _pcmOffset;
        _completedLat  = pkt->latitude;
        _completedLon  = pkt->longitude;
        _payloadReady  = true;

        Serial.printf("[ENOW] WAV assembled in-place: %u bytes (%.1f sec)\n",
                      _completedSize, (float)_pcmOffset / (AUDIO_SAMPLE_RATE * 2));
      } else {
        _pcmOffset = 0;
        _chunksReceived = 0;
      }
      break;
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

bool espnowRxInit(uint8_t channel) {
  // Allocate total buffer (PCM capacity + 44 bytes for WAV header)
  _audioCapacity = RX_AUDIO_BUFFER_SIZE + 44;

  // Try PSRAM allocation first
  _audioBuffer = (uint8_t*)ps_malloc(_audioCapacity);

  if (!_audioBuffer) {
    // Try internal RAM
    _audioBuffer = (uint8_t*)malloc(_audioCapacity);
  }

  if (!_audioBuffer) {
    // Fall back to 10 seconds (~160 KB + 44) in internal RAM
    _audioCapacity = (8000 * 2 * 10) + 44;
    _audioBuffer = (uint8_t*)malloc(_audioCapacity);
  }

  if (!_audioBuffer) {
    // Fall back to 4 seconds (~64 KB + 44) in internal RAM
    _audioCapacity = (8000 * 2 * 4) + 44;
    _audioBuffer = (uint8_t*)malloc(_audioCapacity);
  }

  if (!_audioBuffer) {
    Serial.println(F("[ENOW] FATAL: Cannot allocate audio reassembly buffer!"));
    return false;
  }

  _pcmOffset      = 0;
  _chunksReceived = 0;

  if (esp_now_init() != ESP_OK) {
    Serial.println(F("[ENOW] ESP-NOW init failed!"));
    return false;
  }

  esp_now_register_recv_cb(_onReceive);

  Serial.printf("[ENOW] ESP-NOW RX initialized on channel %d\n", channel);
  Serial.printf("[ENOW] In-place WAV buffer allocated: %u bytes\n", _audioCapacity);
  Serial.print(F("[ENOW] Receiver MAC: "));
  Serial.println(WiFi.macAddress());

  return true;
}

void espnowRxSetAudioCallback(AudioReadyCallback cb) {
  _audioCallback = cb;
}

void espnowRxSetTelemetryCallback(TelemetryCallback cb) {
  _telemetryCb = cb;
}

void espnowRxUpdate() {
  if (_payloadReady && _audioCallback) {
    _payloadReady = false;

    Serial.println(F("[ENOW] Delivering completed audio payload to HTTP uploader..."));
    _audioCallback(_audioBuffer, _completedSize, _completedLat, _completedLon);

    // Reset PCM offset for next recording (zero memory reallocation needed)
    _pcmOffset      = 0;
    _chunksReceived = 0;
  }
}
