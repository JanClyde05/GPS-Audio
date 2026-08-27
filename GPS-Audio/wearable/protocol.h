/*
 * GuardianTrack — Shared ESP-NOW Protocol
 * ========================================
 * Packet structures shared between wearable (TX) and receiver (RX).
 *
 * ESP-NOW max payload = 250 bytes.
 * Header = 7 bytes → 243 bytes usable per audio chunk.
 */

#ifndef GUARDIANTRACK_PROTOCOL_H
#define GUARDIANTRACK_PROTOCOL_H

#include <stdint.h>

// ── Packet Types ────────────────────────────────────────────────────────────

enum PacketType : uint8_t {
  PKT_TELEMETRY   = 0,   // GPS-only periodic update
  PKT_AUDIO_CHUNK = 1,   // One chunk of audio data
  PKT_AUDIO_END   = 2    // Final packet: signals end of audio stream
};

// ── Packet Header (7 bytes) ─────────────────────────────────────────────────

struct __attribute__((packed)) PacketHeader {
  uint8_t  packetType;     // PacketType enum
  uint16_t sequenceNum;    // For audio reassembly (0-based)
  uint32_t timestamp;      // millis() at send time
};

// ── Telemetry Payload (packet_type = 0) ─────────────────────────────────────

struct __attribute__((packed)) TelemetryPayload {
  PacketHeader header;
  float    latitude;
  float    longitude;
  uint8_t  batteryPct;     // 0–100, or 0 if unavailable
};

// ── Audio Chunk Payload (packet_type = 1) ───────────────────────────────────
// Max data per chunk: 250 - sizeof(PacketHeader) - sizeof(uint16_t) = 241 bytes
// We use 230 bytes to leave margin for ESP-NOW overhead on some boards.

#define AUDIO_CHUNK_MAX_DATA  230

struct __attribute__((packed)) AudioChunkPayload {
  PacketHeader header;
  uint16_t chunkLen;                    // Actual bytes in data[]
  uint8_t  data[AUDIO_CHUNK_MAX_DATA];  // Raw 16-bit PCM (little-endian)
};

// ── Audio End Payload (packet_type = 2) ─────────────────────────────────────

struct __attribute__((packed)) AudioEndPayload {
  PacketHeader header;
  uint16_t totalChunks;    // Total audio chunks sent (for integrity check)
  float    latitude;       // Last known GPS fix at time of send
  float    longitude;
};

// ── Audio Format Constants ──────────────────────────────────────────────────

#define AUDIO_SAMPLE_RATE   8000    // 8 kHz
#define AUDIO_BITS          16      // 16-bit signed PCM
#define AUDIO_CHANNELS      1       // Mono

// ── Telemetry Interval ──────────────────────────────────────────────────────

#define TELEMETRY_INTERVAL_MS  30000  // Send GPS telemetry every 30 seconds

#endif // GUARDIANTRACK_PROTOCOL_H
