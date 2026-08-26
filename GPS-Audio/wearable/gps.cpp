/*
 * GuardianTrack Wearable — GPS Module
 * NEO-6M UART NMEA parsing via TinyGPSPlus.
 */

#include "gps.h"
#include "config.h"
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>

// Use UART1 (not UART0 which is USB-serial debug) with remapped pins
static HardwareSerial gpsSerial(1);
static TinyGPSPlus    gps;

void gpsInit() {
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println(F("[GPS] UART initialized"));
  Serial.print(F("[GPS] RX=GPIO")); Serial.print(GPS_RX_PIN);
  Serial.print(F(" TX=GPIO"));      Serial.println(GPS_TX_PIN);
}

void gpsUpdate() {
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }
}

bool gpsHasFix() {
  return gps.location.isValid() && gps.location.isUpdated();
}

float gpsGetLat() {
  return gps.location.isValid() ? (float)gps.location.lat() : 0.0f;
}

float gpsGetLon() {
  return gps.location.isValid() ? (float)gps.location.lng() : 0.0f;
}

uint32_t gpsGetSatellites() {
  return gps.satellites.isValid() ? gps.satellites.value() : 0;
}
