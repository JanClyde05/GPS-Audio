/*
 * GuardianTrack Wearable — Radio Channel Lock
 * Sets WiFi radio to a fixed channel WITHOUT connecting to any AP.
 * The wearable ONLY uses ESP-NOW — no WiFi association.
 */

#include "radio_channel.h"
#include "config.h"

#include <WiFi.h>
#include <esp_wifi.h>

void radioChannelInit() {
  // Start WiFi in STA mode but do NOT connect to any AP
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();  // Ensure we're not associated

  // Lock to the same channel the receiver's router uses
  esp_wifi_set_channel(ESPNOW_CHANNEL, WIFI_SECOND_CHAN_NONE);

  Serial.printf("[RADIO] WiFi STA mode (no AP), channel locked to %d\n", ESPNOW_CHANNEL);

  // Print this device's MAC address (useful for debugging)
  Serial.print(F("[RADIO] Wearable MAC: "));
  Serial.println(WiFi.macAddress());
}
