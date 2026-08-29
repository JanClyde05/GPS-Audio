/*
 * GuardianTrack Receiver — HTTP Upload
 * ======================================
 * HTTPS POST of audio WAV + GPS metadata to Netlify Function.
 *
 * Sends multipart/form-data with:
 *   - "audio" field: WAV binary blob
 *   - "lat", "lon", "timestamp" fields: text metadata
 */

#include "http_upload.h"
#include "config.h"

#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

static WiFiClientSecure _secureClient;

void httpUploadInit() {
  // Use default CA bundle for HTTPS (covers *.netlify.app)
  _secureClient.setInsecure();  // Skip cert verification for now
  // For production: _secureClient.setCACert(rootCACert);
  Serial.println(F("[HTTP] Upload client initialized"));
}

bool httpUpload(uint8_t* wavData, size_t wavSize, float lat, float lon) {
  if (!wavData || wavSize == 0) {
    Serial.println(F("[HTTP] No data to upload!"));
    return false;
  }

  String url = String(BACKEND_URL) + String(UPLOAD_ENDPOINT);
  Serial.printf("[HTTP] Uploading %u bytes to %s\n", wavSize, url.c_str());

  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);

  WiFiClient plainClient;
  bool begun = url.startsWith("https://") ? http.begin(_secureClient, url) : http.begin(plainClient, url);

  if (!begun) {
    Serial.println(F("[HTTP] Connection failed!"));
    return false;
  }

  http.addHeader("Content-Type", "audio/wav");
  http.addHeader("X-Lat", String(lat, 6));
  http.addHeader("X-Lon", String(lon, 6));
  http.addHeader("X-Timestamp", String(millis()));

  // Stream wavData directly over socket — ZERO secondary RAM allocations
  int httpCode = http.POST(wavData, wavSize);

  if (httpCode == 200 || httpCode == 201) {
    String response = http.getString();
    Serial.printf("[HTTP] Upload success! Code: %d\n", httpCode);
    Serial.printf("[HTTP] Response: %s\n", response.c_str());
    http.end();
    return true;
  } else {
    Serial.printf("[HTTP] Upload failed! Code: %d\n", httpCode);
    if (httpCode > 0) {
      Serial.printf("[HTTP] Response: %s\n", http.getString().c_str());
    }
    http.end();
    return false;
  }
}

bool httpSendTelemetry(float lat, float lon, uint8_t battPct) {
  if (lat == 0.0f && lon == 0.0f) return false;

  String url = String(BACKEND_URL) + String(UPLOAD_ENDPOINT) +
               "?lat=" + String(lat, 6) +
               "&lon=" + String(lon, 6) +
               "&type=telemetry" +
               "&batt=" + String(battPct);

  HTTPClient http;
  http.setTimeout(5000);

  WiFiClient plainClient;
  bool begun = url.startsWith("https://") ? http.begin(_secureClient, url) : http.begin(plainClient, url);

  if (!begun) {
    Serial.println(F("[HTTP] Telemetry connection failed!"));
    return false;
  }

  int httpCode = http.POST("");

  if (httpCode == 200 || httpCode == 201) {
    Serial.printf("[HTTP] 📡 Live location uploaded: lat=%.6f, lon=%.6f\n", lat, lon);
    http.end();
    return true;
  } else {
    Serial.printf("[HTTP] Telemetry POST failed, code: %d\n", httpCode);
    http.end();
    return false;
  }
}
