/*
 * GuardianTrack Wearable — Button Handler
 * OneButton: triple-click = start recording, long-press = stop + send.
 */

#ifndef GUARDIANTRACK_BUTTON_H
#define GUARDIANTRACK_BUTTON_H

#include <Arduino.h>

// Callback types
typedef void (*ButtonCallback)();

void buttonInit(ButtonCallback onTripleClick, ButtonCallback onLongPress);
void buttonUpdate();  // Call in loop

#endif // GUARDIANTRACK_BUTTON_H
