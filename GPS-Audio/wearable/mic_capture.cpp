/*
 * GuardianTrack Wearable — Microphone Capture
 * =============================================
 * Dual-backend implementation:
 *   Plan A (MIC_SOURCE_I2S_DIGITAL): ESP32-S3 I2S peripheral in standard RX mode.
 *   Plan B (MIC_SOURCE_ADC_ANALOG):  I2S ADC continuous mode on GPIO4 (ADC1).
 *
 * Both produce 8 kHz, 16-bit, mono PCM.
 */

#include "mic_capture.h"
#include "config.h"
#include "protocol.h"

// ════════════════════════════════════════════════════════════════════════════
// Plan A — I2S Digital Mic (MH-ET / INMP441)
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

  // Clear any stale DMA data
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

// ════════════════════════════════════════════════════════════════════════════
// Plan B — ADC Analog Mic (Custom electret + op-amp on GPIO4)
// ════════════════════════════════════════════════════════════════════════════

#elif MIC_SOURCE == MIC_SOURCE_ADC_ANALOG

#include <driver/i2s.h>
#include <driver/adc.h>

#define I2S_PORT  I2S_NUM_0

// GPIO4 = ADC1_CH3 on ESP32-S3
#define ADC_CHANNEL  ADC1_CHANNEL_3

bool micInit() {
  // Configure ADC
  adc1_config_width(ADC_WIDTH_BIT_12);
  adc1_config_channel_atten(ADC_CHANNEL, ADC_ATTEN_DB_11);  // 0–3.3V range

  i2s_config_t i2sConfig = {
    .mode                 = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX | I2S_MODE_ADC_BUILT_IN),
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

  esp_err_t err = i2s_driver_install(I2S_PORT, &i2sConfig, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("[MIC] I2S ADC driver install failed: %d\n", err);
    return false;
  }

  // Route ADC to I2S
  err = i2s_set_adc_mode(ADC_UNIT_1, ADC_CHANNEL);
  if (err != ESP_OK) {
    Serial.printf("[MIC] I2S ADC mode set failed: %d\n", err);
    return false;
  }

  // Enable ADC → I2S
  i2s_adc_enable(I2S_PORT);

  Serial.println(F("[MIC] ADC analog mic initialized (Plan B)"));
  Serial.printf("      ADC pin: GPIO%d (ADC1_CH%d)\n", ADC_MIC_PIN, ADC_CHANNEL);
  Serial.printf("      Sample rate: %d Hz, 12-bit → 16-bit mono\n", AUDIO_SAMPLE_RATE);
  return true;
}

size_t micReadChunk(int16_t* buf, size_t maxSamples) {
  size_t bytesRead = 0;
  size_t bytesWanted = maxSamples * sizeof(int16_t);

  esp_err_t err = i2s_read(I2S_PORT, buf, bytesWanted, &bytesRead, pdMS_TO_TICKS(100));
  if (err != ESP_OK) {
    return 0;
  }

  size_t samplesRead = bytesRead / sizeof(int16_t);

  // Convert 12-bit unsigned ADC values to signed 16-bit PCM centered at 0
  // ADC output is in upper 12 bits of the 16-bit word, with channel info in lower 4 bits.
  // We need to: extract the 12-bit value, subtract DC bias (2048), scale to 16-bit range.
  for (size_t i = 0; i < samplesRead; i++) {
    uint16_t raw = (uint16_t)buf[i];
    // ESP32 I2S ADC mode: 12-bit ADC value is in bits [15:4], channel in [3:0]
    int16_t adcVal = (raw >> 4) & 0x0FFF;   // Extract 12-bit value
    int16_t centered = adcVal - 2048;         // Remove DC bias (mid-rail = 1.65V ≈ 2048)
    buf[i] = centered << 4;                   // Scale 12-bit → 16-bit range
  }

  return samplesRead;
}

void micDeinit() {
  i2s_adc_disable(I2S_PORT);
  i2s_driver_uninstall(I2S_PORT);
  Serial.println(F("[MIC] I2S ADC driver uninstalled"));
}

#else
  #error "MIC_SOURCE must be MIC_SOURCE_I2S_DIGITAL or MIC_SOURCE_ADC_ANALOG"
#endif
