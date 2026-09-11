// The page's side of the on-device voice: starts the worker, publishes download progress, and hands it text.
import { config, type Language } from "../core/config";

export type DeviceRequest =
  | { type: "load"; backend?: "webgpu" | "wasm" }
  | { type: "speak"; id: number; text: string; language: Language }
  | { type: "cancel"; through: number };

export type DeviceReply =
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready"; backend: string; loadMs: number }
  | { type: "failed"; message: string }
  | { type: "chunk"; id: number; samples: Float32Array; sampleRate: number; ms: number; pause: number; last: boolean }
  | { type: "speak-failed"; id: number; message: string };

export type DeviceVoiceState =
  | { status: "idle" }
  | { status: "loading"; loaded: number; total: number }
  | { status: "ready"; backend: string; loadMs: number }
  | { status: "failed"; message: string };

/** A piece of audio: its samples, how long it took to make, and the pause to leave before it. */
type OnChunk = (samples: Float32Array, sampleRate: number, ms: number, pause: number) => void;

interface Pending {
  onChunk: OnChunk;
  resolve: () => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
let state: DeviceVoiceState = { status: "idle" };
const listeners = new Set<(state: DeviceVoiceState) => void>();
const pending = new Map<number, Pending>();
let nextId = 0;

function publish(next: DeviceVoiceState): void {
  state = next;
  for (const listener of listeners) listener(next);
}

function fail(message: string): void {
  worker?.terminate();
  worker = null;
  for (const request of pending.values()) request.reject(new Error(message));
  pending.clear();
  publish({ status: "failed", message });
}

export const deviceVoiceState = (): DeviceVoiceState => state;

export function onDeviceVoice(listener: (state: DeviceVoiceState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Downloads (or reads from the cache) and loads the model. Safe to call again; a failed load can be retried. */
export function loadDeviceVoice(): void {
  if (worker) return;
  worker = new Worker(new URL("./supertonic.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<DeviceReply>) => {
    const message = event.data;
    if (message.type === "progress") publish({ status: "loading", loaded: message.loaded, total: message.total });
    else if (message.type === "ready") publish({ status: "ready", backend: message.backend, loadMs: message.loadMs });
    else if (message.type === "failed") fail(message.message);
    else {
      const request = pending.get(message.id);
      if (!request) return;
      if (message.type === "speak-failed") {
        pending.delete(message.id);
        request.reject(new Error(message.message));
        return;
      }
      request.onChunk(message.samples, message.sampleRate, message.ms, message.pause);
      if (message.last) {
        pending.delete(message.id);
        request.resolve();
      }
    }
  };
  worker.onerror = (event) => fail(event.message || "the voice worker stopped");
  publish({ status: "loading", loaded: 0, total: config.deviceVoice.downloadBytes });
  worker.postMessage({ type: "load" } satisfies DeviceRequest);
}

/** Speaks nothing itself: synthesizes on this device and passes on each piece of audio as soon as it is ready. */
export function synthesizeOnDevice(
  text: string,
  language: Language,
  onChunk: OnChunk,
): Promise<void> {
  const current = worker;
  if (!current || state.status !== "ready") return Promise.reject(new Error("the on-device voice is not loaded"));
  const id = ++nextId;
  // A newer answer replaces an older one that is still being synthesized.
  current.postMessage({ type: "cancel", through: id - 1 } satisfies DeviceRequest);
  for (const [old, request] of pending) {
    pending.delete(old);
    request.resolve();
  }
  return new Promise((resolve, reject) => {
    pending.set(id, { onChunk, resolve, reject });
    current.postMessage({ type: "speak", id, text, language } satisfies DeviceRequest);
  });
}
