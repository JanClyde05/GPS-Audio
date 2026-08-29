/*
 * GuardianTrack Wearable — Button Handler
 * OneButton: triple-click = start recording, long-press = stop + send.
 */

#include "button.h"
#include "config.h"
#include <OneButton.h>

static OneButton btn(BUTTON_PIN, true, true);  // active LOW, internal pull-up

static ButtonCallback _onTripleClick = nullptr;
static ButtonCallback _onLongPress   = nullptr;

// ── Callbacks ───────────────────────────────────────────────────────────────

static void _handleClick() {
  Serial.println(F("[BTN] Single-click detected on GPIO5! (Button circuit working OK)"));
}

static void _handleMultiClick() {
  int clicks = btn.getNumberClicks();
  if (clicks == 3 && _onTripleClick) {
    Serial.println(F("[BTN] Triple-click detected → START RECORDING"));
    _onTripleClick();
  }
}

static void _handleLongPressStart() {
  if (_onLongPress) {
    Serial.println(F("[BTN] Long-press detected → STOP + SEND"));
    _onLongPress();
  }
}

void buttonInit(ButtonCallback onTripleClick, ButtonCallback onLongPress) {
  _onTripleClick = onTripleClick;
  _onLongPress   = onLongPress;

  // Set GPIO5 mode explicitly
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  btn.attachClick(_handleClick);
  btn.attachMultiClick(_handleMultiClick);
  btn.attachLongPressStart(_handleLongPressStart);

  // Relax click timing for human-friendly triple-clicking (400ms between clicks)
  btn.setClickTicks(400);
  btn.setPressTicks(700);

  Serial.printf("[BTN] Initialized on GPIO%d (INPUT_PULLUP, Active LOW)\n", BUTTON_PIN);
  Serial.println(F("      Raw GPIO state debugger enabled on serial."));
  Serial.println(F("      Triple-click = record, Long-press = stop+send"));
}

static int _lastRawState = -1;

void buttonUpdate() {
  int currentRawState = digitalRead(BUTTON_PIN);
  if (currentRawState != _lastRawState) {
    _lastRawState = currentRawState;
    if (_lastRawState == LOW) {
      Serial.println(F("[RAW GPIO5] 🔽 Button Pressed -> Shorted to GND (LOW)"));
    } else {
      Serial.println(F("[RAW GPIO5] 🔼 Button Released -> Open (HIGH)"));
    }
  }

  btn.tick();
}
