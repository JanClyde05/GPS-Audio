/*
 * GuardianTrack Receiver — Wi-Fi Manager
 * ========================================
 * Captive portal provisioning + connection management.
 * Adapted from MedDispenser's WiFi provisioning module.
 *
 * Pattern:
 *   - Boot: try NVS-saved credentials in STA mode
 *   - If no creds or connection fails: start SoftAP + captive portal
 *   - User connects to AP, selects network, enters password
 *   - Switch to AP_STA while trying connection (keep portal alive)
 *   - On success: save creds to NVS, stop AP, stay in STA mode
 *   - ESP-NOW inits AFTER WiFi connects (shares same channel)
 */

#include "wifi_manager.h"
#include "config.h"
#include "nvs_store.h"
#include <WiFi.h>
#include <DNSServer.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <esp_wifi.h>

// ── Internal state ──────────────────────────────────────────────────────────

static WifiState _state = WIFI_DISCONNECTED;
static DNSServer _dnsServer;
static AsyncWebServer _server(80);
static bool _apActive = false;
static bool _serverStarted = false;

// Pending connection from portal POST
static String _pendingSsid;
static String _pendingPass;
static bool _pendingConnect = false;
static bool _pendingConnectResult = false;
static bool _pendingConnectDone = false;

// ── Forward declarations ────────────────────────────────────────────────────

static bool    _tryConnect(const String& ssid, const String& pass, unsigned long timeoutMs);
static void    _startAP();
static void    _stopAP();
static void    _setupRoutes();
static void    _setState(WifiState newState);
static String  _scanNetworksJson();

// ── Public API ──────────────────────────────────────────────────────────────

void wifiManagerInit() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);

  // Initialize LittleFS for captive portal assets
  if (!LittleFS.begin(true)) {
    Serial.println(F("[WIFI] LittleFS mount failed!"));
  }

  // --- Boot connection sequence ---

  // 1. Try NVS-saved credentials
  if (nvsHasWifiCreds()) {
    String ssid = nvsGetWifiSsid();
    String pass = nvsGetWifiPass();
    Serial.print(F("[WIFI] Trying saved network: "));
    Serial.println(ssid);
    _setState(WIFI_CONNECTING);

    if (_tryConnect(ssid, pass, WIFI_CONNECT_TIMEOUT_MS)) {
      Serial.println(F("[WIFI] Connected to saved network!"));
      _setState(WIFI_CONNECTED);
      return;
    }
    Serial.println(F("[WIFI] Saved network failed"));
  }

  // 2. Fall back to SoftAP + captive portal
  Serial.println(F("[WIFI] No saved credentials or connection failed — starting AP"));
  _startAP();
}

void wifiManagerUpdate() {
  // Process DNS in AP mode (captive portal redirect)
  if (_apActive) {
    _dnsServer.processNextRequest();
  }

  // Handle pending connection attempts (from portal POST)
  if (_pendingConnect) {
    _pendingConnect = false;
    _setState(WIFI_CONNECTING);

    // Keep AP running while trying STA connection
    WiFi.mode(WIFI_AP_STA);

    bool success = _tryConnect(_pendingSsid, _pendingPass, WIFI_CONNECT_TIMEOUT_MS);

    _pendingConnectResult = success;
    _pendingConnectDone = true;

    if (success) {
      Serial.print(F("[WIFI] Connected via portal to: "));
      Serial.println(_pendingSsid);
      nvsSaveWifi(_pendingSsid, _pendingPass);

      // Brief delay so status response reaches the client
      delay(1000);
      _stopAP();
      _setState(WIFI_CONNECTED);
    } else {
      Serial.println(F("[WIFI] Portal connection attempt failed"));
      WiFi.mode(WIFI_AP);
      WiFi.softAP(WIFI_AP_SSID);
      _setState(WIFI_AP_MODE);
    }
  }

  // Monitor connection health
  if (_state == WIFI_CONNECTED && WiFi.status() != WL_CONNECTED) {
    Serial.println(F("[WIFI] Connection lost, attempting reconnect..."));
    _setState(WIFI_CONNECTING);

    WiFi.reconnect();
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && (millis() - start) < WIFI_CONNECT_TIMEOUT_MS) {
      delay(100);
    }

    if (WiFi.status() == WL_CONNECTED) {
      _setState(WIFI_CONNECTED);
    } else {
      Serial.println(F("[WIFI] Reconnect failed, entering AP mode"));
      _startAP();
    }
  }
}

bool wifiIsConnected() {
  return _state == WIFI_CONNECTED && WiFi.status() == WL_CONNECTED;
}

String wifiGetIP() {
  if (_state == WIFI_CONNECTED) return WiFi.localIP().toString();
  if (_state == WIFI_AP_MODE)   return WiFi.softAPIP().toString();
  return "0.0.0.0";
}

WifiState wifiGetState() {
  return _state;
}

uint8_t wifiGetChannel() {
  uint8_t primary;
  wifi_second_chan_t second;
  esp_wifi_get_channel(&primary, &second);
  return primary;
}

void wifiStartAP() {
  WiFi.disconnect(true);
  _startAP();
}

void wifiForgetNetwork() {
  nvsClearWifi();
  WiFi.disconnect(true);
  _startAP();
}

// ── Connection Attempt ──────────────────────────────────────────────────────

static bool _tryConnect(const String& ssid, const String& pass, unsigned long timeoutMs) {
  WiFi.disconnect(true);
  delay(100);
  WiFi.begin(ssid.c_str(), pass.c_str());

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - start) < timeoutMs) {
    delay(100);
  }

  return WiFi.status() == WL_CONNECTED;
}

// ── AP Mode ─────────────────────────────────────────────────────────────────

static void _startAP() {
  WiFi.disconnect(true);
  delay(100);
  WiFi.mode(WIFI_AP);
  delay(100);
  WiFi.softAP(WIFI_AP_SSID);
  delay(100);

  IPAddress apIP = WiFi.softAPIP();
  Serial.print(F("[WIFI] AP started: "));
  Serial.print(WIFI_AP_SSID);
  Serial.print(F(" IP: "));
  Serial.println(apIP);

  // DNS server — redirect all domains to AP IP (captive portal)
  _dnsServer.start(53, "*", apIP);

  // Setup web server routes (only once)
  if (!_serverStarted) {
    _setupRoutes();
    _server.begin();
    _serverStarted = true;
    Serial.println(F("[WIFI] Captive portal web server started"));
  }

  _apActive = true;
  _setState(WIFI_AP_MODE);
}

static void _stopAP() {
  _dnsServer.stop();
  _apActive = false;
  WiFi.mode(WIFI_STA);
  Serial.println(F("[WIFI] AP stopped, STA mode active"));
}

// ── Web Server Routes ───────────────────────────────────────────────────────

static void _setupRoutes() {
  // Inline HTML fallback if index.html is missing on LittleFS
  _server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (LittleFS.exists("/index.html")) {
      request->send(LittleFS, "/index.html", "text/html");
    } else {
      String html = F("<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
                      "<title>GuardianTrack WiFi Setup</title>"
                      "<style>body{font-family:sans-serif;padding:20px;background:#111;color:#eee}"
                      "input,button{display:block;width:100%;margin:10px 0;padding:12px;font-size:16px;box-sizing:border-box}"
                      "button{background:#007bff;color:#fff;border:none;border-radius:4px;cursor:pointer}</style></head><body>"
                      "<h2>GuardianTrack Wi-Fi Setup</h2>"
                      "<p>Select your network and enter your password:</p>"
                      "<form action='/connect' method='POST' onsubmit='sendForm(event)'>"
                      "<input type='text' id='ssid' placeholder='WiFi Network Name (SSID)' required>"
                      "<input type='password' id='pass' placeholder='WiFi Password'>"
                      "<button type='submit'>Connect</button></form>"
                      "<p id='msg'></p>"
                      "<script>"
                      "function sendForm(e){e.preventDefault();"
                      "var ssid=document.getElementById('ssid').value;"
                      "var pass=document.getElementById('pass').value;"
                      "fetch('/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ssid:ssid,pass:pass})})"
                      ".then(r=>r.json()).then(d=>{document.getElementById('msg').innerText='Connecting to '+ssid+'... Please wait 15s.';});}"
                      "</script></body></html>");
      request->send(200, "text/html", html);
    }
  });

  // Serve static files from LittleFS (data/ folder)
  _server.serveStatic("/", LittleFS, "/");

  // Network scan endpoint
  _server.on("/scan", HTTP_GET, [](AsyncWebServerRequest *request) {
    String json = _scanNetworksJson();
    request->send(200, "application/json", json);
  });

  // Connect endpoint
  _server.on("/connect", HTTP_POST, [](AsyncWebServerRequest *request) {
    // Handled in body handler below
  }, NULL, [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, data, len);

    if (err) {
      request->send(400, "application/json", "{\"status\":\"error\",\"message\":\"Invalid JSON\"}");
      return;
    }

    String ssid = doc["ssid"] | "";
    String pass = doc["pass"] | "";

    if (ssid.length() == 0) {
      request->send(400, "application/json", "{\"status\":\"error\",\"message\":\"SSID required\"}");
      return;
    }

    // Queue the connection attempt (don't block the async handler)
    _pendingSsid = ssid;
    _pendingPass = pass;
    _pendingConnect = true;
    _pendingConnectDone = false;

    request->send(200, "application/json", "{\"status\":\"connecting\"}");
  });

  // Status endpoint
  _server.on("/status", HTTP_GET, [](AsyncWebServerRequest *request) {
    JsonDocument doc;
    doc["state"] = (int)_state;

    switch (_state) {
      case WIFI_CONNECTED:
        doc["status"] = "connected";
        doc["ip"] = WiFi.localIP().toString();
        doc["ssid"] = WiFi.SSID();
        doc["channel"] = wifiGetChannel();
        break;
      case WIFI_CONNECTING:
        doc["status"] = "connecting";
        break;
      case WIFI_AP_MODE:
        doc["status"] = "ap_mode";
        break;
      default:
        doc["status"] = "disconnected";
        break;
    }

    if (_pendingConnectDone) {
      doc["connectResult"] = _pendingConnectResult ? "success" : "failed";
    }

    String response;
    serializeJson(doc, response);
    request->send(200, "application/json", response);
  });

  // Captive portal detection — redirect unknown requests to /
  _server.onNotFound([](AsyncWebServerRequest *request) {
    request->redirect("/");
  });
}

// ── Network Scan ────────────────────────────────────────────────────────────

static String _scanNetworksJson() {
  int n = WiFi.scanNetworks(false, false, false, 300);

  JsonDocument doc;
  JsonArray arr = doc.to<JsonArray>();

  for (int i = 0; i < n && i < 20; i++) {
    JsonObject net = arr.add<JsonObject>();
    net["ssid"] = WiFi.SSID(i);
    net["rssi"] = WiFi.RSSI(i);
    net["enc"]  = (WiFi.encryptionType(i) != WIFI_AUTH_OPEN);
  }

  WiFi.scanDelete();

  String result;
  serializeJson(doc, result);
  return result;
}

// ── State Management ────────────────────────────────────────────────────────

static void _setState(WifiState newState) {
  if (newState != _state) {
    _state = newState;
  }
}
