/*
 * GuardianTrack Wearable — Audio Buffer
 * Manages a large contiguous buffer in PSRAM for recording audio.
 */

#ifndef GUARDIANTRACK_AUDIO_BUFFER_H
#define GUARDIANTRACK_AUDIO_BUFFER_H

#include <Arduino.h>

bool     bufferInit();
void     bufferReset();
bool     bufferWrite(const int16_t* samples, size_t count);
uint8_t* bufferGetData();      // Raw byte pointer to the buffer start
size_t   bufferGetSize();      // Current used size in bytes
size_t   bufferGetCapacity();  // Total capacity in bytes
bool     bufferIsFull();

#endif // GUARDIANTRACK_AUDIO_BUFFER_H
