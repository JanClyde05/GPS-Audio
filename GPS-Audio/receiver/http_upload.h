/*
 * GuardianTrack Receiver — HTTP Upload
 * HTTPS POST of audio WAV + GPS metadata to Netlify Function.
 */

#ifndef GUARDIANTRACK_HTTP_UPLOAD_H
#define GUARDIANTRACK_HTTP_UPLOAD_H

#include <Arduino.h>

void httpUploadInit();

// Upload a WAV audio clip + GPS coordinates to the backend.
// Returns true on success (HTTP 200).
bool httpUpload(uint8_t* wavData, size_t wavSize, float lat, float lon);

// Upload periodic GPS telemetry ping to the backend (live map tracking).
bool httpSendTelemetry(float lat, float lon, uint8_t battPct);

#endif // GUARDIANTRACK_HTTP_UPLOAD_H
