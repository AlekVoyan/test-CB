import { describe, expect, it } from "vitest";
import { pcm16ToFloat32 } from "./pcm";

describe("PCM chunks from the hosted voice", () => {
  it("decodes little-endian 16-bit samples", () => {
    const { samples, carry } = pcm16ToFloat32(new Uint8Array([0x00, 0x80, 0xff, 0x7f, 0x00, 0x00]), null);
    expect(Array.from(samples)).toEqual([-1, 32767 / 32768, 0]);
    expect(carry).toBeNull();
  });

  it("carries a sample split across two chunks", () => {
    const first = pcm16ToFloat32(new Uint8Array([0x00, 0x40, 0x00]), null);
    expect(Array.from(first.samples)).toEqual([0.5]);
    expect(first.carry).toBe(0x00);
    const second = pcm16ToFloat32(new Uint8Array([0xc0]), first.carry);
    expect(Array.from(second.samples)).toEqual([-0.5]);
    expect(second.carry).toBeNull();
  });
});
