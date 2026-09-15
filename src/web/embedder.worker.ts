// Search by meaning: multilingual-e5-small (intfloat, MIT; the quantized ONNX export by Xenova), run with ONNX Runtime
// Web, the same build as the on-device voice. A text becomes a 384-number vector: the token vectors of the model's last
// layer averaged over the text, scaled to unit length, so similarity is a dot product. The files come from Hugging Face
// once and stay in the browser's Cache Storage.
import { Tokenizer } from "@huggingface/tokenizers";
import * as ort from "onnxruntime-web/webgpu";
import { config } from "../core/config";
import type { EmbedReply, EmbedRequest, EmbedKind } from "./embedder";
import { fetchCached } from "./modelFiles";

ort.env.logLevel = "error";

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<EmbedRequest>) => void) | null;
  postMessage(message: EmbedReply, transfer?: Transferable[]): void;
};
const { repo, revision, model: modelFile, backend, batch, downloadBytes } = config.semanticSearch;
const BASE = `https://huggingface.co/${repo}/resolve/${revision}`;
const CACHE = `e5-small-${revision.slice(0, 8)}`;
/** e5 was trained with these prefixes: a question is a query, the documents' text is a passage. */
const PREFIX: Record<EmbedKind, string> = { query: "query: ", passage: "passage: " };
/** The model's longest input; a passage of 600 characters is far below it. */
const MAX_TOKENS = 512;

interface Model {
  tokenizer: Tokenizer;
  session: ort.InferenceSession;
}

let loaded = 0;
let lastReport = 0;
function report(bytes: number): void {
  loaded += bytes;
  const now = performance.now();
  if (now - lastReport < 150) return;
  lastReport = now;
  scope.postMessage({ type: "progress", loaded, total: downloadBytes });
}

async function load(): Promise<Model> {
  const startedAt = performance.now();
  const [tokenizerJson, tokenizerConfig, weights] = await Promise.all(
    ["tokenizer.json", "tokenizer_config.json", modelFile].map((path) => fetchCached(`${BASE}/${path}`, CACHE, report, path)),
  );
  const json = (bytes: Uint8Array) => JSON.parse(new TextDecoder().decode(bytes)) as object;
  const tokenizer = new Tokenizer(json(tokenizerJson!), json(tokenizerConfig!));
  const create = (provider: "webgpu" | "wasm") => ort.InferenceSession.create(weights!, { executionProviders: [provider], graphOptimizationLevel: "all" });
  let session: ort.InferenceSession | null = null;
  let used = "WebAssembly";
  if (backend === "webgpu" && "gpu" in navigator) {
    try {
      session = await create("webgpu");
      used = "WebGPU";
    } catch {
      // no adapter, or an operator WebGPU cannot run: WebAssembly below
    }
  }
  session ??= await create("wasm");
  scope.postMessage({ type: "ready", backend: used, loadMs: Math.round(performance.now() - startedAt) });
  return { tokenizer, session };
}

/** One model run over a batch of token ids, padded to its longest: the mean of each text's token vectors, unit length. */
async function run(m: Model, encoded: number[][]): Promise<{ data: Float32Array; dims: number }> {
  const count = encoded.length;
  const length = Math.max(...encoded.map((e) => e.length));
  const ids = new BigInt64Array(count * length);
  const mask = new BigInt64Array(count * length);
  encoded.forEach((e, b) =>
    e.forEach((id, i) => {
      ids[b * length + i] = BigInt(id);
      mask[b * length + i] = 1n;
    }),
  );
  const shape = [count, length];
  const out = await m.session.run({
    input_ids: new ort.Tensor("int64", ids, shape),
    attention_mask: new ort.Tensor("int64", mask, shape),
    token_type_ids: new ort.Tensor("int64", new BigInt64Array(count * length), shape),
  });
  const hidden = out.last_hidden_state!;
  const dims = hidden.dims[2]!;
  const tokens = hidden.data as Float32Array;
  const data = new Float32Array(count * dims);
  encoded.forEach((e, b) => {
    const at = b * dims;
    for (let i = 0; i < e.length; i++) for (let d = 0; d < dims; d++) data[at + d]! += tokens[(b * length + i) * dims + d]!;
    let norm = 0;
    for (let d = 0; d < dims; d++) norm += data[at + d]! * data[at + d]!;
    norm = Math.sqrt(norm) || 1;
    for (let d = 0; d < dims; d++) data[at + d]! /= norm;
  });
  return { data, dims };
}

let model: Promise<Model> | null = null;
const loadModel = () => (model ??= load());
// Requests run one at a time: a session is not re-entrant.
let queue: Promise<void> = Promise.resolve();
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function embed(id: number, texts: string[], kind: EmbedKind): Promise<void> {
  try {
    const m = await loadModel();
    const startedAt = performance.now();
    const encoded = texts.map((t) => m.tokenizer.encode(PREFIX[kind] + t).ids.slice(0, MAX_TOKENS));
    // A batch is padded to its longest text, so batches are made of texts of similar length. On the magazine article
    // that halved the padded tokens (12,680 instead of 22,064) and indexing on one thread (16 s instead of 29 s).
    const order = encoded.map((_, i) => i).sort((a, b) => encoded[a]!.length - encoded[b]!.length);
    let data = new Float32Array(0);
    let dims = 0;
    for (let s = 0; s < order.length; s += batch) {
      const members = order.slice(s, s + batch);
      const part = await run(m, members.map((i) => encoded[i]!));
      if (!dims) {
        dims = part.dims;
        data = new Float32Array(texts.length * dims);
      }
      // each vector goes back to its text's place
      members.forEach((i, b) => data.set(part.data.subarray(b * dims, (b + 1) * dims), i * dims));
    }
    scope.postMessage({ type: "vectors", id, data, dims, ms: Math.round(performance.now() - startedAt) }, [data.buffer]);
  } catch (error) {
    scope.postMessage({ type: "embed-failed", id, message: errorText(error) });
  }
}

scope.onmessage = (event) => {
  const message = event.data;
  if (message.type === "load") loadModel().catch((error) => scope.postMessage({ type: "failed", message: errorText(error) }));
  else queue = queue.then(() => embed(message.id, message.texts, message.kind));
};
