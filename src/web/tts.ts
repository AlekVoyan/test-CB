// Speech output. A hosted neural voice (ElevenLabs behind /api/tts) speaks when the server issued a ticket for the
// text; otherwise, or when it fails before its first sound, the browser's own voice does. Which service stands behind
// /api/tts is a server setting: the page knows only the endpoint and 16-bit PCM.
import { config, LANGUAGES, type Language } from "../core/config";
import { pcm16ToFloat32 } from "./pcm";

/** Issued by /api/answer: the server's permission to have exactly this text spoken by the hosted voice. */
export interface SpeechTicket {
  text: string;
  token: string;
}

/** Which voice spoke, and how long it took to start. */
export interface SpeakInfo {
  provider: string;
  voice: string | null;
  /** Hosted voice model id. */
  model?: string;
  /** Hosted voice: request → first audio byte in the page. */
  firstByteMs?: number;
  /** Of that, the voice service's time to respond, as the server measured it. */
  upstreamMs?: number;
  /** From the start event until the first sound reaches the audio output. */
  audibleInMs?: number;
  /** Why the hosted voice did not speak. */
  fallback?: string;
}

export interface SpeakEvents {
  /** First audio: the first chunk is due at the output (hosted voice) or the utterance started (browser). */
  onStart?: (info: SpeakInfo) => void;
  onEnd?: () => void;
  /** Nothing could speak; the answer stays on screen. */
  onSilent?: (reason: string) => void;
}

// ---------- the browser's own voice (fallback) ----------

const BROWSER = "Browser speech";
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
    events.onSilent?.(fallback ? `${none}; hosted voice: ${fallback}` : none);
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

// ---------- the hosted voice ----------

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

/** Each call to speakAnswer is a session; a newer one, or stopSpeaking, silences the older. */
let session = 0;
let playing: { controller: AbortController; sources: Set<AudioBufferSourceNode> } | null = null;

function stopHosted(): void {
  if (!playing) return;
  playing.controller.abort();
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

/** Streams the hosted voice into Web Audio. Resolves with a reason when the browser voice should speak instead. */
async function speakHosted(ticket: SpeechTicket, language: Language, events: SpeakEvents, id: number): Promise<string | null> {
  const ctx = audio;
  if (!ctx) return "audio was not unlocked by a tap";
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});
  if (ctx.state !== "running") return "the browser blocked audio";

  const controller = new AbortController();
  const sources = new Set<AudioBufferSourceNode>();
  playing = { controller, sources };
  const startedAt = performance.now();
  const late = `no audio within ${config.tts.firstByteTimeoutMs / 1000} s`;
  const timer = setTimeout(() => controller.abort(), config.tts.firstByteTimeoutMs);
  let last: AudioBufferSourceNode | null = null;

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
      return id !== session ? null : controller.signal.aborted ? late : "voice service unreachable";
    }
    if (!response.ok || !response.body) return `voice service error ${response.status}`;
    const rate = Number(response.headers.get("X-Sample-Rate")) || config.tts.sampleRate;
    const info: SpeakInfo = {
      provider: header(response, "X-Voice-Provider") ?? "Hosted voice",
      voice: header(response, "X-Voice-Name") ?? null,
      model: header(response, "X-Voice-Model"),
      upstreamMs: Number(response.headers.get("X-Upstream-Ms")) || undefined,
    };

    const reader = response.body.getReader();
    let carry: number | null = null;
    let next = 0;
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        // Stopped by a newer session, cut by the timer before any sound, or broken mid-answer.
        return id !== session || last ? null : late;
      }
      if (id !== session) {
        void reader.cancel().catch(() => {});
        return null;
      }
      if (chunk.done) break;
      const decoded = pcm16ToFloat32(chunk.value, carry);
      carry = decoded.carry;
      if (!decoded.samples.length) continue;
      const buffer = ctx.createBuffer(1, decoded.samples.length, rate);
      buffer.getChannelData(0).set(decoded.samples);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      // Chunks are scheduled back to back on the audio clock, so they join without gaps.
      const at = Math.max(ctx.currentTime + 0.03, next);
      source.start(at);
      next = at + buffer.duration;
      sources.add(source);
      source.onended = () => sources.delete(source);
      if (!last) {
        clearTimeout(timer);
        const outputMs = (ctx.outputLatency || ctx.baseLatency || 0) * 1000;
        events.onStart?.({
          ...info,
          firstByteMs: Math.round(performance.now() - startedAt),
          audibleInMs: (at - ctx.currentTime) * 1000 + outputMs,
        });
      }
      last = source;
    }
    if (!last) return "voice service sent no audio";
    const final: AudioBufferSourceNode = last;
    const done = () => {
      sources.delete(final);
      if (id !== session) return;
      playing = null;
      events.onEnd?.();
    };
    // A slow stream can finish after its last chunk has already played.
    if (next <= ctx.currentTime) done();
    else final.onended = done;
    return null;
  } catch {
    return last ? null : "hosted voice failed";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Speaks an answer: with the hosted voice when the ticket is for this text, else (or when it fails before its first
 * sound) with the browser's voice. Never throws; without any voice the answer stays on screen.
 */
export function speakAnswer(text: string, language: Language, events: SpeakEvents, ticket?: SpeechTicket): void {
  stopSpeaking();
  const id = session;
  if (!ticket || ticket.text !== text) {
    speakInBrowser(text, language, events);
    return;
  }
  void speakHosted(ticket, language, events, id).then((fallback) => {
    if (fallback !== null && id === session) speakInBrowser(text, language, events, fallback);
  });
}

export function stopSpeaking(): void {
  session++;
  stopHosted();
  if (hasSynthesis()) window.speechSynthesis.cancel();
}
