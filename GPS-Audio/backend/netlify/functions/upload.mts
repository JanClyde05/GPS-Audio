/*
 * GuardianTrack Backend — Upload Function
 * =========================================
 * Receives audio WAV + GPS metadata from the receiver (ESP32).
 * Stores audio in Netlify Blobs, logs the event, fires ntfy notification.
 *
 * Endpoint: POST /api/upload
 * Content-Type: multipart/form-data
 *   Fields: audio (WAV file), lat, lon, timestamp
 */

import { getStore } from "@netlify/blobs";
import type { Context } from "@netlify/functions";

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  ntfy topic: gps-audio-notifications                                   │
// │  URL: https://ntfy.sh/gps-audio-notifications                          │
// │  TODO: Move topic to environment variable for production.              │
// └──────────────────────────────────────────────────────────────────────────┘
const NTFY_TOPIC_URL = "https://ntfy.sh/gps-audio-notifications";

export default async (request: Request, context: Context) => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Parse multipart form data
    const formData = await request.formData();

    const audioFile = formData.get("audio") as File | null;
    const lat = formData.get("lat") as string || "0";
    const lon = formData.get("lon") as string || "0";
    const timestamp = formData.get("timestamp") as string || Date.now().toString();

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "No audio file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate unique key for this event
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Get Netlify Blob stores
    const audioStore = getStore("audio-clips");
    const eventStore = getStore("events");

    // Store audio WAV in Blob storage
    const audioKey = `${eventId}.wav`;
    const audioBuffer = await audioFile.arrayBuffer();
    await audioStore.set(audioKey, new Uint8Array(audioBuffer), {
      metadata: {
        contentType: "audio/wav",
        lat,
        lon,
        timestamp,
      },
    });

    // Store event metadata
    const eventData = {
      id: eventId,
      audioKey,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      timestamp: parseInt(timestamp) || Date.now(),
      createdAt: new Date().toISOString(),
      audioSize: audioBuffer.byteLength,
    };

    await eventStore.setJSON(eventId, eventData);

    // Also append to an event index (list of event IDs)
    let eventIndex: string[] = [];
    try {
      const existing = await eventStore.get("_index", { type: "json" }) as string[] | null;
      if (existing) eventIndex = existing;
    } catch {
      // No index yet — start fresh
    }
    eventIndex.unshift(eventId);  // Newest first
    if (eventIndex.length > 100) eventIndex = eventIndex.slice(0, 100);  // Cap at 100
    await eventStore.setJSON("_index", eventIndex);

    console.log(`[UPLOAD] Event ${eventId}: ${audioBuffer.byteLength} bytes, GPS: ${lat}, ${lon}`);

    // ── Fire ntfy notification ────────────────────────────────────────────

    // Build the dashboard URL for this event
    const siteUrl = process.env.URL || "https://YOUR-SITE-NAME.netlify.app";
    const dashboardUrl = `${siteUrl}/#event-${eventId}`;

    const durationSec = Math.round(audioBuffer.byteLength / (8000 * 2));

    try {
      await fetch(NTFY_TOPIC_URL, {
        method: "POST",
        headers: {
          "Title": "🚨 GuardianTrack Alert",
          "Priority": "high",
          "Tags": "rotating_light,microphone",
          "Click": dashboardUrl,
          "Actions": `view, Open Dashboard, ${dashboardUrl}`,
        },
        body: `Audio alert received!\n📍 Location: ${lat}, ${lon}\n⏱ Duration: ~${durationSec}s\n\nTap to listen and view location.`,
      });
      console.log(`[NTFY] Notification sent for event ${eventId}`);
    } catch (ntfyErr) {
      console.error(`[NTFY] Failed to send notification:`, ntfyErr);
      // Don't fail the upload just because ntfy is down
    }

    // ── Return success ──────────────────────────────────────────────────

    return new Response(JSON.stringify({
      status: "ok",
      eventId,
      audioSize: audioBuffer.byteLength,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[UPLOAD] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/api/upload",
};
