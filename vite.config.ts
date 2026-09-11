/// <reference types="vitest/config" />
import type { IncomingMessage } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
  } catch {
    return null;
  }
}

// In dev, serve /api/answer and /api/tts from the same handlers Vercel runs in production.
function apiDevServer(): Plugin {
  return {
    name: "api-dev-server",
    configureServer(server) {
      server.middlewares.use("/api/answer", async (req, res) => {
        const body = await readJson(req);
        const { handleAnswerRequest } = await server.ssrLoadModule("/src/server/handler.ts");
        const result = await handleAnswerRequest({
          method: req.method ?? "GET",
          body,
          ip: req.socket.remoteAddress ?? "local",
        });
        res.statusCode = result.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result.json));
      });
      server.middlewares.use("/api/tts", async (req, res) => {
        const body = await readJson(req);
        const { handleTtsRequest, writeTtsResult } = await server.ssrLoadModule("/src/server/tts.ts");
        await writeTtsResult(res, await handleTtsRequest({ method: req.method ?? "GET", body, ip: req.socket.remoteAddress ?? "local" }));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Expose server-only env (ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, LLM_MODEL, ...) to the dev middleware.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    plugins: [react(), apiDevServer()],
    // ONNX Runtime Web (the on-device voice) loads its WebAssembly itself; pre-bundling would break its paths.
    optimizeDeps: { exclude: ["onnxruntime-web"] },
    worker: { format: "es" },
    test: {
      include: ["src/**/*.test.ts"],
    },
  };
});
