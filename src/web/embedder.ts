// The page's side of search by meaning: starts the worker, publishes its download progress, and turns texts into
// vectors. Nothing is sent anywhere: the model runs in this browser.
import { config } from "../core/config";

export type EmbedKind = "query" | "passage";

export type EmbedRequest = { type: "load" } | { type: "embed"; id: number; texts: string[]; kind: EmbedKind };

export type EmbedReply =
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready"; backend: string; loadMs: number }
  | { type: "failed"; message: string }
  /** One vector per text, `dims` numbers each, laid end to end; `ms` is the model runs alone, without the download. */
  | { type: "vectors"; id: number; data: Float32Array; dims: number; ms: number }
  | { type: "embed-failed"; id: number; message: string };

export type EmbedderState =
  | { status: "idle" }
  | { status: "loading"; loaded: number; total: number }
  | { status: "ready"; backend: string; loadMs: number }
  | { status: "failed"; message: string };

interface Pending {
  resolve: (result: { vectors: Float32Array[]; ms: number }) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
let state: EmbedderState = { status: "idle" };
const listeners = new Set<(state: EmbedderState) => void>();
const pending = new Map<number, Pending>();
let nextId = 0;

function publish(next: EmbedderState): void {
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

export const embedderState = (): EmbedderState => state;

export function onEmbedder(listener: (state: EmbedderState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Downloads (or reads from the cache) and loads the model. Safe to call again; a failed load can be retried. */
export function loadEmbedder(): void {
  if (worker) return;
  worker = new Worker(new URL("./embedder.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<EmbedReply>) => {
    const message = event.data;
    if (message.type === "progress") publish({ status: "loading", loaded: message.loaded, total: message.total });
    else if (message.type === "ready") publish({ status: "ready", backend: message.backend, loadMs: message.loadMs });
    else if (message.type === "failed") fail(message.message);
    else {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.type === "embed-failed") request.reject(new Error(message.message));
      else {
        const count = message.dims ? message.data.length / message.dims : 0;
        const vectors = Array.from({ length: count }, (_, i) => message.data.subarray(i * message.dims, (i + 1) * message.dims));
        request.resolve({ vectors, ms: message.ms });
      }
    }
  };
  worker.onerror = (event) => fail(event.message || "the search worker stopped");
  publish({ status: "loading", loaded: 0, total: config.semanticSearch.downloadBytes });
  worker.postMessage({ type: "load" } satisfies EmbedRequest);
}

/** Vectors for the texts, once the model is loaded (it starts loading if it has not). */
export function embedTexts(texts: string[], kind: EmbedKind): Promise<{ vectors: Float32Array[]; ms: number }> {
  loadEmbedder();
  const current = worker;
  if (!current) return Promise.reject(new Error("the search worker is not running"));
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    current.postMessage({ type: "embed", id, texts, kind } satisfies EmbedRequest);
  });
}
