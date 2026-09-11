/**
 * 16-bit little-endian PCM → Web Audio samples. A network chunk can end in the middle of a sample:
 * its odd byte is carried over to the next chunk.
 */
export function pcm16ToFloat32(chunk: Uint8Array, carry: number | null): { samples: Float32Array; carry: number | null } {
  let bytes = chunk;
  if (carry !== null) {
    bytes = new Uint8Array(chunk.length + 1);
    bytes[0] = carry;
    bytes.set(chunk, 1);
  }
  const count = bytes.length >> 1;
  const samples = new Float32Array(count);
  const view = new DataView(bytes.buffer, bytes.byteOffset, count * 2);
  for (let i = 0; i < count; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  return { samples, carry: bytes.length % 2 ? bytes[bytes.length - 1]! : null };
}
