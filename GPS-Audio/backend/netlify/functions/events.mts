/*
 * GuardianTrack Backend — Events Function
 * =========================================
 * Returns event log (JSON) for the parent dashboard.
 * Provides audio playback URLs via signed Blob access.
 *
 * GET /api/events          → all events (newest first)
 * GET /api/events?id=xxx   → single event detail
 * GET /api/events?audio=xxx → serve audio WAV file
 */

import { getStore } from "@netlify/blobs";
import type { Context } from "@netlify/functions";

export default async (request: Request, context: Context) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(request.url);
    const audioKey = url.searchParams.get("audio");
    const eventId = url.searchParams.get("id");

    const audioStore = getStore("audio-clips");
    const eventStore = getStore("events");

    // ── Serve audio file directly ─────────────────────────────────────────

    if (audioKey) {
      const audioBlob = await audioStore.get(audioKey, { type: "arrayBuffer" });
      if (!audioBlob) {
        return new Response(JSON.stringify({ error: "Audio not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(audioBlob, {
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
      const event = await eventStore.get(eventId, { type: "json" });
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

    let eventIndex: string[] = [];
    try {
      const existing = await eventStore.get("_index", { type: "json" }) as string[] | null;
      if (existing) eventIndex = existing;
    } catch {
      // No events yet
    }

    // Fetch event details for each ID
    const events = [];
    for (const id of eventIndex) {
      try {
        const evt = await eventStore.get(id, { type: "json" });
        if (evt) {
          events.push(evt);
        }
      } catch {
        // Skip corrupted entries
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
