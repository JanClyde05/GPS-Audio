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
      } catch (formErr) {
        console.warn("[UPLOAD] formData() parse issue — attempting direct body extraction:", formErr);
      }
    }

    // Direct stream fallback if formData didn't extract audio
    if (!audioBuffer) {
      const rawBytes = await request.arrayBuffer();
      if (rawBytes && rawBytes.byteLength > 0) {
        audioBuffer = rawBytes;
      }
    }

    // ── Handle pure telemetry GPS pings (no audio file) ─────────────────
    if (!audioBuffer || audioBuffer.byteLength === 0 || type === "telemetry") {
      const eventId = `evt_telemetry_latest`;
      const eventData = {
        id: eventId,
        audioKey: "",
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        timestamp: parseInt(timestamp) || Date.now(),
        createdAt: new Date().toISOString(),
        isTelemetry: true,
      };

      await saveEvent(eventId, eventData);
      await updateEventIndex(eventId);

      console.log(`[TELEMETRY] Live location updated: ${lat}, ${lon}`);

      return new Response(JSON.stringify({ status: "ok", type: "telemetry", lat, lon }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate unique key for this audio event
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const audioKey = `${eventId}.wav`;
    const audioData = new Uint8Array(audioBuffer);

    // Store audio WAV data
    await saveAudio(audioKey, audioData, {
      contentType: "audio/wav",
      lat,
      lon,
      timestamp,
    });

    // Store event metadata
    const eventData = {
      id: eventId,
      audioKey,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      timestamp: parseInt(timestamp) || Date.now(),
      createdAt: new Date().toISOString(),
      audioSize: audioData.byteLength,
    };

    await saveEvent(eventId, eventData);
    await updateEventIndex(eventId);

    console.log(`[UPLOAD] ✅ Audio Event ${eventId}: ${audioData.byteLength} bytes, GPS: ${lat}, ${lon}`);

    // ── Fire ntfy notification ────────────────────────────────────────────
    const siteUrl = process.env.URL || "http://localhost:8888";
    const dashboardUrl = `${siteUrl}/#event-${eventId}`;
    const durationSec = Math.round(audioData.byteLength / (8000 * 2));

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
