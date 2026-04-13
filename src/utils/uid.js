/**
 * uid.js — Collision-Proof Unique ID Generator
 *
 * Uses crypto.getRandomValues() for cryptographic randomness.
 * Format: <timestamp>-<random1>-<random2>
 *
 * Collision resistance: Even with millions of IDs, collision probability is negligible.
 */

function uid() {
  const timestamp = Date.now().toString(36);
  const random1 = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  const random2 = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  return `${timestamp}-${random1}-${random2}`;
}
