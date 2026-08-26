/*
 * GuardianTrack Receiver — Wi-Fi Manager
 * ========================================
 * Captive portal provisioning + connection management.
 * Adapted from MedDispenser's WiFi provisioning pattern.
 *
 * Boot sequence:
 *   1. Try NVS-saved credentials
 *   2. Fall back to SoftAP + captive portal for user to enter credentials
 *   3. Once connected, stop AP and switch to STA-only mode
 *
 * IMPORTANT: ESP-NOW must coexist with WiFi on the same channel.
 * After WiFi connects, read the assigned channel for ESP-NOW.
 */

#ifndef GUARDIANTRACK_WIFI_MANAGER_H
#define GUARDIANTRACK_WIFI_MANAGER_H

#include <Arduino.h>

enum WifiState : uint8_t {
  WIFI_DISCONNECTED = 0,
  WIFI_CONNECTING,
  WIFI_CONNECTED,
  WIFI_AP_MODE
};

void      wifiManagerInit();
void      wifiManagerUpdate();
bool      wifiIsConnected();
String    wifiGetIP();
WifiState wifiGetState();
uint8_t   wifiGetChannel();   // Returns the WiFi channel (for ESP-NOW)

// Force re-enter AP mode
void      wifiStartAP();

// Disconnect and clear saved credentials
void      wifiForgetNetwork();

#endif // GUARDIANTRACK_WIFI_MANAGER_H
