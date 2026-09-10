/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// In dev, serve POST /api/answer from the same handler Vercel runs in production.
function apiDevServer(): Plugin {
  return {
    name: "api-dev-server",
    configureServer(server) {
      server.middlewares.use("/api/answer", async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        let body: unknown = null;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
        } catch {
          body = null;
        }
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
    },
  };
}

export default defineConfig(({ mode }) => {
  // Expose server-only env (ANTHROPIC_API_KEY, LLM_MODEL, ...) to the dev middleware.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    plugins: [react(), apiDevServer()],
    test: {
      include: ["src/**/*.test.ts"],
    },
  };
});
