/*
 * GuardianTrack Wearable — ESP-NOW Transmitter
 * Chunked audio send with sequence numbers + telemetry packets.
 */

#include "espnow_tx.h"
#include "config.h"
#include "protocol.h"
#include "audio_buffer.h"
#include "gps.h"

#include <esp_now.h>
#include <esp_wifi.h>
#include <WiFi.h>

// ── Send tracking ───────────────────────────────────────────────────────────

static volatile bool _sendDone = false;
static volatile bool _sendOk   = false;

static uint8_t _receiverMac[] = RECEIVER_MAC;

// ── Send callback ───────────────────────────────────────────────────────────

#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
static void _onSendCb(const wifi_tx_info_t* info, esp_now_send_status_t status) {
  (void)info;
  _sendOk   = (status == ESP_NOW_SEND_SUCCESS);
  _sendDone = true;
}
#else
static void _onSendCb(const uint8_t* mac, esp_now_send_status_t status) {
  (void)mac;
  _sendOk   = (status == ESP_NOW_SEND_SUCCESS);
  _sendDone = true;
}
#endif

// Wait for send callback with timeout
static bool _waitSend(uint32_t timeoutMs = 500) {
  uint32_t start = millis();
  while (!_sendDone && (millis() - start) < timeoutMs) {
    delay(1);
  }
  bool ok = _sendDone && _sendOk;
  _sendDone = false;
  return ok;
}

// ── Public API ──────────────────────────────────────────────────────────────

bool espnowTxInit() {
  if (esp_now_init() != ESP_OK) {
    Serial.println(F("[ENOW] ESP-NOW init failed!"));
    return false;
  }

  esp_now_register_send_cb(_onSendCb);

  // Register receiver as peer
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, _receiverMac, 6);
  peer.channel = ESPNOW_CHANNEL;
  peer.encrypt = false;

  if (esp_now_add_peer(&peer) != ESP_OK) {
    Serial.println(F("[ENOW] Failed to add receiver peer!"));
    return false;
  }

  Serial.print(F("[ENOW] ESP-NOW TX initialized. Receiver MAC: "));
  for (int i = 0; i < 6; i++) {
    Serial.printf("%02X", _receiverMac[i]);
    if (i < 5) Serial.print(":");
  }
  Serial.printf("  Channel: %d\n", ESPNOW_CHANNEL);

  return true;
}

void sendTelemetry(float lat, float lon, uint8_t battPct) {
  TelemetryPayload pkt = {};
  pkt.header.packetType  = PKT_TELEMETRY;
  pkt.header.sequenceNum = 0;
  pkt.header.timestamp   = millis();
  pkt.latitude           = lat;
  pkt.longitude          = lon;
  pkt.batteryPct         = battPct;

  _sendDone = false;
  esp_now_send(_receiverMac, (uint8_t*)&pkt, sizeof(pkt));
  _waitSend();

  Serial.printf("[ENOW] Telemetry sent: lat=%.6f lon=%.6f batt=%d%%\n",
                lat, lon, battPct);
}

bool sendAudioBuffer() {
  uint8_t* data = bufferGetData();
  size_t   totalBytes = bufferGetSize();

  if (!data || totalBytes == 0) {
    Serial.println(F("[ENOW] No audio data to send!"));
    return false;
  }

  uint16_t totalChunks = (totalBytes + AUDIO_CHUNK_MAX_DATA - 1) / AUDIO_CHUNK_MAX_DATA;
  uint16_t seq = 0;
  size_t   offset = 0;
  uint32_t failCount = 0;

  Serial.printf("[ENOW] Sending %u bytes in %u chunks...\n", totalBytes, totalChunks);

  while (offset < totalBytes) {
    size_t remaining = totalBytes - offset;
    size_t chunkLen  = (remaining > AUDIO_CHUNK_MAX_DATA) ? AUDIO_CHUNK_MAX_DATA : remaining;

    AudioChunkPayload pkt = {};
    pkt.header.packetType  = PKT_AUDIO_CHUNK;
    pkt.header.sequenceNum = seq;
    pkt.header.timestamp   = millis();
    pkt.chunkLen           = (uint16_t)chunkLen;
    memcpy(pkt.data, data + offset, chunkLen);

    // Send only the actual size (header + chunkLen field + data)
    size_t pktSize = sizeof(PacketHeader) + sizeof(uint16_t) + chunkLen;

    _sendDone = false;
    esp_err_t err = esp_now_send(_receiverMac, (uint8_t*)&pkt, pktSize);

    if (err == ESP_OK && _waitSend(200)) {
      // Success
    } else {
      failCount++;
      // Retry once
      delay(10);
      _sendDone = false;
      esp_now_send(_receiverMac, (uint8_t*)&pkt, pktSize);
      _waitSend(200);
    }

    offset += chunkLen;
    seq++;

    // Small delay between chunks to avoid overwhelming the receiver
    delay(5);

    // Progress log every 50 chunks
    if (seq % 50 == 0) {
      Serial.printf("[ENOW] Progress: %u / %u chunks\n", seq, totalChunks);
    }
  }

  // Send AUDIO_END packet
  AudioEndPayload endPkt = {};
  endPkt.header.packetType  = PKT_AUDIO_END;
  endPkt.header.sequenceNum = seq;
  endPkt.header.timestamp   = millis();
  endPkt.totalChunks        = totalChunks;
  endPkt.latitude           = gpsGetLat();
  endPkt.longitude          = gpsGetLon();

  _sendDone = false;
  esp_now_send(_receiverMac, (uint8_t*)&endPkt, sizeof(endPkt));
  _waitSend(500);

  Serial.printf("[ENOW] Audio send complete! %u chunks, %u failures\n",
                totalChunks, failCount);

  return failCount < (totalChunks / 4);  // Consider success if < 25% packet loss
}
