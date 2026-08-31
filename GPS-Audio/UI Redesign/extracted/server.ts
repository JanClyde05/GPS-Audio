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

// In-memory events storage seeded with realistic sample events
let eventsStore: StoredEvent[] = [];

// Helper to generate a minimal clean PCM WAV beep tone for preview playback
function generateSampleWavBuffer(durationSeconds = 3, freq = 440): Buffer {
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

  // Generate pleasant gentle tone
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Harmonic audio tone with subtle envelope
    const envelope = Math.sin((Math.PI * i) / numSamples);
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.4 + Math.sin(2 * Math.PI * (freq * 1.5) * t) * 0.15;
    const intSample = Math.floor(sample * envelope * 32767);
    buffer.writeInt16LE(intSample, offset);
    offset += 2;
  }

  return buffer;
}

const sampleWavCache = generateSampleWavBuffer(4, 520);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const upload = multer({ storage: multer.memoryStorage() });

  // 1. GET /api/events (Return events list or stream audio if audio query is present)
  app.get("/api/events", (req, res) => {
    // If audio query is requested, return audio file
    if (req.query.audio) {
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Content-Length", sampleWavCache.length);
      res.setHeader("Accept-Ranges", "bytes");
      return res.send(sampleWavCache);
    }

    res.json({
      status: "ok",
      count: eventsStore.length,
      events: eventsStore
    });
  });

  // 2. DELETE /api/events (Clear logs)
  app.delete("/api/events", (req, res) => {
    if (req.query.clear === "true" || req.query.reset === "true") {
      eventsStore = [];
    }
    res.json({
      status: "ok",
      message: "Events cleared successfully",
      events: eventsStore
    });
  });

  // 3. POST /api/upload (Telemetry & Audio upload endpoint for ESP32 and UI testing)
  app.post("/api/upload", upload.single("audio"), (req, res) => {
    try {
      const lat = parseFloat(req.body.lat) || 0;
      const lon = parseFloat(req.body.lon) || 0;
      const type = (req.body.type === "telemetry" ? "telemetry" : (req.body.type === "sos" ? "sos" : "audio")) as 'telemetry' | 'audio' | 'sos';
      const isTelemetry = type === "telemetry";
      const batt = req.body.batt ? parseInt(req.body.batt) : 85;
      const audioSize = req.file ? req.file.size : (isTelemetry ? 0 : 48000);

      const newEvent: StoredEvent = {
        id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        lat,
        lon,
        type,
        isTelemetry,
        audioKey: !isTelemetry ? `alert_${Date.now()}.wav` : undefined,
        audioSize,
        batt,
        signal: 95,
        speed: parseFloat(req.body.speed) || 1.1,
        accuracy: 3.2,
        createdAt: new Date().toISOString(),
        status: isTelemetry ? "normal" : (type === "sos" ? "critical" : "alert"),
        title: isTelemetry ? "Live GPS Telemetry Pin" : (type === "sos" ? "Emergency SOS Trigger" : "Wearable Audio Alert Capture")
      };

      // Put latest event at the top
      eventsStore.unshift(newEvent);

      // When an audio alert has valid GPS, update the live telemetry pin to match
      if (!isTelemetry && lat !== 0 && lon !== 0) {
        eventsStore = eventsStore.filter(e => !e.isTelemetry);
        const telemetryUpdate: StoredEvent = {
          id: "evt-telemetry-latest",
          lat,
          lon,
          type: "telemetry",
          isTelemetry: true,
          batt,
          speed: 0.0,
          accuracy: 0.0,
          createdAt: new Date().toISOString(),
          status: "normal",
          title: "Last Known Location (from Audio Alert)"
        };
        eventsStore.unshift(telemetryUpdate);
      }

      // Keep maximum 100 events
      if (eventsStore.length > 100) {
        eventsStore = eventsStore.slice(0, 100);
      }

      res.status(200).json({
        status: "success",
        event: newEvent
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to process upload" });
    }
  });

  // 4. POST /api/events/seed (Reset with seed data if cleared)
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GuardianTrack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
