import express from "express";
import path from "path";
import multer from "multer";
import cors from "cors";
import { createServer as createViteServer } from "vite";

interface StoredEvent {
  id: string;
  lat: number;
  lon: number;
  type: 'telemetry' | 'audio' | 'sos';
  isTelemetry?: boolean;
  audioKey?: string;
  audioSize?: number;
  batt?: number | string;
  signal?: number | string;
  speed?: number;
  accuracy?: number;
  createdAt: string;
  status?: 'normal' | 'alert' | 'critical';
  title?: string;
}

// Stores binary WAV audio files in memory
const audioStore = new Map<string, Buffer>();

// Seed events list
let eventsStore: StoredEvent[] = [];

// Fallback sample WAV generator
function generateSampleWavBuffer(durationSeconds = 4, freq = 440): Buffer {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate * durationSeconds;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.sin((Math.PI * i) / numSamples);
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.4;
    const intSample = Math.floor(sample * envelope * 32767);
    buffer.writeInt16LE(intSample, offset);
    offset += 2;
  }

  return buffer;
}

const sampleWavCache = generateSampleWavBuffer(4, 440);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 8888;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(express.raw({ type: "*/*", limit: "50mb" }));

  const upload = multer({ storage: multer.memoryStorage() });

  // 1. GET /api/events (Return events list or stream audio if audio query is present)
  app.get("/api/events", (req, res) => {
    const audioKey = req.query.audio as string;

    if (audioKey) {
      const storedBuffer = audioStore.get(audioKey);
      const bufferToSend = storedBuffer || sampleWavCache;

      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Content-Length", bufferToSend.length);
      res.setHeader("Accept-Ranges", "bytes");
      return res.send(bufferToSend);
    }

    res.json({
      status: "ok",
      count: eventsStore.length,
      events: eventsStore
    });
  });

  // 2. DELETE /api/events (Clear logs)
  app.delete("/api/events", (req, res) => {
    eventsStore = [];
    audioStore.clear();
    res.json({
      status: "ok",
      message: "Events cleared successfully",
      events: eventsStore
    });
  });

  // 3. POST /clear-memory (Purge ESP32 Receiver & Server Memory)
  app.post("/clear-memory", (req, res) => {
    eventsStore = [];
    audioStore.clear();
    console.log("[SERVER] ⚡ Memory and event store purged.");
    res.json({ status: "ok", message: "Receiver and server memory cleared" });
  });

  // 4. POST /api/upload (Telemetry & Audio upload endpoint for ESP32 and UI testing)
  app.post("/api/upload", upload.single("audio"), (req: any, res) => {
    try {
      // Extract coordinates from query params, body, or headers
      const latStr = (req.query.lat as string) || req.body.lat || req.headers["x-lat"] || "0";
      const lonStr = (req.query.lon as string) || req.body.lon || req.headers["x-lon"] || "0";
      const typeStr = (req.query.type as string) || req.body.type || req.headers["x-type"] || "audio";

      const lat = parseFloat(latStr) || 0;
      const lon = parseFloat(lonStr) || 0;
      const type = typeStr === "telemetry" ? "telemetry" : (typeStr === "sos" ? "sos" : "audio");
      const isTelemetry = type === "telemetry";
      const battRaw = req.body.batt ?? req.query.batt ?? req.headers["x-batt"];
      const batt = (battRaw !== undefined && battRaw !== null && battRaw !== "") ? parseInt(String(battRaw), 10) : 0;

      let audioBuffer: Buffer | null = null;
      if (req.file) {
        audioBuffer = req.file.buffer;
      } else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
        audioBuffer = req.body;
      }

      const audioSize = audioBuffer ? audioBuffer.length : (isTelemetry ? 0 : 64044);
      const eventId = isTelemetry ? "evt-telemetry-latest" : `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const audioKey = !isTelemetry ? `${eventId}.wav` : undefined;

      if (audioBuffer && audioKey) {
        audioStore.set(audioKey, audioBuffer);
      }

      const newEvent: StoredEvent = {
        id: eventId,
        lat,
        lon,
        type,
        isTelemetry,
        audioKey,
        audioSize,
        batt,
        signal: 95,
        speed: parseFloat(req.body.speed || req.query.speed) || 1.1,
        accuracy: 3.2,
        createdAt: new Date().toISOString(),
        status: isTelemetry ? "normal" : (type === "sos" ? "critical" : "alert"),
        title: isTelemetry ? "Live GPS Telemetry Pin" : (type === "sos" ? "Emergency SOS Trigger" : "Wearable Audio Alert Capture")
      };

      // Remove previous telemetry pings if new telemetry arrives
      if (isTelemetry) {
        eventsStore = eventsStore.filter(e => !e.isTelemetry);
      }

      eventsStore.unshift(newEvent);

      // When an audio alert has valid GPS, also update the live telemetry pin
      // so the map always shows the last known location
      if (!isTelemetry && lat !== 0 && lon !== 0) {
        eventsStore = eventsStore.filter(e => !e.isTelemetry);
        const telemetryUpdate: StoredEvent = {
          id: "evt-telemetry-latest",
          lat,
          lon,
          type: "telemetry",
          isTelemetry: true,
          batt: 0,
          speed: 0.0,
          accuracy: 0,
          createdAt: new Date().toISOString(),
          status: "normal",
          title: "Last Known Location (from Audio Alert)"
        };
        eventsStore.unshift(telemetryUpdate);
      }

      if (eventsStore.length > 100) {
        eventsStore = eventsStore.slice(0, 100);
      }

      console.log(`[UPLOAD] ✅ Event recorded: ${eventId} (${type}), GPS: ${lat}, ${lon}`);

      // Send ntfy push alert for Audio/SOS events
      if (!isTelemetry) {
        const host = req.headers.host || "localhost:8888";
        const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
        const siteUrl = `${protocol}://${host}`;
        const dashboardUrl = `${siteUrl}/#event-${eventId}`;
        const durationSec = Math.max(1, Math.round(audioSize / (8000 * 2)));

        fetch("https://ntfy.sh/gps-audio-notifications", {
          method: "POST",
          headers: {
            "Title": "GuardianTrack Alert",
            "Priority": "high",
            "Tags": "rotating_light,microphone",
            "Click": dashboardUrl,
            "Actions": `view, Open Dashboard, ${dashboardUrl}`,
          },
          body: `🚨 Audio alert received!\n📍 Location: ${lat}, ${lon}\n⏱ Duration: ~${durationSec}s\n\nTap to listen and view location.`,
        }).then(() => console.log(`[NTFY] Alert sent for ${eventId}`))
          .catch((err) => console.error("[NTFY] Error sending alert:", err));
      }

      res.status(200).json({
        status: "success",
        eventId,
        event: newEvent
      });
    } catch (err: any) {
      console.error("[UPLOAD] Error:", err);
      res.status(500).json({ error: err.message || "Failed to process upload" });
    }
  });

  // 5. POST /api/events/seed (Reset with seed data if cleared)
  app.post("/api/events/seed", (req, res) => {
    eventsStore = [];
    res.json({ status: "ok", events: eventsStore });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`============================================================`);
    console.log(`🛡️ GuardianTrack Redesigned Server Running!`);
    console.log(`   URL: http://192.168.123.6:${PORT}/`);
    console.log(`   Local URL: http://localhost:${PORT}/`);
    console.log(`============================================================`);
  });
}

startServer();
