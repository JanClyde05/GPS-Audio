/*
 * GuardianTrack Wearable — Configuration
 * ========================================
 * All pin assignments, timing constants, and compile-time options.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  BEFORE FLASHING: Update RECEIVER_MAC and ESPNOW_CHANNEL   │
 * │  to match your actual receiver board.                      │
 * └─────────────────────────────────────────────────────────────┘
 */

#ifndef GUARDIANTRACK_WEARABLE_CONFIG_H
#define GUARDIANTRACK_WEARABLE_CONFIG_H

// ── Receiver MAC Address ────────────────────────────────────────────────────
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  TODO: Replace with your receiver's actual MAC address.                │
// │  Flash the receiver first, read MAC from serial output, paste here.    │
// └──────────────────────────────────────────────────────────────────────────┘
#define RECEIVER_MAC  { 0x24, 0xEC, 0x4A, 0x30, 0x3A, 0x7C }  // <-- CHANGE THIS

// ── ESP-NOW Channel ─────────────────────────────────────────────────────────
// Must match the WiFi channel your receiver's router uses.
// The receiver prints this on boot. Common values: 1, 6, 11.
#define ESPNOW_CHANNEL  6  // <-- CHANGE THIS to match your router's channel

// ── GPS (NEO-6M via UART0) ──────────────────────────────────────────────────
// Board's labeled UART0 TX/RX pair (silkscreen).
// Cross-connected: board TX → GPS RX, board RX → GPS TX
#define GPS_RX_PIN       44   // Board's RX label (receives GPS TX)
#define GPS_TX_PIN       43   // Board's TX label (sends to GPS RX)
#define GPS_BAUD         9600

// ── Button ──────────────────────────────────────────────────────────────────
#define BUTTON_PIN       5    // Tactile button (internal pull-up)

// ── Microphone Source Selection ─────────────────────────────────────────────
// Set at compile time via platformio.ini build_flags:
//   -DMIC_SOURCE=MIC_SOURCE_I2S_DIGITAL   (Plan A: MH-ET / INMP441)
//   -DMIC_SOURCE=MIC_SOURCE_ADC_ANALOG    (Plan B: Custom electret + op-amp)

#define MIC_SOURCE_I2S_DIGITAL  1
#define MIC_SOURCE_ADC_ANALOG   2

#ifndef MIC_SOURCE
  #define MIC_SOURCE  MIC_SOURCE_I2S_DIGITAL  // Default: Plan A
#endif

// ── MH-ET / INMP441 I2S Mic Pins (Plan A) ──────────────────────────────────
#define I2S_MIC_BCLK     6    // Bit clock
#define I2S_MIC_WS       7    // Word select / LRCLK
#define I2S_MIC_SD       8    // Serial data (data out from mic)

// ── Custom Analog Mic Pin (Plan B) ──────────────────────────────────────────
// Must be ADC1 channel (GPIO1–10). ADC2 is unreliable with WiFi/ESP-NOW active.
#define ADC_MIC_PIN      4    // GPIO4 → ADC1_CH3

// ── Audio Recording ─────────────────────────────────────────────────────────
#define AUDIO_MAX_DURATION_SEC  30     // Max recording length
#define AUDIO_BUFFER_SIZE       (AUDIO_SAMPLE_RATE * 2 * AUDIO_MAX_DURATION_SEC)
                                       // 8000 * 2 bytes * 30s = 480,000 bytes

// ── LED Feedback ────────────────────────────────────────────────────────────
#define LED_PIN          -1   // Onboard LED (-1 if not available / not used)

// ── System ──────────────────────────────────────────────────────────────────
#define SERIAL_BAUD      115200

// ── Strapping Pins — DO NOT USE ─────────────────────────────────────────────
// GPIO0, GPIO3, GPIO45, GPIO46 — reserved by ESP32-S3 boot process.

#endif // GUARDIANTRACK_WEARABLE_CONFIG_H
