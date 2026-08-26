/*
 * GuardianTrack Wearable — Power / Battery Monitor
 *
 * The ESP32-S3 SuperMini may or may not expose a battery voltage sense pin.
 * This module provides a placeholder that returns 0% if no sense pin is available.
 * Update BAT_SENSE_PIN if your board exposes one (often via a voltage divider).
 */

#include "power.h"
#include "config.h"

// Set to a valid ADC1 GPIO if the board exposes a battery sense pin.
// -1 = no battery sense available.
#define BAT_SENSE_PIN  -1

// Typical LiPo voltage range
#define BAT_FULL_MV   4200
#define BAT_EMPTY_MV  3200

void powerInit() {
  if (BAT_SENSE_PIN >= 0) {
    analogReadResolution(12);
    analogSetAttenuation(ADC_11db);
    Serial.printf("[PWR] Battery sense on GPIO%d\n", BAT_SENSE_PIN);
  } else {
    Serial.println(F("[PWR] No battery sense pin configured"));
  }
}

uint8_t powerGetBatteryPct() {
  if (BAT_SENSE_PIN < 0) {
    return 0;  // Unknown
  }

  // Read raw ADC and convert to millivolts
  // If using a voltage divider (e.g., 100k/100k), multiply by 2
  uint32_t raw = analogRead(BAT_SENSE_PIN);
  uint32_t mv  = (raw * 3300) / 4095;  // Direct read, no divider
  // uint32_t mv = (raw * 3300 * 2) / 4095;  // With 1:1 voltage divider

  if (mv >= BAT_FULL_MV) return 100;
  if (mv <= BAT_EMPTY_MV) return 0;

  return (uint8_t)((mv - BAT_EMPTY_MV) * 100 / (BAT_FULL_MV - BAT_EMPTY_MV));
}
