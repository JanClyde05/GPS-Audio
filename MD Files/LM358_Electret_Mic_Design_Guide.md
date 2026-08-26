# LM358 + Electret Microphone — Circuit Design Guide

## Derived From GreatScott!'s Reference Preamp, Re-Tuned for Voice Band + 3.3V ESP32-S3 ADC Input

> **Use case:** Plan B mic for the GuardianTrack wearable — used only if the MH-ET I2S mic module isn't ready in time. Feeds ESP32-S3 GPIO4 (ADC1).
>
> **This document teaches the derivation, not just the final values** — so the values can be re-tuned later if the target band, gain, or supply voltage changes.

---

# 1. Reference Circuit — What It Actually Does

The GreatScott! reference schematic (electret → C-coupled high-pass → NJM5532 non-inverting gain stage with a capacitive feedback low-pass) is a general-purpose wideband audio preamp, not a voice-band filter as-is. Working the RC math on its drawn values:

**High-pass corner** (input coupling caps C1/C3 = 470nF, into R2 = 47k):
```
fc = 1 / (2π · R · C) = 1 / (2π · 47,000 · 0.00000047) ≈ 7.2 Hz
```

**Low-pass corner** (feedback cap C4 = 10pF, across R5 = 1M):
```
fc = 1 / (2π · R · C) = 1 / (2π · 1,000,000 · 0.00000000001) ≈ 15.9 kHz
```

So the reference passes roughly 7Hz–16kHz — fine for general audio, wasteful for voice, and running at 5V (not directly ADC-safe on a 3.3V-max ESP32-S3 pin).

---

# 2. Design Goals For This Build

| Parameter | Target | Why |
|---|---|---|
| Passband | ~300Hz – 3.3kHz | Telephone-grade voice band — smaller files, less handling/wind noise, matches an 8kHz ADC sample rate cleanly |
| Supply | 3.3V single rail | Matches ESP32-S3 logic level directly — no attenuation network needed on the output, no risk to the ADC pin |
| Gain | ~30–40x | Typical electret output level needs this much gain to use the ADC's dynamic range well |
| Op-amp | TL072 or NE5532 preferred; LM358 usable | Avoids LM358's class-AB crossover distortion near the signal's operating point; LM358 is fine for a proof-of-concept if it's the only part on hand |

---

# 3. Deriving the Component Values

## 3.1 Electret bias (R1)

Electret capsules need a pull-up bias resistor to their internal FET drain. Target bias current ~0.3–0.5mA (lower self-noise, better battery life than the reference's ~4mA-at-5V design):
```
R1 = V / I = 3.3V / 0.0004A ≈ 8.25k  →  use 2.2k–4.7k range in practice
                                          (electret datasheets vary; start at 4.7k, reduce if signal is too weak)
```

## 3.2 High-pass corner (Ccoupling + R2)

Pick R2 = 10k (a common, easy-to-source value that also sets the gain ratio in §3.4). Solve for the coupling cap to hit ~300Hz:
```
C = 1 / (2π · fc · R) = 1 / (2π · 300 · 10,000) ≈ 53nF  →  use 47nF (standard value)
Actual resulting fc = 1 / (2π · 10,000 · 0.000000047) ≈ 339 Hz
```

## 3.3 Bias divider (R3, R4)

Single-supply op-amps need the non-inverting input held at mid-rail so the output can swing symmetrically:
```
R3 = R4 = 10k  →  midpoint = 3.3V / 2 = 1.65V at op-amp (+)
```

## 3.4 Gain + low-pass corner (R5, C4)

Gain is set by the R5/R2 ratio (non-inverting stage):
```
Gain = R5 / R2
Target gain ≈ 33  →  R5 = 33 × 10k = 330k
```

Low-pass corner set by C4 across R5, targeting ~3.2kHz to close out the voice band:
```
C = 1 / (2π · fc · R) = 1 / (2π · 3200 · 330,000) ≈ 150pF (standard value, close enough)
Actual resulting fc = 1 / (2π · 330,000 · 0.00000000015) ≈ 3.2 kHz
```

---

# 4. Final Component Table

| Part | Value | Purpose |
|---|---|---|
| Electret capsule | — | Signal source |
| R1 | 2.2k–4.7k | Electret bias current |
| Ccoupling | 47nF | AC-couples signal into R2, sets HP corner |
| R2 | 10k | Input resistor — sets HP corner and gain ratio |
| R3 | 10k | Bias divider top |
| R4 | 10k | Bias divider bottom |
| R5 | 330k | Feedback resistor — sets gain (~33x) |
| C4 | 150pF | Feedback cap — sets LP corner (~3.2kHz) |
| Op-amp | TL072 / NE5532 (LM358 acceptable) | Voltage gain stage |

Resulting passband: **~339Hz – 3.2kHz**, gain **~33x**, DC bias centered at **1.65V**.

---

# 5. Schematic

```
                         3.3V
                          │
                         R1 (2.2k–4.7k)
                          │
Electret(+) ───────────────┤
Electret(-) ── GND          │
                          │
                    Ccoupling (47nF)
                          │
                    ┌─────┴─────┐
                    │           │
                   R2 (10k)   (to op-amp -)
                          │
              3.3V ── R3 (10k) ──┬── R4 (10k) ── GND
                                  │
                          (to op-amp +, bias = 1.65V)
                                  │
                          ┌───────┴────────┐
                          │    LM358 (1/2)  │
                     ─────┤ -            out├───── to ESP32-S3 GPIO4 (ADC1)
                     ─────┤ +               │
                          └───────┬────────┘
                                  │
                          R5 (330k) feedback
                                  │
                          C4 (150pF) feedback, parallel with R5
                                  │
                              (back to op-amp -)
```

---

# 6. Gain-Bandwidth Sanity Check

LM358's typical gain-bandwidth product (GBW) is ~1MHz. At gain ≈33x and a signal band topping out near 3.2kHz, the demanded GBW is:
```
Required GBW ≈ Gain × Bandwidth = 33 × 3,200 Hz ≈ 106 kHz
```
Comfortably inside LM358's ~1MHz ceiling — bandwidth is not the limiting factor here. The limiting factor for LM358 specifically is crossover distortion near its output's operating point, not GBW. If gain is increased significantly later (e.g. for a quieter capsule), re-check this margin.

---

# 7. Build Steps

1. Breadboard the bias divider (R3/R4) and confirm ~1.65V at the midpoint with a multimeter before connecting anything else.
2. Wire the electret + R1 bias network, confirm DC voltage at the electret output (should sit near 3.3V minus a small drop, not near 0V or fully at rail — near either extreme suggests wrong R1 value or a dead capsule).
3. Add the coupling cap + R2 into the op-amp inverting input.
4. Wire the op-amp with R5/C4 feedback, power pins to 3.3V/GND.
5. **Before connecting to the ESP32:** measure DC output at the op-amp with no audio input — should read ~1.65V. If it's pinned near 0V or 3.3V, the circuit is clipped or misbiased; do not connect to the ADC pin until this reads correctly.
6. Speak/tap near the capsule and confirm the output swings around 1.65V on a multimeter's AC-coupled range or an oscilloscope if available.
7. Only after steps 1–6 pass, connect output to ESP32-S3 GPIO4.

---

# 8. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Output stuck near 0V or 3.3V | Bias divider not connected properly, or R1 value starving/overdriving the capsule |
| Very quiet output | R1 too high (starving capsule) or gain (R5/R2) too low for capsule sensitivity |
| Distorted/gritty audio, especially on louder sounds | LM358 crossover distortion — swap to TL072/NE5532 if available, or reduce gain |
| Hum or noise pickup | Long unshielded wires from capsule to op-amp; keep this run short, add a ground plane if moving to PCB |
| No signal at all | Check capsule polarity — electret capsules are polarized, reversed wiring gives no output |

---

# 9. Integration Note

This circuit's output feeds `mic_capture.cpp`'s `MIC_SOURCE_ADC_ANALOG` backend (GPIO4, I2S ADC continuous mode — not polling `analogRead()`, to avoid sample-timing jitter), as defined in the GuardianTrack Master Build Spec. No other part of the firmware needs to change based on which mic backend is active.
