// POST /api/tts: speaks an answer this server produced, with an ElevenLabs voice. The key stays on the server; the
// page gets 16-bit PCM it can play as it arrives. Used by Vercel (api/tts.ts) and by the Vite dev server.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { ServerResponse } from "node:http";
import { z } from "zod";
import { config } from "../core/config.js";
import { rateLimiter } from "./rateLimit.js";

export interface HostedVoice {
  key: string;
  model: string;
  voiceId: string;
  voiceName: string;
}

/** The hosted voice, when the server has a key for it. */
export function voiceFromEnv(env: Record<string, string | undefined>): HostedVoice | null {
  if (!env.ELEVENLABS_API_KEY) return null;
  const voiceId = env.ELEVENLABS_VOICE_ID || config.tts.voice.id;
  return {
    key: env.ELEVENLABS_API_KEY,
    model: env.ELEVENLABS_MODEL || config.tts.model,
    voiceId,
    voiceName: env.ELEVENLABS_VOICE_NAME || (voiceId === config.tts.voice.id ? config.tts.voice.name : voiceId),
  };
}

// The endpoint speaks only text that /api/answer returned, so a public deployment is not a free TTS proxy.
// The ticket is an HMAC of the text under a secret derived from the voice key; nothing is stored.
const secretOf = (key: string) => createHash("sha256").update(`speech-ticket:${key}`).digest();

export function signSpeech(text: string, key: string): string {
  return createHmac("sha256", secretOf(key)).update(text).digest("base64url");
}

export function verifySpeech(text: string, token: string, key: string): boolean {
  const expected = Buffer.from(signSpeech(text, key));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const TtsRequestSchema = z.object({
  text: z.string().min(1).max(config.tts.maxChars),
  language: z.enum(["en", "ru", "uk"]),
  token: z.string().min(1).max(200),
});

export type TtsResult =
  | { status: number; json: unknown }
  | { status: 200; audio: ReadableStream<Uint8Array>; headers: Record<string, string> };

// An answer is spoken once, plus replays.
const rateLimited = rateLimiter(60);

export async function handleTtsRequest(
  req: { method: string; body: unknown; ip: string },
  env: Record<string, string | undefined> = process.env,
): Promise<TtsResult> {
  const voice = voiceFromEnv(env);
  if (!voice) return { status: 404, json: { error: "This server has no hosted voice." } };
  if (req.method !== "POST") return { status: 405, json: { error: "Use POST." } };
  if (rateLimited(req.ip)) return { status: 429, json: { error: "Too many requests. Wait a minute and try again." } };
  const parsed = TtsRequestSchema.safeParse(req.body);
  if (!parsed.success) return { status: 400, json: { error: "Invalid request." } };
  const { text, language, token } = parsed.data;
  if (!verifySpeech(text, token, voice.key)) return { status: 403, json: { error: "This text did not come from this server." } };

  const startedAt = performance.now();
  let upstream: Response;
  try {
    upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.voiceId)}/stream?output_format=pcm_${config.tts.sampleRate}`,
      {
        method: "POST",
        headers: { "xi-api-key": voice.key, "Content-Type": "application/json" },
        // language_code pins the language: Ukrainian and Russian share most letters.
        body: JSON.stringify({ text, model_id: voice.model, language_code: language }),
        signal: AbortSignal.timeout(20_000),
      },
    );
  } catch (error) {
    return { status: 502, json: { error: `The voice service could not be reached: ${error instanceof Error ? error.message : String(error)}` } };
  }
  if (!upstream.ok || !upstream.body) {
    const detail = (await upstream.text().catch(() => "")).slice(0, 300);
    return { status: 502, json: { error: `The voice service answered ${upstream.status}.`, detail } };
  }
  return {
    status: 200,
    audio: upstream.body,
    headers: {
      "Content-Type": "audio/pcm",
      "Cache-Control": "no-store",
      "X-Sample-Rate": String(config.tts.sampleRate),
      "X-Voice-Provider": "ElevenLabs",
      "X-Voice-Model": voice.model,
      "X-Voice-Name": encodeURIComponent(voice.voiceName),
      // The voice service's time to respond, so the page can tell its own round trip from the service.
      "X-Upstream-Ms": String(Math.round(performance.now() - startedAt)),
    },
  };
}

/** Writes a result to a Node response, passing the audio on chunk by chunk. */
export async function writeTtsResult(res: ServerResponse, result: TtsResult): Promise<void> {
  if (!("audio" in result)) {
    res.statusCode = result.status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result.json));
    return;
  }
  res.writeHead(200, result.headers);
  const reader = result.audio.getReader();
  res.on("close", () => void reader.cancel().catch(() => {}));
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } catch {
    // the page went away, or the voice service dropped the stream
  }
  res.end();
}
