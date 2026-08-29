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
let eventsStore: StoredEvent[] = [
  {
    id: "evt-live-101",
    lat: 14.599512,
    lon: 120.984222,
    type: "telemetry",
    isTelemetry: true,
    batt: 88,
    signal: 94,
    speed: 1.2,
    accuracy: 3.5,
    createdAt: new Date(Date.now() - 45 * 1000).toISOString(),
    status: "normal",
    title: "Wearable Active Telemetry"
  },
  {
    id: "evt-audio-201",
    lat: 14.598200,
    lon: 120.982100,
    type: "audio",
    isTelemetry: false,
    audioKey: "alert_sample_01.wav",
    audioSize: 64000,
    batt: 89,
    signal: 90,
    speed: 0.8,
    accuracy: 4.2,
    createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    status: "alert",
    title: "Noise Threshold Alert (84 dB)"
  },
  {
    id: "evt-audio-202",
    lat: 14.596400,
    lon: 120.979800,
    type: "audio",
    isTelemetry: false,
    audioKey: "alert_sample_02.wav",
    audioSize: 96000,
    batt: 92,
    signal: 85,
    speed: 0.4,
    accuracy: 3.1,
    createdAt: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
    status: "alert",
    title: "Vocal Distress Trigger"
  },
  {
    id: "evt-telemetry-102",
    lat: 14.594800,
    lon: 120.978200,
    type: "telemetry",
    isTelemetry: true,
    batt: 95,
    signal: 92,
    speed: 3.6,
    accuracy: 2.8,
    createdAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    status: "normal",
    title: "Routine Geofence Uplink"
  }
];

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
      const lat = parseFloat(req.body.lat) || 14.599512;
      const lon = parseFloat(req.body.lon) || 120.984222;
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
    eventsStore = [
      {
        id: "evt-live-101",
        lat: 14.599512,
        lon: 120.984222,
        type: "telemetry",
        isTelemetry: true,
        batt: 88,
        signal: 94,
        speed: 1.2,
        accuracy: 3.5,
        createdAt: new Date(Date.now() - 20 * 1000).toISOString(),
        status: "normal",
        title: "Wearable Active Telemetry"
      },
      {
        id: "evt-audio-201",
        lat: 14.598200,
        lon: 120.982100,
        type: "audio",
        isTelemetry: false,
        audioKey: "alert_sample_01.wav",
        audioSize: 64000,
        batt: 89,
        signal: 90,
        speed: 0.8,
        accuracy: 4.2,
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        status: "alert",
        title: "Audio Spike Trigger (84 dB)"
      },
      {
        id: "evt-audio-202",
        lat: 14.596400,
        lon: 120.979800,
        type: "audio",
        isTelemetry: false,
        audioKey: "alert_sample_02.wav",
        audioSize: 96000,
        batt: 92,
        signal: 85,
        speed: 0.4,
        accuracy: 3.1,
        createdAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
        status: "alert",
        title: "Vocal Distress Trigger"
      }
    ];
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
