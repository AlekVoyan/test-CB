// The on-device voice: Supertonic 3 by Supertone (weights under OpenRAIL-M), run with ONNX Runtime Web: WebGPU when
// the browser has it, WebAssembly otherwise. The inference loop follows Supertonic's web example (MIT, © 2025 Supertone
// Inc.), with flat typed arrays instead of nested lists. The model files come from Hugging Face once and stay in the
// browser's Cache Storage.
// The WebGPU build finds its own WebAssembly file (the asyncify build) next to itself; Vite ships it as an asset.
import * as ort from "onnxruntime-web/webgpu";
import { config } from "../core/config";
import type { DeviceReply, DeviceRequest } from "./deviceVoice";
import { chunkText, prepareText, textIds } from "./supertonicText";

// Its "some nodes were not assigned to the preferred execution provider" notices are expected (shape ops stay on the CPU).
ort.env.logLevel = "error";

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<DeviceRequest>) => void) | null;
  postMessage(message: DeviceReply, transfer?: Transferable[]): void;
};
const { repo, revision, voice, steps, speed, chunkChars, textBucket, frameBucket, downloadBytes } = config.deviceVoice;
const BASE = `https://huggingface.co/${repo}/resolve/${revision}`;
const CACHE = `supertonic-3-${revision.slice(0, 8)}`;

interface ModelConfig {
  ae: { sample_rate: number; base_chunk_size: number };
  ttl: { latent_dim: number; chunk_compress_factor: number };
}
interface StyleJson {
  dims: number[];
  data: unknown[];
}
interface Model {
  cfg: ModelConfig;
  indexer: (number | null)[];
  styleTtl: ort.Tensor;
  styleDp: ort.Tensor;
  dp: ort.InferenceSession;
  encoder: ort.InferenceSession;
  estimator: ort.InferenceSession;
  vocoder: ort.InferenceSession;
}

// ---------- download, with progress and a cache for the next visit ----------

let loaded = 0;
let lastReport = 0;
function report(bytes: number): void {
  loaded += bytes;
  const now = performance.now();
  if (now - lastReport < 150) return;
  lastReport = now;
  scope.postMessage({ type: "progress", loaded, total: downloadBytes });
}

async function download(path: string): Promise<Uint8Array> {
  const url = `${BASE}/${path}`;
  const cache = await caches.open(CACHE).catch(() => null);
  const hit = await cache?.match(url);
  if (hit) {
    const bytes = new Uint8Array(await hit.arrayBuffer());
    report(bytes.length);
    return bytes;
  }
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`${path}: HTTP ${response.status}`);
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    size += value.length;
    report(value.length);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  // Kept for the next visit. A full disk only means the next visit downloads again.
  await cache?.put(url, new Response(bytes)).catch(() => {});
  return bytes;
}

const json = <T>(bytes: Uint8Array): T => JSON.parse(new TextDecoder().decode(bytes)) as T;
const styleTensor = (s: StyleJson) => new ort.Tensor("float32", Float32Array.from(s.data.flat(Infinity) as number[]), s.dims);

async function createSessions(files: Uint8Array[], prefer?: "webgpu" | "wasm"): Promise<{ sessions: ort.InferenceSession[]; backend: string }> {
  const attempt = async (provider: "webgpu" | "wasm") => {
    const sessions: ort.InferenceSession[] = [];
    for (const bytes of files) sessions.push(await ort.InferenceSession.create(bytes, { executionProviders: [provider], graphOptimizationLevel: "all", logSeverityLevel: 3 }));
    return sessions;
  };
  if (prefer !== "wasm" && "gpu" in navigator) {
    try {
      return { sessions: await attempt("webgpu"), backend: "WebGPU" };
    } catch {
      // no adapter, or an operator WebGPU cannot run: WebAssembly below
    }
  }
  return { sessions: await attempt("wasm"), backend: "WebAssembly" };
}

async function load(prefer?: "webgpu" | "wasm"): Promise<Model> {
  const startedAt = performance.now();
  const [cfgBytes, indexerBytes, styleBytes] = await Promise.all(["onnx/tts.json", "onnx/unicode_indexer.json", `voice_styles/${voice}.json`].map(download));
  const onnx: Uint8Array[] = [];
  for (const name of ["duration_predictor", "text_encoder", "vector_estimator", "vocoder"]) onnx.push(await download(`onnx/${name}.onnx`));
  const { sessions, backend } = await createSessions(onnx, prefer);
  const style = json<{ style_ttl: StyleJson; style_dp: StyleJson }>(styleBytes!);
  const [dp, encoder, estimator, vocoder] = sessions;
  const model: Model = {
    cfg: json<ModelConfig>(cfgBytes!),
    indexer: json<(number | null)[]>(indexerBytes!),
    styleTtl: styleTensor(style.style_ttl),
    styleDp: styleTensor(style.style_dp),
    dp: dp!,
    encoder: encoder!,
    estimator: estimator!,
    vocoder: vocoder!,
  };
  // One short sentence builds the kernels and buffers, so the first real answer is not the slow one.
  await synthesize(model, "Ready.", "en");
  scope.postMessage({ type: "ready", backend, loadMs: Math.round(performance.now() - startedAt) });
  return model;
}

// ---------- synthesis ----------

function gaussianNoise(size: number): Float32Array {
  const out = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const u = Math.max(0.0001, Math.random());
    out[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
  }
  return out;
}

const roundUp = (n: number, step: number) => Math.ceil(n / step) * step;

/** One piece of text → samples: duration → text encoding → denoising steps from noise → vocoder. */
async function synthesize(m: Model, text: string, lang: string): Promise<Float32Array> {
  // Padded to a few fixed lengths and masked out, as the model's own batch code does.
  const real = textIds(prepareText(text, lang), m.indexer);
  const length = roundUp(real.length, textBucket);
  const ids = new BigInt64Array(length);
  ids.set(real);
  const idsTensor = new ort.Tensor("int64", ids, [1, length]);
  const textMask = new ort.Tensor("float32", new Float32Array(length).fill(1, 0, real.length), [1, 1, length]);

  const { duration } = await m.dp.run({ text_ids: idsTensor, style_dp: m.styleDp, text_mask: textMask });
  const seconds = (duration!.data as Float32Array)[0]! / speed;
  const { text_emb } = await m.encoder.run({ text_ids: idsTensor, style_ttl: m.styleTtl, text_mask: textMask });

  const rate = m.cfg.ae.sample_rate;
  const frameSamples = m.cfg.ae.base_chunk_size * m.cfg.ttl.chunk_compress_factor;
  const dim = m.cfg.ttl.latent_dim * m.cfg.ttl.chunk_compress_factor;
  const samples = Math.floor(seconds * rate);
  const realFrames = Math.floor((samples + frameSamples - 1) / frameSamples);
  const frames = roundUp(realFrames, frameBucket);
  const latentMask = new ort.Tensor("float32", new Float32Array(frames).fill(1, 0, realFrames), [1, 1, frames]);
  const totalStep = new ort.Tensor("float32", new Float32Array([steps]), [1]);
  let latent = gaussianNoise(dim * frames);
  // The noise is masked too: layout [1, dim, frames].
  for (let d = 0; d < dim; d++) latent.fill(0, d * frames + realFrames, (d + 1) * frames);
  for (let step = 0; step < steps; step++) {
    const { denoised_latent } = await m.estimator.run({
      noisy_latent: new ort.Tensor("float32", latent, [1, dim, frames]),
      text_emb: text_emb!,
      style_ttl: m.styleTtl,
      latent_mask: latentMask,
      text_mask: textMask,
      current_step: new ort.Tensor("float32", new Float32Array([step]), [1]),
      total_step: totalStep,
    });
    latent = denoised_latent!.data as Float32Array;
  }
  const { wav_tts } = await m.vocoder.run({ latent: new ort.Tensor("float32", latent, [1, dim, frames]) });
  return (wav_tts!.data as Float32Array).slice(0, samples);
}

// ---------- messages ----------

let model: Promise<Model> | null = null;
const loadModel = (prefer?: "webgpu" | "wasm") => {
  model ??= load(prefer);
  return model;
};
let cancelledThrough = 0;
// Requests run one at a time: the sessions are not re-entrant.
let queue: Promise<void> = Promise.resolve();
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function speak(id: number, text: string, language: string): Promise<void> {
  try {
    const m = await loadModel();
    const pieces = chunkText(text, chunkChars);
    if (!pieces.length) {
      scope.postMessage({ type: "chunk", id, samples: new Float32Array(0), sampleRate: m.cfg.ae.sample_rate, ms: 0, last: true });
      return;
    }
    for (const [i, piece] of pieces.entries()) {
      if (id <= cancelledThrough) return;
      const startedAt = performance.now();
      const samples = await synthesize(m, piece, language);
      const ms = Math.round(performance.now() - startedAt);
      scope.postMessage({ type: "chunk", id, samples, sampleRate: m.cfg.ae.sample_rate, ms, last: i === pieces.length - 1 }, [samples.buffer]);
    }
  } catch (error) {
    scope.postMessage({ type: "speak-failed", id, message: errorText(error) });
  }
}

scope.onmessage = (event) => {
  const message = event.data;
  if (message.type === "load") loadModel(message.backend).catch((error) => scope.postMessage({ type: "failed", message: errorText(error) }));
  else if (message.type === "cancel") cancelledThrough = Math.max(cancelledThrough, message.through);
  else queue = queue.then(() => speak(message.id, message.text, message.language));
};
