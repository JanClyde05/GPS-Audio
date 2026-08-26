/*
 * GuardianTrack Receiver — ESP-NOW Receiver
 * Listens for packets from wearable, reassembles audio chunks.
 */

#ifndef GUARDIANTRACK_ESPNOW_RX_H
#define GUARDIANTRACK_ESPNOW_RX_H

#include <Arduino.h>

// Callback when a complete audio payload is ready (WAV data + GPS)
typedef void (*AudioReadyCallback)(uint8_t* wavData, size_t wavSize,
                                    float lat, float lon);

// Callback for telemetry packets
typedef void (*TelemetryCallback)(float lat, float lon, uint8_t battPct);

bool espnowRxInit(uint8_t channel);
void espnowRxSetAudioCallback(AudioReadyCallback cb);
void espnowRxSetTelemetryCallback(TelemetryCallback cb);
void espnowRxUpdate();  // Call in loop to process completed payloads

#endif // GUARDIANTRACK_ESPNOW_RX_H
