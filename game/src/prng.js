// Deterministic seeded PRNG (Mulberry32) and fixed-step timing helpers.
// No unseeded randomness is ever used in gameplay or rendering.

export const FIXED_DT = 1 / 60;
export const DEFAULT_SEED = 20261125;

export function createRng(seed = DEFAULT_SEED) {
  let state = (seed >>> 0) || 1;

  function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function range(min, max) {
    return min + next() * (max - min);
  }

  function int(min, maxInclusive) {
    return min + Math.floor(next() * (maxInclusive - min + 1));
  }

  function pick(items) {
    if (!items.length) return undefined;
    return items[Math.floor(next() * items.length)];
  }

  function chance(probability) {
    return next() < probability;
  }

  function getState() {
    return state >>> 0;
  }

  return { next, range, int, pick, chance, getState };
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = clamp(t, 0, 1) - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}
