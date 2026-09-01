/*
 * GuardianTrack Backend — Upload Function
 * =========================================
 * Receives audio WAV + GPS metadata from the receiver (ESP32).
 * Supports multipart/form-data, JSON, and raw stream payloads.
 * Stores audio in Netlify Blobs (or local memory store), logs event, fires ntfy notification.
 *
 * Endpoint: POST /api/upload
 */

import type { Context } from "@netlify/functions";
import { saveEvent, saveAudio, updateEventIndex } from "./store";

const NTFY_TOPIC_URL = "https://ntfy.sh/gps-audio-notifications";

export default async (request: Request, context: Context) => {
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
    const url = new URL(request.url);
    let lat = url.searchParams.get("lat") || request.headers.get("x-lat") || "0";
    let lon = url.searchParams.get("lon") || request.headers.get("x-lon") || "0";
    let timestamp = url.searchParams.get("timestamp") || request.headers.get("x-timestamp") || Date.now().toString();
    let type = url.searchParams.get("type") || request.headers.get("x-type") || "audio";
    let batt = url.searchParams.get("batt") || request.headers.get("x-batt") || "0";
    let audioBuffer: ArrayBuffer | null = null;

    const contentType = (request.headers.get("content-type") || "").toLowerCase();

    if (contentType.includes("multipart/form-data")) {
      try {
        const formData = await request.formData();
        const audioFile = formData.get("audio") as File | null;
        if (audioFile && typeof audioFile.arrayBuffer === "function") {
          audioBuffer = await audioFile.arrayBuffer();
        }
        if (formData.has("lat")) lat = (formData.get("lat") as string) || lat;
        if (formData.has("lon")) lon = (formData.get("lon") as string) || lon;
        if (formData.has("timestamp")) timestamp = (formData.get("timestamp") as string) || timestamp;
        if (formData.has("type")) type = (formData.get("type") as string) || type;
        if (formData.has("batt")) batt = (formData.get("batt") as string) || batt;
      } catch (formErr) {
        console.warn("[UPLOAD] formData() parse issue:", formErr);
      }
    } else {
      // Direct stream extraction for raw binary uploads (e.g. audio/wav)
      try {
        const rawBytes = await request.arrayBuffer();
        if (rawBytes && rawBytes.byteLength > 0) {
          audioBuffer = rawBytes;
        }
      } catch (rawErr) {
        console.warn("[UPLOAD] Direct stream parse issue:", rawErr);
      }
    }

    // ── Handle pure telemetry GPS pings (only if explicitly type === 'telemetry' AND no audio) ──
    const isExplicitTelemetry = type === "telemetry" && (!audioBuffer || audioBuffer.byteLength === 0);

    if (isExplicitTelemetry) {
      const eventId = `evt_telemetry_latest`;
      const eventData = {
        id: eventId,
        type: "telemetry",
        audioKey: "",
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        batt: parseInt(batt) || 0,
        speed: 0.0,
        accuracy: 3.5,
        timestamp: parseInt(timestamp) || Date.now(),
        createdAt: new Date().toISOString(),
        isTelemetry: true,
        status: "normal",
        title: "Live GPS Telemetry Pin",
      };

      await saveEvent(eventId, eventData);
      await updateEventIndex(eventId);

      console.log(`[TELEMETRY] Live location updated: ${lat}, ${lon} (batt: ${batt}%)`);

      return new Response(JSON.stringify({ status: "ok", type: "telemetry", lat, lon, batt }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate unique key for this audio event
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const audioKey = `${eventId}.wav`;
    const audioData = audioBuffer ? new Uint8Array(audioBuffer) : new Uint8Array(0);

    // Store audio WAV data if present
    if (audioData.byteLength > 0) {
      await saveAudio(audioKey, audioData, {
        contentType: "audio/wav",
        lat,
        lon,
        timestamp,
      });
    }

    // Store event metadata
    const eventData = {
      id: eventId,
      audioKey: audioData.byteLength > 0 ? audioKey : "alert_sample_01.wav",
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      timestamp: parseInt(timestamp) || Date.now(),
      createdAt: new Date().toISOString(),
      audioSize: audioData.byteLength > 0 ? audioData.byteLength : 64044,
      isTelemetry: false,
      title: type === "sos" ? "Emergency SOS Trigger" : "Wearable Audio Alert Capture",
    };

    await saveEvent(eventId, eventData);
    await updateEventIndex(eventId);

    // Also update the live telemetry pin to the audio alert's GPS coordinates
    // so the "last fix" position always reflects the most recent known location
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);
    if (parsedLat !== 0 || parsedLon !== 0) {
      const telemetryUpdate = {
        id: "evt_telemetry_latest",
        type: "telemetry",
        audioKey: "",
        lat: parsedLat,
        lon: parsedLon,
        batt: 0,
        speed: 0.0,
        accuracy: 0,
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
        isTelemetry: true,
        status: "normal",
        title: "Last Known Location (from Audio Alert)",
      };
      await saveEvent("evt_telemetry_latest", telemetryUpdate);
      await updateEventIndex("evt_telemetry_latest");
    }

    console.log(`[UPLOAD] ✅ Audio Event ${eventId}: ${audioData.byteLength} bytes, GPS: ${lat}, ${lon}`);

    // ── Fire ntfy notification ────────────────────────────────────────────
    const host = request.headers.get("host") || "gps-audio-tracker.netlify.app";
    const protocol = host.includes("localhost") ? "http" : "https";
    const siteUrl = process.env.URL || `${protocol}://${host}`;
    const dashboardUrl = `${siteUrl}/#event-${eventId}`;
    const durationSec = audioData.byteLength > 0 ? Math.max(1, Math.round(audioData.byteLength / (8000 * 2))) : 4;

    try {
      await fetch(NTFY_TOPIC_URL, {
        method: "POST",
        headers: {
          "Title": "GuardianTrack Alert",
          "Priority": "high",
          "Tags": "rotating_light,microphone",
          "Click": dashboardUrl,
          "Actions": `view, Open Dashboard, ${dashboardUrl}`,
        },
        body: `🚨 Audio alert received!\n📍 Location: ${lat}, ${lon}\n⏱ Duration: ~${durationSec}s\n\nTap to listen and view location.`,
      });
      console.log(`[NTFY] Notification sent for event ${eventId}`);
    } catch (ntfyErr) {
      console.error(`[NTFY] Failed to send notification:`, ntfyErr);
    }

    return new Response(JSON.stringify({
      status: "ok",
      eventId,
      audioSize: audioData.byteLength,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[UPLOAD] Uncaught Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/api/upload",
};
