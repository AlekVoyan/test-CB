/// <reference types="vitest/config" />
import { createReadStream } from "node:fs";
import { cp } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
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

/**
 * pdf.js keeps its decoders and font data outside the bundle and fetches them by URL. Without them a scanned page
 * renders blank: the image inside it is JBIG2 or JPEG 2000, and the decoder for those is a WebAssembly module. Found
 * on a scanned book from the Internet Archive, whose text layer read fine while every page came out white.
 */
const PDFJS_ASSETS = ["wasm", "cmaps", "standard_fonts", "iccs"];

function pdfjsAssets(): Plugin {
  const root = path.dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
  return {
    name: "pdfjs-assets",
    configureServer(server) {
      server.middlewares.use("/pdfjs", (req, res, next) => {
        const rel = path.normalize(decodeURIComponent((req.url ?? "/").split("?")[0]!)).replace(/^(\.\.[/\\])+/, "");
        const file = path.join(root, rel);
        if (!file.startsWith(root) || !PDFJS_ASSETS.some((dir) => file.startsWith(path.join(root, dir)))) return next();
        res.setHeader("Content-Type", file.endsWith(".wasm") ? "application/wasm" : "application/octet-stream");
        createReadStream(file)
          .on("error", () => next())
          .pipe(res);
      });
    },
    async closeBundle() {
      for (const dir of PDFJS_ASSETS) await cp(path.join(root, dir), path.join("dist", "pdfjs", dir), { recursive: true });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Expose server-only env (ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, LLM_MODEL, ...) to the dev middleware.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    plugins: [react(), apiDevServer(), pdfjsAssets()],
    // ONNX Runtime Web (the on-device voice) loads its WebAssembly itself; pre-bundling would break its paths.
    optimizeDeps: { exclude: ["onnxruntime-web"] },
    worker: { format: "es" },
    test: {
      include: ["src/**/*.test.ts"],
    },
  };
});
