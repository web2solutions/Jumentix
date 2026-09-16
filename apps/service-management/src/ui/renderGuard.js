/**
 * renderGuard — skips redundant full render passes in the designer (JUM-770).
 *
 * The designer's global render() rebuilds every panel, the canvas, the edges
 * and the mini-map. Cross-tab sync and chained renders call it with state
 * that did not actually change, which is the visible "blink". The guard
 * computes a stable signature of everything render() reads; a render whose
 * signature matches the previous one is a no-op.
 *
 * Safety rule: anything that mutates outside the signed inputs must call
 * `invalidate()` — when in doubt, mark dirty.
 */

// Long strings (generated code files, JSON blobs) dominate the serialization
// cost but almost never collide on (length, head, tail) — compact them.
const LONG_STRING_THRESHOLD = 120;

function compactValue(value) {
  if (typeof value === 'string' && value.length > LONG_STRING_THRESHOLD) {
    return `${value.length}:${value.slice(0, 40)}:${value.slice(-40)}`;
  }
  return value;
}

export function stableSerialize(value) {
  const seen = new WeakSet();
  const normalize = (input) => {
    if (input === null || typeof input !== 'object') return compactValue(input);
    if (seen.has(input)) return '[Circular]';
    seen.add(input);
    if (Array.isArray(input)) return input.map(normalize);
    const output = {};
    Object.keys(input).sort((a, b) => a.localeCompare(b)).forEach((key) => {
      const item = input[key];
      if (typeof item === 'function' || item === undefined) return;
      output[key] = normalize(item);
    });
    return output;
  };
  return JSON.stringify(normalize(value));
}

export function createRenderGuard(computeSignature) {
  let lastSignature = null;
  return {
    // Returns true when the render must run (first call, changed signature,
    // or after invalidate) and records the new signature.
    shouldRender() {
      const signature = typeof computeSignature === 'function'
        ? computeSignature()
        : String(computeSignature);
      if (signature === lastSignature) return false;
      lastSignature = signature;
      return true;
    },
    invalidate() {
      lastSignature = null;
    }
  };
}
