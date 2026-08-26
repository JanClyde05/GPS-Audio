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

// ── Public API ──────────────────────────────────────────────────────────────

void buttonInit(ButtonCallback onTripleClick, ButtonCallback onLongPress) {
  _onTripleClick = onTripleClick;
  _onLongPress   = onLongPress;

  btn.attachMultiClick(_handleMultiClick);
  btn.attachLongPressStart(_handleLongPressStart);

  // Tuning: require 3 clicks within 600ms, long-press after 800ms
  btn.setClickTicks(200);
  btn.setPressTicks(800);

  Serial.println(F("[BTN] Initialized on GPIO" ));
  Serial.print(F("      Triple-click = record, Long-press = stop+send"));
  Serial.println();
}

void buttonUpdate() {
  btn.tick();
}
