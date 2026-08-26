/*
 * GuardianTrack Receiver — Local Queue
 * Store-and-retry for failed uploads.
 * Saves payloads to LittleFS when backend is unreachable.
 */

#ifndef GUARDIANTRACK_LOCAL_QUEUE_H
#define GUARDIANTRACK_LOCAL_QUEUE_H

#include <Arduino.h>

void localQueueInit();

// Enqueue a failed upload for later retry
bool localQueueAdd(uint8_t* wavData, size_t wavSize, float lat, float lon);

// Process the queue — attempt to upload any stored payloads
// Call periodically in loop()
void localQueueUpdate();

// Get number of pending items
uint8_t localQueueCount();

#endif // GUARDIANTRACK_LOCAL_QUEUE_H
