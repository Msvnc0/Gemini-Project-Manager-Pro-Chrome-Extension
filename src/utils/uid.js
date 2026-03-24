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

/**
 * Generate a UUID v4 compliant ID.
 * Useful for cases where standard UUID format is preferred.
 */
function uuidv4() {
  return crypto.randomUUID();
}

/**
 * Generate a shorter ID for cases where length matters.
 * Still collision-resistant for reasonable usage.
 */
function shortId() {
  const arr = crypto.getRandomValues(new Uint32Array(2));
  return arr[0].toString(36) + arr[1].toString(36);
}
