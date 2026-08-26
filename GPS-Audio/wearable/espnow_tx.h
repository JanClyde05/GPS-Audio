/*
 * GuardianTrack Wearable — ESP-NOW Transmitter
 * Chunked audio send with sequence numbers + telemetry packets.
 */

#ifndef GUARDIANTRACK_ESPNOW_TX_H
#define GUARDIANTRACK_ESPNOW_TX_H

#include <Arduino.h>

bool espnowTxInit();
void sendTelemetry(float lat, float lon, uint8_t battPct);
bool sendAudioBuffer();  // Chunks and sends the entire audio buffer + end packet

#endif // GUARDIANTRACK_ESPNOW_TX_H
