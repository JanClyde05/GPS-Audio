# GuardianTrack — Master System Specification (Build-Ready)

## Consolidated Architecture, Pin Maps, Firmware Module Breakdown, Protocols, and Backend — For Full Codebase Generation

> **Purpose of this document:** Single source of truth to hand to an AI coding assistant (Opus 4.6 in Antigravity IDE) to generate the complete wearable firmware, receiver firmware, and backend code. Supersedes and consolidates the earlier GuardianTrack spec and PlanB mic addendum — this file should not omit anything decided in either.
>
> **Project status:** First full-build draft. Mechanical/PCB details, exact op-amp part, and receiver-placement assumption remain open (§12).

---

# 1. Project Overview

A two-device system: a body-worn **wearable** that continuously tracks GPS location and can record + send an audio clip to the wearer's parents on a button trigger, and a fixed **receiver** base station that relays that data to the cloud.

Trigger flow:
1. Wearer triple-clicks the button → wearable starts recording audio.
2. Wearer long-presses the button → recording stops, GPS fix + audio are sent to the receiver over ESP-NOW.
3. Receiver reassembles the payload and uploads it to the backend over WiFi/HTTPS.
4. Backend stores the audio (Netlify Blobs) and publishes a push notification via ntfy, linking to the clip and location.
5. Parent receives the notification, opens the dashboard, plays the audio, sees the location.

---

# 2. Bill of Materials

| Component | Role | Notes |
|---|---|---|
| ESP32-S3 SuperMini ×2 | Wearable + Receiver | Same board, different firmware builds |
| NEO-6M GPS module | Wearable location | UART, connects to board's labeled UART0 pins |
| MH-ET mic module (I2S, e.g. INMP441) | Wearable audio, Plan A | Digital, preferred if it arrives in time |
| Electret capsule + LM358 (or TL072/NE5532) custom preamp | Wearable audio, Plan B | Analog fallback, see §6 |
| LiPo battery | Wearable power | Direct to SuperMini's BAT+/BAT- pads (onboard charge IC) |
| Tactile button | Wearable trigger | 3-click = record, long-press = stop+send |
| (Receiver: no GPS/mic/battery needed — powered externally, WiFi + ESP-NOW only) | | |

---

# 3. System Architecture

```
           ┌─────────────────────────┐
           │         WEB APP         │
           │    Netlify Hosted UI    │
           │  Location + audio log   │
           └────────────┬────────────┘
                         │ HTTPS
                         ▼
           ┌─────────────────────────┐
           │         BACKEND         │
           │ Netlify Functions       │
           │ Netlify Blobs (audio)   │
           └───────┬─────────┬───────┘
                    │         └──────────► ntfy ──► Parent's phone
                 HTTPS
                 upload
                    │
                    ▼
┌───────────────────────────────────────────┐
│              RECEIVER (fixed)              │
│ ESP32-S3 SuperMini                         │
│   WiFi STA → router → internet             │
│   ESP-NOW listener + reassembly            │
└──────────────────┬────────────────────────┘
                    ▲ ESP-NOW (fixed channel, no pairing/router)
┌──────────────────┴────────────────────────┐
│              WEARABLE (body-worn)          │
│ ESP32-S3 SuperMini                         │
│   WiFi STA (radio-only, never associates)  │
│   ESP-NOW sender                           │
│ NEO-6M GPS · Mic (MH-ET or custom) · Button│
│ LiPo → BAT+/- (onboard charge IC)          │
└────────────────────────────────────────────┘
```

**Radio note:** ESP-NOW and WiFi STA share the same radio hardware and must run on the same channel. Receiver connects to the router first, reads its assigned channel, and that becomes the fixed ESP-NOW channel. Wearable sets its radio to that same channel via `esp_wifi_set_channel()` and never associates to any AP.

---

# 4. Wearable — Complete Pin Map (ESP32-S3 SuperMini)

| Signal | Pin | Notes |
|---|---|---|
| **GPS NEO-6M TX** | Board's labeled UART0 RX | Board's dedicated silkscreen TX/RX pair, not a generic GPIO |
| **GPS NEO-6M RX** | Board's labeled UART0 TX | Cross-connected: confirm the board's labeling convention (if "TX" = board transmits, then board TX→GPS RX, board RX→GPS TX) before wiring |
| **GPS NEO-6M VCC** | 3V3 or 5V | Per the specific GPS breakout's spec |
| **GPS NEO-6M GND** | GND | |
| **Button (signal)** | GPIO5 | Internal pull-up; debounced with OneButton library |
| **MH-ET mic — BCLK** | GPIO6 | I2S digital path (Plan A) |
| **MH-ET mic — WS/LRCLK** | GPIO7 | I2S digital path (Plan A) |
| **MH-ET mic — SD (data out)** | GPIO8 | I2S digital path (Plan A) |
| **MH-ET mic — L/R select** | GND | Ties to mono/left channel per INMP441-style convention |
| **MH-ET mic — VDD** | 3V3 | |
| **MH-ET mic — GND** | GND | |
| **Custom analog mic — output** | GPIO4 | ADC1 channel — must stay in GPIO1–10 range; ADC2 (GPIO11–20) is unreliable once WiFi/ESP-NOW is active |
| **Custom analog mic — V+** | 3V3 | Op-amp + bias divider + electret bias all off 3.3V, not 5V |
| **Custom analog mic — GND** | GND | |
| **LiPo BAT+/BAT-** | Board's dedicated BAT pads | Direct to onboard charge IC |

**Reserved/avoided:** GPIO0, 3, 45, 46 (strapping pins — do not use for peripherals with signal levels present at boot).

MH-ET and custom analog mic pins are fully disjoint by design (§6.2) so both can be physically populated simultaneously; firmware selects which one is active at compile time.

---

# 5. Receiver — Complete Pin Map (ESP32-S3 SuperMini)

| Signal | Pin | Notes |
|---|---|---|
| WiFi STA | (internal radio) | Connects to router; internet uplink |
| ESP-NOW listener | (internal radio) | Same radio as WiFi STA, same channel |
| Power | USB-C / 5V in | Fixed base station, no battery needed |

Receiver has no sensors — its only job is radio relay + HTTPS upload. No additional GPIO assignments needed for the base build.

---

# 6. Microphone — Dual Backend Detail

## 6.1 Plan A — MH-ET (I2S Digital)

If confirmed to be an INMP441-class I2S digital mic: cleanest option, no analog filter design, no ADC jitter concern. Capture via ESP32-S3's I2S peripheral in standard mode.

## 6.2 Plan B — Custom Electret + Op-Amp (Analog Fallback)

Use only if MH-ET doesn't arrive in time to build/test on schedule.

**Circuit (corrected from a wideband reference design, re-tuned for voice band and 3.3V rail):**

```
3.3V ── R1 (2.2k–4.7k) ── Electret(+)
Electret(-) ── GND
Electret(+) node ── Ccoupling (47nF) ── R2 (10k) ── op-amp (-)
3.3V ── R3 (10k) ──┬── R4 (10k) ── GND     (bias divider → 1.65V at op-amp +)
                    └── op-amp (+)
op-amp (-) ── R5 (330k) feedback, parallel with C4 (150pF) ── op-amp output
op-amp output ── GPIO4 (ADC1)
```

| Part | Value | Purpose |
|---|---|---|
| R1 | 2.2k–4.7k | Electret bias current (~0.3–0.5mA at 3.3V) |
| Ccoupling | 47nF | AC-couples signal, sets high-pass corner with R2 |
| R2 | 10k | Input resistor; sets HP corner (~339Hz) and gain (with R5) |
| R3, R4 | 10k, 10k | Bias divider → 1.65V at op-amp non-inverting input |
| R5 | 330k | Feedback resistor; sets gain (~33x) with R2 |
| C4 | 150pF | Feedback cap; sets low-pass corner (~3.2kHz) with R5 |

Resulting passband: **~339Hz–3.2kHz**, gain **~33x**, centered at 1.65V DC — matched to voice content and the 3.3V ADC range.

**Op-amp choice:** TL072 or NE5532 preferred over LM358 (avoids LM358's class-AB crossover distortion near the signal's operating point). LM358 is usable for a proof-of-concept if it's the only part on hand.

**Power rail:** circuit runs off 3.3V, not 5V — keeps output centered in ADC range with no attenuation network, and avoids any risk of a 5V-biased signal hitting a 3.3V-max GPIO.

## 6.3 Backend Selection (Compile-Time, Shared Interface)

```cpp
// mic_capture.h — shared interface; rest of firmware (ESP-NOW, buffering,
// GPS, button logic) calls only this and never knows which mic is active
bool micInit();
size_t micReadChunk(int16_t* buf, size_t maxSamples);

// mic_capture.cpp
#if MIC_SOURCE == MIC_SOURCE_I2S_DIGITAL   // MH-ET / INMP441 — GPIO6/7/8
  // I2S standard mode
#elif MIC_SOURCE == MIC_SOURCE_ADC_ANALOG  // custom board — GPIO4
  // I2S ADC continuous mode (NOT polling analogRead — avoids sample jitter)
#endif
```

`MIC_SOURCE` is set once at build time, whichever board is finished and verified working. No runtime auto-detection in this build.

---

# 7. Wearable Firmware Module Breakdown

```
/wearable
├── main.cpp              // setup/loop, task scheduling
├── gps.cpp/.h             // NEO-6M UART parsing, periodic fix
├── button.cpp/.h          // OneButton: 3-click start, long-press stop+send
├── mic_capture.cpp/.h     // dual-backend interface (§6.3)
├── audio_buffer.cpp/.h    // PSRAM/flash ring buffer, optional ADPCM compression
├── espnow_tx.cpp/.h       // packetization, chunked send, fixed peer MAC
├── radio_channel.cpp/.h   // sets WiFi radio to fixed channel, no AP association
└── power.cpp/.h           // battery/charge status if exposed by the SuperMini's IC
```

Recommend two FreeRTOS tasks on the dual-core S3: one for GPS + telemetry (low priority, periodic), one for audio capture + ESP-NOW send (higher priority during an active recording), so a slow transmit never blocks GPS updates.

---

# 8. Receiver Firmware Module Breakdown

```
/receiver
├── main.cpp
├── wifi_sta.cpp/.h        // connects to router, reads assigned channel
├── espnow_rx.cpp/.h       // listener, reassembles chunks by sequence number
├── http_upload.cpp/.h     // HTTPS POST to backend (GPS + audio)
└── local_queue.cpp/.h     // store-and-retry if backend briefly unreachable
```

---

# 9. Wireless Protocol (ESP-NOW, Wearable → Receiver)

```
Packet header:
  uint8_t  packet_type     // 0 = telemetry (GPS only), 1 = audio_chunk, 2 = audio_end
  uint16_t sequence_num    // for audio reassembly
  uint32_t timestamp

Telemetry payload (packet_type = 0):
  float latitude
  float longitude
  uint8_t battery_pct      // if available

Audio chunk payload (packet_type = 1):
  uint16_t chunk_len
  uint8_t  data[...]       // raw or ADPCM-compressed PCM

Audio end (packet_type = 2):
  uint16_t total_chunks
  float latitude           // last known GPS fix at time of send
  float longitude
```

Receiver reassembles by `sequence_num` until it sees `packet_type = 2`, then forwards the full clip + GPS to the backend.

---

# 10. Backend

```
Receiver (ESP32-S3)
      ↓ HTTPS POST
Netlify Functions
      ↓
Netlify Blobs (audio storage) + event/location log
      ↓
ntfy publish (server-side credential only — never in browser JS or on-device)
      ↓
Parent's phone — notification links to audio + GPS, not just an announcement
```

If a clip is too large for a direct Function POST (payload/execution limits), fall back to a signed Blob upload URL issued by a Function, with the receiver uploading directly to Blob storage.

No WebSocket requirement — event-driven upload on trigger, not a persistent connection, consistent with the [[meddispenser]] pattern.

---

# 11. Recommended Build Order

1. Wearable: GPS fix + serial print only — verify UART wiring and fix acquisition.
2. Wearable: button state machine (3-click / long-press) — verify with serial print, no audio yet.
3. Wearable: mic capture, whichever backend is ready first — verify locally (e.g. save to flash, inspect waveform) before adding radio.
4. ESP-NOW link: wearable → receiver, telemetry packets only — verify channel-locking works.
5. ESP-NOW: add audio chunking + reassembly on receiver.
6. Receiver: WiFi STA + HTTPS upload to a test backend endpoint.
7. Backend: Netlify Functions + Blobs storage.
8. Backend: ntfy notification wiring, credentials server-side only.
9. Full end-to-end test: trigger on wearable → notification + playable audio + location on parent's phone.

Do not attempt the full chain at once — verify each hop independently first, same principle as the MedBox project's phased build order.

---

# 12. Items Still Requiring Engineering Validation / Client Confirmation

- **Receiver-placement assumption (highest priority to confirm with client):** this architecture assumes the wearable is always within ESP-NOW range of a fixed receiver near WiFi. If the client expects the audio feature to work with the wearable far from any fixed receiver, the ESP-NOW hop needs to be replaced with WiFi/cellular directly on the wearable.
- Confirm actual MH-ET mic part (I2S digital vs. analog) before finalizing which plan is "Plan A."
- Confirm BAT+/BAT- charging IC presence on the specific SuperMini board revision in hand.
- Confirm the board's TX/RX silkscreen labeling convention before wiring GPS.
- Confirm GPIO4 actually maps to an ADC1 channel on the specific SuperMini revision (verify against that board's datasheet).
- Real-world ESP-NOW range/reliability in the client's actual use environment.
- Audio compression choice and resulting clip size vs. Netlify Function payload limits.
- Physical haptic (vibration) feedback — confirmed not wanted in this draft; revisit if client's expectations change.
- GPS fix rate vs. battery life tradeoff (continuous tracking draws non-trivial current on a wearable).
- Reminder/retry policy if the receiver's backend upload fails.
- Op-amp part actually available for Plan B (LM358 vs TL072 vs NE5532) — decide before ordering feedback caps.
- Breadboard-verify Plan B's bias point (~1.65V DC at op-amp output, no input) before connecting to GPIO4.
