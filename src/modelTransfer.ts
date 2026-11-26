// Packs model bytes into the sequence of messages sent to the webview.
// Kept separate so scripts/smoke.js can test this exact code without VS Code.

const CHUNK = 16 * 1024 * 1024; // bytes per chunk

/**
 * A PLAIN Uint8Array view over the same memory (no copy). Required: Node Buffer
 * has toJSON(), and VS Code serializes messages with JSON.stringify, so a Buffer
 * turns into {type:"Buffer",data:[...]} instead of being sent as binary and
 * the webview receives an empty array (the 2.0.1 bug).
 */
function plainBytes(src: Uint8Array, offset: number, length: number): Uint8Array {
  return new Uint8Array(src.buffer, src.byteOffset + offset, length);
}

export function buildModelMessages(name: string, bytes: Uint8Array): object[] {
  const total = Math.ceil(bytes.byteLength / CHUNK);
  const messages: object[] = [{ type: "modelMeta", name, byteSize: bytes.byteLength, chunks: total }];
  for (let i = 0; i < total; i++) {
    const offset = i * CHUNK;
    messages.push({
      type: "modelChunk",
      data: plainBytes(bytes, offset, Math.min(CHUNK, bytes.byteLength - offset)),
    });
  }
  messages.push({ type: "modelDone" });
  return messages;
}
