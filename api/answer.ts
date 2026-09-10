// Vercel serverless function: POST /api/answer
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleAnswerRequest } from "../src/server/handler.js";

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse): Promise<void> {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || "unknown";
  const result = await handleAnswerRequest({ method: req.method ?? "GET", body: req.body ?? null, ip });
  res.statusCode = result.status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(result.json));
}
