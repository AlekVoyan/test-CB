// Vercel serverless function: POST /api/tts (streams the spoken answer as PCM)
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleTtsRequest, writeTtsResult } from "../src/server/tts.js";

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse): Promise<void> {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || "unknown";
  await writeTtsResult(res, await handleTtsRequest({ method: req.method ?? "GET", body: req.body ?? null, ip }));
}
