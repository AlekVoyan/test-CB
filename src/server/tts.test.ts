import { describe, expect, it } from "vitest";
import { handleTtsRequest, signSpeech, verifySpeech } from "./tts.js";

const env = { ELEVENLABS_API_KEY: "test-key" };

describe("hosted voice endpoint", () => {
  it("speaks only text the server signed", () => {
    const token = signSpeech("Model A: 20 units.", "k");
    expect(verifySpeech("Model A: 20 units.", token, "k")).toBe(true);
    expect(verifySpeech("Model A: 24 units.", token, "k")).toBe(false);
    expect(verifySpeech("Model A: 20 units.", token, "another key")).toBe(false);
    expect(verifySpeech("Model A: 20 units.", "short", "k")).toBe(false);
  });

  it("turns requests away before calling the voice service", async () => {
    const call = (body: unknown, e: Record<string, string | undefined> = env, method = "POST") =>
      handleTtsRequest({ method, body, ip: "test" }, e);
    expect((await call({ text: "Hi.", language: "en", token: "x" }, {})).status).toBe(404); // no key: no hosted voice
    expect((await call(null, env, "GET")).status).toBe(405);
    expect((await call({ text: "", language: "en", token: "x" })).status).toBe(400);
    const long = "a".repeat(601);
    expect((await call({ text: long, language: "en", token: signSpeech(long, "test-key") })).status).toBe(400);
    expect((await call({ text: "Hi.", language: "de", token: signSpeech("Hi.", "test-key") })).status).toBe(400);
    expect((await call({ text: "Hi.", language: "en", token: "forged" })).status).toBe(403);
  });
});
