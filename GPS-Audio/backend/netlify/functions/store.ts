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

export async function clearAllStores() {
  memoryEvents.clear();
  memoryAudio.clear();
  memoryIndex = [];

  try {
    const eventStore = getStore("events");
    await eventStore.setJSON("_index", []);
  } catch {}
}
