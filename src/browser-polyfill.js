/**
 * browser-polyfill.js — Cross-browser API namespace shim
 *
 * Firefox exposes extension APIs on the `browser` global (promise-based).
 * Chrome exposes them on the `chrome` global (MV3 also returns promises).
 *
 * This shim normalizes the namespace so all source files can use `browser.*`
 * on both browsers. On Firefox, `browser` is already native; on Chrome,
 * we alias it to `chrome`.
 */
if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
  globalThis.browser = chrome;
}
