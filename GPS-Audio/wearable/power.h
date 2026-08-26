/*
 * GuardianTrack Wearable — Power / Battery Monitor
 */

#ifndef GUARDIANTRACK_POWER_H
#define GUARDIANTRACK_POWER_H

#include <Arduino.h>

void    powerInit();
uint8_t powerGetBatteryPct();  // 0–100, or 0 if unavailable

#endif // GUARDIANTRACK_POWER_H
