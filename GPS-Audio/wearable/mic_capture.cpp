/*
 * GuardianTrack Wearable — Microphone Capture
 * =============================================
 * Support for:
 *   1. MIC_SOURCE_I2S_DIGITAL  : INMP441 / MH-ET I2S Digital Mic (GPIO6/7/8)
 *   2. MIC_SOURCE_ADC_ANALOG   : Custom Electret + Op-Amp Preamp (GPIO4)
 *   3. MIC_SOURCE_KY038_ANALOG : KY-038 Electret Condenser Mic Module (A0 on GPIO4)
 *   4. MIC_SOURCE_TEST_TONE    : 440 Hz Pure Sine Wave Generator (Pipeline Check)
 *
 * All produce 8 kHz, 16-bit, mono PCM.
 */

#include "mic_capture.h"
#include "config.h"
#include "protocol.h"

// ════════════════════════════════════════════════════════════════════════════
// Plan 1 — I2S Digital Mic (MH-ET / INMP441)
// ════════════════════════════════════════════════════════════════════════════

#if MIC_SOURCE == MIC_SOURCE_I2S_DIGITAL

#include <driver/i2s.h>

#define I2S_PORT  I2S_NUM_0

bool micInit() {
  i2s_config_t i2sConfig = {
    .mode                 = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate          = AUDIO_SAMPLE_RATE,
    .bits_per_sample      = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format       = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags     = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count        = 8,
    .dma_buf_len          = 256,
    .use_apll             = false,
    .tx_desc_auto_clear   = false,
    .fixed_mclk           = 0
  };

  i2s_pin_config_t pinConfig = {
    .bck_io_num   = I2S_MIC_BCLK,
    .ws_io_num    = I2S_MIC_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num  = I2S_MIC_SD
  };

  esp_err_t err = i2s_driver_install(I2S_PORT, &i2sConfig, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("[MIC] I2S driver install failed: %d\n", err);
    return false;
  }

  err = i2s_set_pin(I2S_PORT, &pinConfig);
  if (err != ESP_OK) {
    Serial.printf("[MIC] I2S pin config failed: %d\n", err);
    return false;
  }

  i2s_zero_dma_buffer(I2S_PORT);

  Serial.println(F("[MIC] I2S digital mic initialized (Plan A)"));
  Serial.printf("      BCLK=GPIO%d  WS=GPIO%d  SD=GPIO%d\n",
                I2S_MIC_BCLK, I2S_MIC_WS, I2S_MIC_SD);
  Serial.printf("      Sample rate: %d Hz, 16-bit mono\n", AUDIO_SAMPLE_RATE);
  return true;
}

size_t micReadChunk(int16_t* buf, size_t maxSamples) {
  size_t bytesRead = 0;
  size_t bytesWanted = maxSamples * sizeof(int16_t);

  esp_err_t err = i2s_read(I2S_PORT, buf, bytesWanted, &bytesRead, pdMS_TO_TICKS(100));
  if (err != ESP_OK) {
    return 0;
  }

  return bytesRead / sizeof(int16_t);
}

void micDeinit() {
  i2s_driver_uninstall(I2S_PORT);
  Serial.println(F("[MIC] I2S driver uninstalled"));
}

void micGetDiagnostics(int &minRaw, int &maxRaw, int &avgRaw, float &dcBias) {
  minRaw = 0; maxRaw = 32767; avgRaw = 16384; dcBias = 0.0f;
}

// ════════════════════════════════════════════════════════════════════════════
// Plan 3 — KY-038 Electret Condenser Microphone Module (A0 on GPIO4)
// ════════════════════════════════════════════════════════════════════════════

#elif MIC_SOURCE == MIC_SOURCE_KY038_ANALOG

static float _dcBias   = 2048.0f;
static int   _lastMinR = 4095;
static int   _lastMaxR = 0;
static int   _lastAvgR = 2048;

bool micInit() {
  pinMode(ADC_MIC_PIN, INPUT);
  analogReadResolution(12);                          // 12-bit ADC mode (0..4095)
  analogSetPinAttenuation(ADC_MIC_PIN, ADC_11db);  // 11dB attenuation (0..3.3V range)
  _dcBias   = 2048.0f;
  _lastMinR = 4095;
  _lastMaxR = 0;
  _lastAvgR = 2048;

  Serial.println(F("════════════════════════════════════════════════════════════"));
  Serial.println(F("[MIC] KY-038 Electret Microphone Module Initialized"));
  Serial.printf("      Pin Wiring: KY-038 'A0' → ESP32-S3 GPIO%d\n", ADC_MIC_PIN);
  Serial.println(F("      Pin Wiring: KY-038 '+'  → 3.3V Power"));
  Serial.println(F("      Pin Wiring: KY-038 '-'  → GND"));
  Serial.println(F("      Feature: Auto-Tracking Trimmer Bias + Voice Amplification"));
  Serial.println(F("════════════════════════════════════════════════════════════"));
  return true;
}

size_t micReadChunk(int16_t* buf, size_t maxSamples) {
  uint32_t nextSampleUs = micros();

  int minVal = 4095;
  int maxVal = 0;
  long sumVal = 0;
  static bool togglePhase = false;

  for (size_t i = 0; i < maxSamples; i++) {
    // Exact 8000 Hz microsecond pacing (125us)
    while ((int32_t)(micros() - nextSampleUs) < 0) {}
    nextSampleUs += 125;

    int raw = analogRead(ADC_MIC_PIN);  // 0 .. 4095 from A0 pin

    if (raw < minVal) minVal = raw;
    if (raw > maxVal) maxVal = raw;
    sumVal += raw;

    // Adaptively track the KY-038 potentiometer DC baseline
    _dcBias = (_dcBias * 0.98f) + ((float)raw * 0.02f);

    float acLevel = (float)raw - _dcBias;
    int32_t val = 0;

    // KY-038 A0 signals are centered around the trimmer potentiometer setting
    if (_dcBias > 400.0f && _dcBias < 3600.0f) {
      // Balanced DC bias mode (Trimmed near center 1.65V)
      val = (int32_t)(acLevel * 48.0f);
    } else {
      // Off-center/ground-biased mode: apply Symmetrical AC wave reconstruction
      if (acLevel < 2.0f && acLevel > -2.0f) acLevel = 0.0f;  // Noise gate

      togglePhase = !togglePhase;
      float sign = togglePhase ? 1.0f : -1.0f;
      val = (int32_t)(fabsf(acLevel) * sign * 64.0f);
    }

    // Hard clip protection (-32768 to +32767)
    if (val > 32767) val = 32767;
    if (val < -32768) val = -32768;

    buf[i] = (int16_t)val;
  }

  _lastMinR = minVal;
  _lastMaxR = maxVal;
  _lastAvgR = (maxSamples > 0) ? (int)(sumVal / (long)maxSamples) : 2048;

  return maxSamples;
}

void micGetDiagnostics(int &minRaw, int &maxRaw, int &avgRaw, float &dcBias) {
  minRaw = _lastMinR;
  maxRaw = _lastMaxR;
  avgRaw = _lastAvgR;
  dcBias = _dcBias;
}

void micDeinit() {
  Serial.println(F("[MIC] KY-038 Analog Mic sampling stopped"));
}

// ════════════════════════════════════════════════════════════════════════════
// Plan 2 — Standard Custom Analog Mic (Op-Amp on GPIO4)
// ════════════════════════════════════════════════════════════════════════════

#elif MIC_SOURCE == MIC_SOURCE_ADC_ANALOG

static float _dcBias   = 2048.0f;
static int   _lastMinR = 4095;
static int   _lastMaxR = 0;
static int   _lastAvgR = 2048;

bool micInit() {
  pinMode(ADC_MIC_PIN, INPUT);
  analogReadResolution(12);
  analogSetPinAttenuation(ADC_MIC_PIN, ADC_11db);
  _dcBias   = 2048.0f;
  _lastMinR = 4095;
  _lastMaxR = 0;
  _lastAvgR = 2048;

  Serial.println(F("[MIC] Custom Analog Mic initialized on GPIO4"));
  return true;
}

size_t micReadChunk(int16_t* buf, size_t maxSamples) {
  uint32_t nextSampleUs = micros();
  int minVal = 4095, maxVal = 0;
  long sumVal = 0;

  for (size_t i = 0; i < maxSamples; i++) {
    while ((int32_t)(micros() - nextSampleUs) < 0) {}
    nextSampleUs += 125;

    int raw = analogRead(ADC_MIC_PIN);
    if (raw < minVal) minVal = raw;
    if (raw > maxVal) maxVal = raw;
    sumVal += raw;

    _dcBias = (_dcBias * 0.98f) + ((float)raw * 0.02f);
    float centered = (float)raw - _dcBias;
    int32_t val = (int32_t)(centered * 32.0f);

    if (val > 32767) val = 32767;
    if (val < -32768) val = -32768;

    buf[i] = (int16_t)val;
  }

  _lastMinR = minVal;
  _lastMaxR = maxVal;
  _lastAvgR = (maxSamples > 0) ? (int)(sumVal / (long)maxSamples) : 2048;
  return maxSamples;
}

void micGetDiagnostics(int &minRaw, int &maxRaw, int &avgRaw, float &dcBias) {
  minRaw = _lastMinR; maxRaw = _lastMaxR; avgRaw = _lastAvgR; dcBias = _dcBias;
}

void micDeinit() {
  Serial.println(F("[MIC] Custom Analog Mic stopped"));
}

// ════════════════════════════════════════════════════════════════════════════
// Plan 4 — 440 Hz Pure Sine Wave Test Tone Generator (Pipeline Verification)
// ════════════════════════════════════════════════════════════════════════════

#elif MIC_SOURCE == MIC_SOURCE_TEST_TONE

static float _sinePhase = 0.0f;

bool micInit() {
  _sinePhase = 0.0f;
  Serial.println(F("[MIC] 🧪 TEST TONE GENERATOR INITIALIZED (440 Hz Pure Sine Wave)"));
  return true;
}

size_t micReadChunk(int16_t* buf, size_t maxSamples) {
  uint32_t nextSampleUs = micros();
  const float phaseStep = 2.0f * 3.14159265f * 440.0f / 8000.0f;

  for (size_t i = 0; i < maxSamples; i++) {
    while ((int32_t)(micros() - nextSampleUs) < 0) {}
    nextSampleUs += 125;

    float sample = sinf(_sinePhase);
    _sinePhase += phaseStep;
    if (_sinePhase >= 2.0f * 3.14159265f) {
      _sinePhase -= 2.0f * 3.14159265f;
    }

    buf[i] = (int16_t)(sample * 16000.0f);
  }

  return maxSamples;
}

void micDeinit() {
  Serial.println(F("[MIC] Test Tone sampling stopped"));
}

void micGetDiagnostics(int &minRaw, int &maxRaw, int &avgRaw, float &dcBias) {
  minRaw = 0; maxRaw = 4095; avgRaw = 2048; dcBias = 2048.0f;
}

#else
  #error "MIC_SOURCE must be MIC_SOURCE_I2S_DIGITAL, MIC_SOURCE_ADC_ANALOG, MIC_SOURCE_KY038_ANALOG, or MIC_SOURCE_TEST_TONE"
#endif
