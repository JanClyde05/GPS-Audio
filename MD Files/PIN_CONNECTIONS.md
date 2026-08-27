# GuardianTrack — Hardware Pin Connections & Wiring Guide

This document provides the complete, authoritative pin mapping and wiring guide for both the **Wearable** unit and the **Receiver** base station using the **ESP32-S3 SuperMini** (LOLIN S3 Mini) microcontroller.

---

## 1. Wearable Device Pin Mapping

The Wearable unit integrates the ESP32-S3 SuperMini with a GPS module, microphone (digital or analog option), trigger button, and LiPo battery power.

### 📌 Summary Table

| Peripheral | Component Pin | ESP32-S3 SuperMini Pin | Description / Wiring Notes |
| :--- | :--- | :--- | :--- |
| **GPS (NEO-6M)** | TX | **GPIO44** (Board RX Label) | Cross-connected: GPS TX → ESP32 RX |
| | RX | **GPIO43** (Board TX Label) | Cross-connected: GPS RX → ESP32 TX |
| | VCC | **3V3** or **5V** | Depending on NEO-6M breakout voltage regulator |
| | GND | **GND** | Common Ground |
| **Button** | Terminal 1 | **GPIO5** | Input pin with internal pull-up enabled |
| | Terminal 2 | **GND** | Pressed = short to GND |
| **Digital Mic (Plan A)** | BCLK | **GPIO6** | I2S Bit Clock |
| *(INMP441 / MH-ET)* | WS / LRCLK | **GPIO7** | I2S Word Select |
| | SD | **GPIO8** | I2S Serial Data Out |
| | L/R Select | **GND** | Selects Left channel (mono) |
| | VDD | **3V3** | 3.3V Power |
| | GND | **GND** | Common Ground |
| **Analog Mic (Plan B)** | Audio Out | **GPIO4** | ADC1 Channel 3 (Must use ADC1 for WiFi/ESP-NOW safety) |
| *(Electret + LM358)* | VCC | **3V3** | Power for op-amp & electret bias |
| | GND | **GND** | Common Ground |
| **Power** | BAT+ | **BAT+ Pad** | Positive terminal of 3.7V LiPo Battery |
| | BAT- | **BAT- Pad** | Negative terminal of 3.7V LiPo Battery |

---

## 2. Audio Source Configuration

GuardianTrack supports two microphone hardware configurations, set in `wearable/config.h`:

### Option A: I2S Digital Microphone (INMP441 / MH-ET) — *Recommended*
```text
INMP441 Mic Pin      ESP32-S3 SuperMini Pin
───────────────      ──────────────────────
VDD  ──────────────► 3.3V
GND  ──────────────► GND
L/R  ──────────────► GND (Mono / Left Channel)
BCLK ──────────────► GPIO6
WS   ──────────────► GPIO7
SD   ──────────────► GPIO8
```

### Option B: Electret Microphone + LM358 Preamp (Analog)
```text
LM358 Preamp Pin     ESP32-S3 SuperMini Pin
────────────────     ──────────────────────
VCC  ──────────────► 3.3V
GND  ──────────────► GND
OUT  ──────────────► GPIO4 (ADC1_CH3)
```

> [!WARNING]
> **ADC Pin Constraint for WiFi / ESP-NOW:**
> When using an analog microphone, the output **MUST** connect to an **ADC1** pin (GPIO1–10). Pins on **ADC2** (GPIO11–20) are disabled internally by the ESP32 hardware whenever WiFi or ESP-NOW is active.

---

## 3. GPS (NEO-6M) Wiring Details

```text
NEO-6M GPS Pin       ESP32-S3 SuperMini Pin
──────────────      ──────────────────────
VCC  ──────────────► 3.3V / 5V
GND  ──────────────► GND
TX   ──────────────► GPIO44 (RX Silkscreen Label)
RX   ──────────────► GPIO43 (TX Silkscreen Label)
```

- **Baud Rate:** `9600`
- **UART Port:** `UART0`

---

## 4. Trigger Button Wiring

```text
Tactile Button       ESP32-S3 SuperMini Pin
──────────────      ──────────────────────
Pin 1 ─────────────► GPIO5
Pin 2 ─────────────► GND
```

- **Trigger Actions (Debounced via OneButton):**
  - **Triple-Click:** Starts 30-second audio recording.
  - **Long-Press (Hold 1s):** Stops recording immediately and transmits GPS location + audio via ESP-NOW.

---

## 5. Receiver Base Station Pin Mapping

The Receiver functions as an autonomous wireless base station. It requires no external sensors or button inputs.

```text
Receiver Power & System Connections
───────────────────────────────────
USB-C Port ────────► 5V Power Supply (Standard USB Charger or Power Bank)
Radio ─────────────► Onboard ESP32-S3 Wi-Fi Antenna (ESP-NOW + Wi-Fi STA)
```

---

## 6. Reserved Strapping Pins (Do Not Use)

> [!CAUTION]
> **ESP32-S3 Boot Strapping Pins:**
> The following pins control the ESP32-S3 boot mode during power-on reset. **Do NOT** connect peripherals or pull-up/pull-down resistors to these pins:
> - **GPIO0** (Boot mode select)
> - **GPIO3** (JTAG / Boot option)
> - **GPIO45** (VDD_SPI voltage selection)
> - **GPIO46** (Log output selection)
