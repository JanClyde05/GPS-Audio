/*
 * GuardianTrack Backend — Events Function
 * =========================================
 * Returns event log (JSON) for the parent dashboard.
 * Provides audio playback URLs via signed Blob access or in-memory fallback.
 *
 * GET /api/events          → all events (newest first)
 * GET /api/events?id=xxx   → single event detail
 * GET /api/events?audio=xxx → serve audio WAV file
 */

import type { Context } from "@netlify/functions";
import { getEvent, getAudio, getEventIndex, clearAllStores } from "./store";

export default async (request: Request, context: Context) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const url = new URL(request.url);
    const audioKey = url.searchParams.get("audio");
    const eventId = url.searchParams.get("id");
    const clearParam = url.searchParams.get("clear");

    // ── Clear system memory & events ─────────────────────────────────────
    if (request.method === "DELETE" || clearParam === "true") {
      await clearAllStores();
      return new Response(JSON.stringify({ status: "ok", message: "System memory & events cleared" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Serve audio file directly ─────────────────────────────────────────
    if (audioKey) {
      const audioData = await getAudio(audioKey);
      if (!audioData) {
        return new Response(JSON.stringify({ error: "Audio not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(audioData, {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "Content-Disposition": `inline; filename="${audioKey}"`,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // ── Single event detail ───────────────────────────────────────────────
    if (eventId) {
      const event = await getEvent(eventId);
      if (!event) {
        return new Response(JSON.stringify({ error: "Event not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(event), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── List all events ───────────────────────────────────────────────────
    const index = await getEventIndex();
    const events = [];

    for (const id of index) {
      const evt = await getEvent(id);
      if (evt) {
        events.push(evt);
      }
    }

    return new Response(JSON.stringify({ events, total: events.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[EVENTS] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/api/events",
};
