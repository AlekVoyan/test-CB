// Speech output in three voices, chosen in the voice tile:
// - "elevenlabs": a hosted neural voice behind /api/tts, used when the server issued a ticket for exactly this text;
// - "device": Supertonic 3 synthesized in this browser (deviceVoice.ts);
// - "browser": the system's own voice, which is also the fallback when either of the others cannot speak.
// The two neural voices play through Web Audio and report the moment their first sound is due at the output.
import { config, LANGUAGES, type Language } from "../core/config";
import { deviceVoiceState, synthesizeOnDevice } from "./deviceVoice";
import { pcm16ToFloat32 } from "./pcm";

export type VoiceMode = "browser" | "elevenlabs" | "device";

/** Issued by /api/answer: the server's permission to have exactly this text spoken by the hosted voice. */
export interface SpeechTicket {
  text: string;
  token: string;
}

/** Which voice spoke, and how long it took to start. */
export interface SpeakInfo {
  provider: string;
  voice: string | null;
  /** Neural voice model id. */
  model?: string;
  /** WebGPU or WebAssembly, for the on-device voice. */
  backend?: string;
  /** Until the first audio data: the first byte from ElevenLabs, or the first sentence synthesized on the device. */
  firstByteMs?: number;
  /** Of that, the voice service's time to respond, as the server measured it. */
  upstreamMs?: number;
  /** On-device voice: synthesis of the first piece itself (the rest of the wait was queueing or messaging). */
  synthMs?: number;
  /** From the start event until the first sound reaches the audio output. */
  audibleInMs?: number;
  /** Why the chosen voice did not speak. */
  fallback?: string;
}

export interface SpeakEvents {
  /** First audio: the first piece is due at the output (neural voices) or the utterance started (system voice). */
  onStart?: (info: SpeakInfo) => void;
  onEnd?: () => void;
  /** Nothing could speak; the answer stays on screen. */
  onSilent?: (reason: string) => void;
}

// ---------- the system's own voice (also the fallback) ----------

const BROWSER = "Browser speech";
const DEVICE = "On device";
const hasSynthesis = () => typeof window !== "undefined" && "speechSynthesis" in window;
const normalizeLang = (lang: string) => lang.replace("_", "-").toLowerCase();

function voicesFor(language: Language): SpeechSynthesisVoice[] {
  const prefix = LANGUAGES[language].locale.slice(0, 2).toLowerCase();
  return window.speechSynthesis.getVoices().filter((v) => normalizeLang(v.lang).startsWith(prefix));
}

function pickVoice(language: Language): SpeechSynthesisVoice | null {
  const locale = LANGUAGES[language].locale.toLowerCase();
  const candidates = voicesFor(language);
  // Local voices start faster than network voices; prefer the exact locale.
  return (
    candidates.find((v) => v.localService && normalizeLang(v.lang) === locale) ??
    candidates.find((v) => v.localService) ??
    candidates[0] ??
    null
  );
}

// Chrome loads the voice list asynchronously; ask early so the first answer finds it.
if (hasSynthesis()) window.speechSynthesis.getVoices();

function speakInBrowser(text: string, language: Language, events: SpeakEvents, fallback?: string): void {
  // An empty list means "not loaded yet", not "no voices": let the browser try.
  const loaded = hasSynthesis() ? window.speechSynthesis.getVoices().length > 0 : false;
  if (!hasSynthesis() || (loaded && voicesFor(language).length === 0)) {
    const none = `No ${LANGUAGES[language].name} voice in this browser`;
    events.onSilent?.(fallback ? `${none}; chosen voice: ${fallback}` : none);
    events.onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANGUAGES[language].locale;
  const voice = pickVoice(language);
  if (voice) utterance.voice = voice;
  utterance.onstart = () => events.onStart?.({ provider: BROWSER, voice: voice?.name ?? null, fallback });
  utterance.onend = () => events.onEnd?.();
  utterance.onerror = () => events.onEnd?.();
  window.speechSynthesis.speak(utterance);
}

// ---------- Web Audio playback, shared by the neural voices ----------

let audio: AudioContext | null = null;

/**
 * Call from a click or tap. Browsers let a page play sound only after a user gesture, and the answer arrives seconds
 * after the tap that asked for it.
 */
export function primeAudio(): void {
  if (typeof window === "undefined" || !("AudioContext" in window)) return;
  audio ??= new AudioContext();
  if (audio.state === "suspended") void audio.resume().catch(() => {});
}

async function unlockedAudio(): Promise<AudioContext | string> {
  const ctx = audio;
  if (!ctx) return "audio was not unlocked by a tap";
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});
  return ctx.state === "running" ? ctx : "the browser blocked audio";
}

interface Playback {
  ctx: AudioContext;
  next: number;
  last: AudioBufferSourceNode | null;
  sources: Set<AudioBufferSourceNode>;
}

/** Queues samples right after what is already queued, after an optional pause; returns their start time. */
function schedule(p: Playback, samples: Float32Array, rate: number, pause = 0): number {
  const buffer = p.ctx.createBuffer(1, samples.length, rate);
  buffer.getChannelData(0).set(samples);
  const source = p.ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(p.ctx.destination);
  // Pieces are scheduled back to back on the audio clock, so they join without gaps.
  const at = Math.max(p.ctx.currentTime + 0.03, p.next + (p.last ? pause : 0));
  source.start(at);
  p.next = at + buffer.duration;
  p.last = source;
  p.sources.add(source);
  source.onended = () => p.sources.delete(source);
  return at;
}

/** Milliseconds until a sound scheduled at `at` reaches the audio output. */
const audibleIn = (ctx: AudioContext, at: number) => (at - ctx.currentTime + (ctx.outputLatency || ctx.baseLatency || 0)) * 1000;

function whenPlayed(p: Playback, done: () => void): void {
  const final = p.last;
  // A slow source can finish after its last piece has already played.
  if (!final || p.next <= p.ctx.currentTime) done();
  else
    final.onended = () => {
      p.sources.delete(final);
      done();
    };
}

/** Each call to speakAnswer is a session; a newer one, or stopSpeaking, silences the older. */
let session = 0;
let playing: { controller?: AbortController; sources: Set<AudioBufferSourceNode> } | null = null;

function stopPlayback(): void {
  if (!playing) return;
  playing.controller?.abort();
  for (const source of playing.sources) {
    source.onended = null;
    try {
      source.stop();
    } catch {
      // not started yet
    }
  }
  playing = null;
}

const header = (response: Response, name: string) => {
  const value = response.headers.get(name);
  return value === null ? undefined : decodeURIComponent(value);
};

// ---------- ElevenLabs, streamed through /api/tts ----------

/** Resolves with a reason when the system voice should speak instead. */
async function speakHosted(ticket: SpeechTicket, language: Language, events: SpeakEvents, id: number): Promise<string | null> {
  const ctx = await unlockedAudio();
  if (typeof ctx === "string") return ctx;
  if (id !== session) return null;

  const controller = new AbortController();
  const p: Playback = { ctx, next: 0, last: null, sources: new Set() };
  playing = { controller, sources: p.sources };
  const startedAt = performance.now();
  const late = `ElevenLabs sent no audio within ${config.tts.firstByteTimeoutMs / 1000} s`;
  const timer = setTimeout(() => controller.abort(), config.tts.firstByteTimeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ticket.text, token: ticket.token, language }),
        signal: controller.signal,
      });
    } catch {
      return id !== session ? null : controller.signal.aborted ? late : "ElevenLabs could not be reached";
    }
    if (!response.ok || !response.body) return `ElevenLabs error ${response.status}`;
    const rate = Number(response.headers.get("X-Sample-Rate")) || config.tts.sampleRate;
    const info: SpeakInfo = {
      provider: header(response, "X-Voice-Provider") ?? "Hosted voice",
      voice: header(response, "X-Voice-Name") ?? null,
      model: header(response, "X-Voice-Model"),
      upstreamMs: Number(response.headers.get("X-Upstream-Ms")) || undefined,
    };

    const reader = response.body.getReader();
    let carry: number | null = null;
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        // Stopped by a newer session, cut by the timer before any sound, or broken mid-answer.
        return id !== session || p.last ? null : late;
      }
      if (id !== session) {
        void reader.cancel().catch(() => {});
        return null;
      }
      if (chunk.done) break;
      const decoded = pcm16ToFloat32(chunk.value, carry);
      carry = decoded.carry;
      if (!decoded.samples.length) continue;
      const first = !p.last;
      const at = schedule(p, decoded.samples, rate);
      if (first) {
        clearTimeout(timer);
        events.onStart?.({ ...info, firstByteMs: Math.round(performance.now() - startedAt), audibleInMs: audibleIn(ctx, at) });
      }
    }
    if (!p.last) return "ElevenLabs sent no audio";
    whenPlayed(p, () => {
      if (id !== session) return;
      playing = null;
      events.onEnd?.();
    });
    return null;
  } catch {
    return p.last ? null : "ElevenLabs failed";
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Supertonic 3 on this device ----------

async function speakOnDevice(text: string, language: Language, events: SpeakEvents, id: number): Promise<string | null> {
  const model = deviceVoiceState();
  if (model.status === "loading") return `the on-device voice is still loading (${Math.floor((100 * model.loaded) / model.total)}%)`;
  if (model.status === "failed") return `the on-device voice did not load: ${model.message}`;
  if (model.status !== "ready") return "the on-device voice is not loaded";
  const ctx = await unlockedAudio();
  if (typeof ctx === "string") return ctx;
  if (id !== session) return null;

  const p: Playback = { ctx, next: 0, last: null, sources: new Set() };
  playing = { sources: p.sources };
  const startedAt = performance.now();
  try {
    await synthesizeOnDevice(text, language, (samples, rate, ms, pause) => {
      if (id !== session || !samples.length) return;
      const first = !p.last;
      const at = schedule(p, samples, rate, pause);
      if (first)
        events.onStart?.({
          provider: DEVICE,
          voice: `Supertonic 3 · ${config.deviceVoice.voice}`,
          model: "supertonic-3",
          backend: model.backend,
          firstByteMs: Math.round(performance.now() - startedAt),
          synthMs: ms,
          audibleInMs: audibleIn(ctx, at),
        });
    });
  } catch (error) {
    return id !== session || p.last ? null : `the on-device voice failed: ${error instanceof Error ? error.message : String(error)}`;
  }
  if (id !== session) return null;
  if (!p.last) return "the on-device voice made no audio";
  whenPlayed(p, () => {
    if (id !== session) return;
    playing = null;
    events.onEnd?.();
  });
  return null;
}

// ---------- entry points ----------

/**
 * Speaks an answer in the chosen voice; when that voice cannot (not set up, still loading, failed before its first
 * sound), the system voice speaks and the reason is reported. Never throws; without any voice the answer stays text.
 */
export function speakAnswer(text: string, language: Language, events: SpeakEvents, options: { mode: VoiceMode; ticket?: SpeechTicket }): void {
  stopSpeaking();
  const id = session;
  const orBrowser = (reason: string | null) => {
    if (reason !== null && id === session) speakInBrowser(text, language, events, reason);
  };
  if (options.mode === "device") void speakOnDevice(text, language, events, id).then(orBrowser);
  else if (options.mode === "elevenlabs" && options.ticket?.text === text) void speakHosted(options.ticket, language, events, id).then(orBrowser);
  else speakInBrowser(text, language, events, options.mode === "elevenlabs" ? "no voice ticket for this text" : undefined);
}

export function stopSpeaking(): void {
  session++;
  stopPlayback();
  if (hasSynthesis()) window.speechSynthesis.cancel();
}
