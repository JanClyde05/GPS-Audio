/*
 * GuardianTrack Wearable — GPS Module
 * NEO-6M UART NMEA parsing via TinyGPSPlus.
 */

#ifndef GUARDIANTRACK_GPS_H
#define GUARDIANTRACK_GPS_H

#include <Arduino.h>

void  gpsInit();
void  gpsUpdate();       // Call frequently (in loop or task) to feed parser
bool  gpsHasFix();
float gpsGetLat();
float gpsGetLon();
uint32_t gpsGetSatellites();

#endif // GUARDIANTRACK_GPS_H
