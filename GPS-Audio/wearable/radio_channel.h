/*
 * GuardianTrack Wearable — Radio Channel Lock
 * Sets WiFi radio to a fixed channel WITHOUT connecting to any AP.
 * Required so ESP-NOW operates on the same channel as the receiver's router.
 */

#ifndef GUARDIANTRACK_RADIO_CHANNEL_H
#define GUARDIANTRACK_RADIO_CHANNEL_H

void radioChannelInit();

#endif // GUARDIANTRACK_RADIO_CHANNEL_H
