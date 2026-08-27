# GuardianTrack — Arduino IDE Setup & Upload Guide

This guide walks you through setting up **Arduino IDE** (version 2.x or 1.8.x) to compile and upload both the **Wearable** and **Receiver** firmware without using PlatformIO.

---

## 1. Install ESP32 Board Package

1. Open **Arduino IDE**.
2. Go to **File > Preferences** (or `Ctrl + ,`).
3. In **Additional Boards Manager URLs**, add the following URL:
   ```text
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Click **OK**.
5. Go to **Tools > Board > Boards Manager...**
6. Search for `esp32` and install **esp32 by Espressif Systems** (version 2.0.x or 3.0.x).

---

## 2. Install Required Libraries

Go to **Sketch > Include Library > Manage Libraries...** (or `Ctrl + Shift + I`) and search for and install each of the following:

| Library | Author | Purpose | Notes |
| :--- | :--- | :--- | :--- |
| **TinyGPSPlus** | Mikal Hart | NMEA parser for NEO-6M GPS module | Required by Wearable |
| **OneButton** | Matthias Hertel | Multi-click & long-press button handling | Required by Wearable |
| **ArduinoJson** | Benoit Blanchon | JSON parsing for API requests | Install **v7.x** |
| **ESPAsyncWebServer** | me-no-dev / mathieucarbou | Web server for Receiver captive portal | Required by Receiver |
| **AsyncTCP** | me-no-dev / mathieucarbou | Async TCP library for ESP32 | Dependency for ESPAsyncWebServer |

---

## 3. Uploading the Wearable Firmware (`wearable.ino`)

1. Open Arduino IDE.
2. Select **File > Open...** and navigate to:
   `GPS-Audio/wearable/wearable.ino`
3. Connect your **ESP32-S3 (Wearable)** board via USB.
4. Configure the **Tools** menu with these **EXACT** settings:
   - **Board**: `LOLIN S3 Mini` *(or `ESP32S3 Dev Module`)*
   - **PSRAM**: `OPI PSRAM` *(or `Enabled` — **CRITICAL** for the 480 KB audio buffer)*
   - **Partition Scheme**: `Huge APP (3MB No OTA/1MB SPIFFS)`
   - **Upload Speed**: `921600` (or `115200`)
   - **Port**: Select your board's COM port
5. Click **Upload** (`Ctrl + U`).

> [!IMPORTANT]
> **MAC Address Configuration:**
> Before uploading the Wearable firmware, make sure to update `RECEIVER_MAC` in `GPS-Audio/wearable/config.h` with your Receiver's MAC address! (The Receiver prints its MAC address in the Serial Monitor on boot).

---

## 4. Uploading the Receiver Firmware (`receiver.ino`)

1. Open Arduino IDE.
2. Select **File > Open...** and navigate to:
   `GPS-Audio/receiver/receiver.ino`
3. Connect your **ESP32-S3 (Receiver)** board via USB.
4. Configure the **Tools** menu:
   - **Board**: `LOLIN S3 Mini` *(or `ESP32S3 Dev Module`)*
   - **PSRAM**: `OPI PSRAM` *(or `Enabled`)*
   - **Partition Scheme**: `Huge APP (3MB No OTA/1MB SPIFFS)`
   - **Port**: Select your board's COM port
5. Click **Upload** (`Ctrl + U`).

---

## 5. Uploading Captive Portal Web Files (LittleFS)

The Receiver serves a web dashboard (`index.html`, `style.css`, `app.js`) stored in its flash memory (`data/` folder).

To upload the `data/` folder in Arduino IDE:

### Arduino IDE 2.x Method:
1. Install the **Arduino LittleFS Upload** extension for IDE 2.x (from [arduino-littlefs-upload](https://github.com/earlephilhower/arduino-littlefs-upload)).
2. Press `Ctrl + Shift + P` (or `Cmd + Shift + P` on macOS).
3. Select **Upload LittleFS to ESP32**.

### Arduino IDE 1.8.x Method:
1. Download `esp32fs.zip` plugin.
2. Place it in your `<sketchbook>/tools/ESP32FS/tool/esp32fs.jar`.
3. Restart Arduino IDE, go to **Tools > ESP32 Sketch Data Upload**.
