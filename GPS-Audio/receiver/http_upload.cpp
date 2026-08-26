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

#include <HTTPClient.h>
#include <WiFiClientSecure.h>

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

  if (!http.begin(_secureClient, url)) {
    Serial.println(F("[HTTP] Connection failed!"));
    return false;
  }

  // Build multipart/form-data body
  String boundary = "----GuardianTrackBoundary" + String(millis());
  String contentType = "multipart/form-data; boundary=" + boundary;

  // Build the multipart body manually
  // We construct the parts around the binary WAV data

  // Part 1: latitude
  String preAudio = "";
  preAudio += "--" + boundary + "\r\n";
  preAudio += "Content-Disposition: form-data; name=\"lat\"\r\n\r\n";
  preAudio += String(lat, 6) + "\r\n";

  // Part 2: longitude
  preAudio += "--" + boundary + "\r\n";
  preAudio += "Content-Disposition: form-data; name=\"lon\"\r\n\r\n";
  preAudio += String(lon, 6) + "\r\n";

  // Part 3: timestamp
  preAudio += "--" + boundary + "\r\n";
  preAudio += "Content-Disposition: form-data; name=\"timestamp\"\r\n\r\n";
  preAudio += String(millis()) + "\r\n";

  // Part 4: audio file (WAV)
  preAudio += "--" + boundary + "\r\n";
  preAudio += "Content-Disposition: form-data; name=\"audio\"; filename=\"recording.wav\"\r\n";
  preAudio += "Content-Type: audio/wav\r\n\r\n";

  String postAudio = "\r\n--" + boundary + "--\r\n";

  // Calculate total content length
  size_t totalLen = preAudio.length() + wavSize + postAudio.length();

  http.addHeader("Content-Type", contentType);
  http.addHeader("Content-Length", String(totalLen));

  // We need to send the body manually since HTTPClient doesn't have
  // great multipart support. Use the stream approach.
  // Allocate a contiguous buffer (may be large — use PSRAM)
  uint8_t* body = (uint8_t*)ps_malloc(totalLen);
  if (!body) {
    body = (uint8_t*)malloc(totalLen);
  }

  if (!body) {
    Serial.println(F("[HTTP] Failed to allocate upload buffer!"));
    http.end();
    return false;
  }

  size_t offset = 0;
  memcpy(body + offset, preAudio.c_str(), preAudio.length());
  offset += preAudio.length();
  memcpy(body + offset, wavData, wavSize);
  offset += wavSize;
  memcpy(body + offset, postAudio.c_str(), postAudio.length());

  int httpCode = http.POST(body, totalLen);

  free(body);

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
