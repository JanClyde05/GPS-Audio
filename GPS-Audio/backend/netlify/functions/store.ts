import { getStore } from "@netlify/blobs";

// In-memory fallback stores for offline local development
const memoryEvents = new Map<string, any>();
const memoryAudio = new Map<string, Uint8Array>();
let memoryIndex: string[] = [];

export async function saveEvent(eventId: string, eventData: any) {
  try {
    const store = getStore("events");
    await store.setJSON(eventId, eventData);
  } catch (err) {
    console.warn(`[STORE] Netlify Blobs unavailable locally — using in-memory store for event ${eventId}`);
    memoryEvents.set(eventId, eventData);
  }
}

export async function getEvent(eventId: string): Promise<any> {
  try {
    const store = getStore("events");
    const data = await store.get(eventId, { type: "json" });
    if (data) return data;
  } catch {}

  return memoryEvents.get(eventId) || null;
}

export async function saveAudio(audioKey: string, audioData: Uint8Array, metadata: any) {
  try {
    const store = getStore("audio-clips");
    await store.set(audioKey, audioData, { metadata });
  } catch (err) {
    console.warn(`[STORE] Netlify Blobs unavailable locally — using in-memory store for audio ${audioKey}`);
    memoryAudio.set(audioKey, audioData);
  }
}

export async function getAudio(audioKey: string): Promise<Uint8Array | null> {
  try {
    const store = getStore("audio-clips");
    const data = await store.get(audioKey, { type: "arrayBuffer" });
    if (data) return new Uint8Array(data);
  } catch {}

  return memoryAudio.get(audioKey) || null;
}

export async function getEventIndex(): Promise<string[]> {
  try {
    const store = getStore("events");
    const existing = await store.get("_index", { type: "json" }) as string[] | null;
    if (existing && Array.isArray(existing)) return existing;
  } catch {}

  return memoryIndex;
}

export async function updateEventIndex(eventId: string) {
  let index = await getEventIndex();
  if (!index.includes(eventId)) {
    index = [eventId, ...index].slice(0, 100);
  }
  memoryIndex = index;

  try {
    const store = getStore("events");
    await store.setJSON("_index", index);
  } catch {}
}

export const DEFAULT_SEED_EVENTS = [
  {
    id: "evt-live-101",
    lat: 17.649834,
    lon: 121.744034,
    type: "telemetry",
    isTelemetry: true,
    batt: 0,
    signal: 94,
    speed: 0.0,
    accuracy: 3.5,
    createdAt: new Date().toISOString(),
    status: "normal",
    title: "Wearable Initialized (USB Power)"
  },
  {
    id: "evt-audio-201",
    lat: 17.649584,
    lon: 121.744019,
    type: "audio",
    isTelemetry: false,
    audioKey: "alert_sample_01.wav",
    audioSize: 64044,
    batt: 89,
    signal: 90,
    speed: 0.8,
    accuracy: 4.2,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    status: "alert",
    title: "Audio Spike Trigger (84 dB)"
  }
];

export function generateSampleWavBuffer(durationSeconds = 4, freq = 440): Uint8Array {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate * durationSeconds;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const u8 = new Uint8Array(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      u8[offset + i] = str.charCodeAt(i);
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");

  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.sin((Math.PI * i) / numSamples);
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.4;
    const intSample = Math.floor(sample * envelope * 32767);
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return u8;
}

export async function seedEvents() {
  for (const evt of DEFAULT_SEED_EVENTS) {
    await saveEvent(evt.id, evt);
    await updateEventIndex(evt.id);
  }
}

export async function clearAllStores() {
  memoryEvents.clear();
  memoryAudio.clear();
  memoryIndex = [];

  try {
    const eventStore = getStore("events");
    await eventStore.setJSON("_index", []);
  } catch {}
}
