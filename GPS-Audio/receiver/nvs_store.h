/*
 * GuardianTrack Receiver — NVS Persistent Storage
 * Stores WiFi credentials provisioned via the captive portal.
 */

#ifndef GUARDIANTRACK_NVS_STORE_H
#define GUARDIANTRACK_NVS_STORE_H

#include <Arduino.h>

void   nvsStoreInit();
bool   nvsHasWifiCreds();
String nvsGetWifiSsid();
String nvsGetWifiPass();
void   nvsSaveWifi(const String& ssid, const String& pass);
void   nvsClearWifi();

#endif // GUARDIANTRACK_NVS_STORE_H
