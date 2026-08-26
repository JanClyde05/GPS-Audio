/*
 * GuardianTrack Wearable — Microphone Capture
 * =============================================
 * Shared interface: rest of firmware calls micInit() and micReadChunk()
 * without knowing which mic backend is active.
 *
 * Plan A: MH-ET / INMP441 (I2S digital) — GPIO6/7/8
 * Plan B: Custom electret + op-amp (ADC continuous) — GPIO4
 *
 * Selected at compile time via MIC_SOURCE define in config.h.
 */

#ifndef GUARDIANTRACK_MIC_CAPTURE_H
#define GUARDIANTRACK_MIC_CAPTURE_H

#include <Arduino.h>

// Initialize the selected mic backend
bool micInit();

// Read one chunk of 16-bit signed PCM samples.
// Returns number of samples actually read (may be < maxSamples).
size_t micReadChunk(int16_t* buf, size_t maxSamples);

// Stop and deinitialize the mic (free resources)
void micDeinit();

#endif // GUARDIANTRACK_MIC_CAPTURE_H
