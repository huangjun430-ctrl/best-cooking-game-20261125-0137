// Pure deterministic kitchen simulation engine for Ember & Oak Kitchen.
// Manages seeded order generation, parallel grill/skillet/fryer cooking,
// dynamic multi-order assembly matching, plating, serving, combos, and effects.

import { createRng, clamp, DEFAULT_SEED } from './prng.js';
import {
  INGREDIENTS,
  HOT_INGREDIENT_IDS,
  RECIPES,
  RECIPE_MAP,
  GUEST_TABLES,
  getWaveConfig,
} from './recipes.js';
import {
  TICKET_SLOTS,
  HOT_STATION_RECTS,
  COLD_TRAY_RECTS,
  BOARD_ZONE_RECT,
  PASS_PLATE_SLOTS,
  SERVICE_BELL_RECT,
} from './layout.js';

export const SHIFT_DURATION = 90;
export const MAX_SERVING_PLATES = 2;

export function createKitchenState(seed = DEFAULT_SEED, sound = null) {
  const rng = createRng(seed);

  const stations = {};
  for (const id of HOT_INGREDIENT_IDS) {
    const spec = INGREDIENTS[id];
    stations[id] = {
      id,
      readyCount: 1, // Warmed up at shift open so service feels snappy immediately
      maxReady: spec.maxReady,
      cooking: true,
      cookProgress: 0.35,
      cookTime: spec.cookTime,
      sizzleFlash: 0,
      boostPulse: 0,
    };
  }

  const state = {
    seed,
    rng,
    sound,
    tick: 0,
    elapsed: 0,
    phase: 'playing', // 'playing' | 'paused' | 'gameover'
    shiftDuration: SHIFT_DURATION,
    timeRemaining: SHIFT_DURATION,
    wave: 1,
    waveLabel: 'OPENING PREP',
    score: 0,
    bestScore: 0,
    streak: 0,
    maxStreak: 0,
    servedCount: 0,
    missedCount: 0,
    mistakes: 0,
    nextOrderId: 1,
    spawnCooldown: 2.2,
    orders: [],
    selectedOrderId: null,
    assembly: {
      items: [], // [{ id, anim: 0..1 }]
      matchedOrderId: null,
      readyToPlateOrderId: null,
      boardBounce: 0,
      wrongShake: 0,
      knifeChop: 0,
    },
    stations,
    servingPass: [], // [{ uid, orderId, recipeId, isVip, customerTag, patienceRatio, createdAt, bounce }]
    nextPlateUid: 1,
    particles: [],
    popups: [],
    screenShake: 0,
    flashTint: null,
    flashAlpha: 0,
    bellBounce: 0,
    lastUrgentSecond: 15,
    statusTip: 'Pick ingredients [1-5] or hot pans [6-8] to build an order, then ring the bell [ENTER]!',
  };

  // Seed initial 3 opening orders deterministically
  spawnOrder(state, { forcedMinWave: 1 });
  spawnOrder(state, { forcedMinWave: 1 });
  spawnOrder(state, { forcedMinWave: 1 });
  reconcileTargetOrder(state);

  return state;
}

export function spawnOrder(state, options = {}) {
  const waveCfg = getWaveConfig(state.timeRemaining);
  if (!options.ignoreCap && state.orders.length >= waveCfg.maxOrders) return null;

  const allowedWave = options.forcedMinWave ?? waveCfg.wave;
  const pool = RECIPES.filter((r) => r.minWave <= allowedWave);
  const activeIds = new Set(state.orders.map((o) => o.recipeId));
  const distinctPool = pool.filter((r) => !activeIds.has(r.id));
  const chosen = options.recipeId
    ? RECIPE_MAP[options.recipeId]
    : state.rng.pick(distinctPool.length ? distinctPool : pool);

  const isVip = options.isVip ?? state.rng.chance(waveCfg.vipChance);
  const maxTime = Math.round(chosen.patience * waveCfg.patienceScale * (isVip ? 0.85 : 1));
  const tableTag = options.customerTag ?? state.rng.pick(GUEST_TABLES);

  const order = {
    id: state.nextOrderId++,
    recipeId: chosen.id,
    recipe: chosen,
    maxTime,
    timeLeft: options.timeLeft ?? maxTime,
    isVip,
    customerTag: tableTag,
    enterAnim: 0,
    pulse: 0,
  };

  state.orders.push(order);
  if (state.selectedOrderId === null) {
    state.selectedOrderId = order.id;
  }
  return order;
}

export function getActiveOrder(state) {
  if (!state.orders.length) return null;
  if (state.selectedOrderId !== null) {
    const found = state.orders.find((o) => o.id === state.selectedOrderId);
    if (found) return found;
  }
  return state.orders[0];
}

// Finds which active order matches the currently stacked ingredients on the prep board.
// Prefers the currently selected order if it still matches the prefix; otherwise pivots smoothly
// to the most urgent matching ticket so shared culinary prefixes feel intuitive.
export function reconcileTargetOrder(state) {
  const currentIds = state.assembly.items.map((item) => item.id);
  const matching = state.orders.filter((order) => {
    const steps = order.recipe.steps;
    if (currentIds.length > steps.length) return false;
    for (let i = 0; i < currentIds.length; i++) {
      if (steps[i] !== currentIds[i]) return false;
    }
    return true;
  });

  let chosen = null;
  if (matching.length > 0) {
    chosen = matching.find((o) => o.id === state.selectedOrderId) || null;
    if (!chosen) {
      // Pick the matching ticket with the least time remaining
      chosen = matching.slice().sort((a, b) => a.timeLeft - b.timeLeft)[0];
    }
  } else {
    chosen = state.orders.find((o) => o.id === state.selectedOrderId) || state.orders[0] || null;
  }

  state.selectedOrderId = chosen ? chosen.id : null;
  state.assembly.matchedOrderId = chosen && matching.some((m) => m.id === chosen.id) ? chosen.id : null;
  state.assembly.readyToPlateOrderId =
    chosen &&
    state.assembly.matchedOrderId === chosen.id &&
    currentIds.length === chosen.recipe.steps.length
      ? chosen.id
      : null;

  return chosen;
}

export function getExpectedNextIngredient(state) {
  const order = getActiveOrder(state);
  if (!order) return null;
  const idx = state.assembly.items.length;
  if (idx >= order.recipe.steps.length) return null;
  // Ensure prefix actually matches this order
  for (let i = 0; i < idx; i++) {
    if (order.recipe.steps[i] !== state.assembly.items[i].id) return null;
  }
  return order.recipe.steps[idx];
}

export function selectOrderByIndex(state, slotIndex) {
  if (state.phase !== 'playing') return false;
  const order = state.orders[slotIndex];
  if (!order) return false;
  state.selectedOrderId = order.id;
  order.pulse = 1;
  state.statusTip = `Focused ${order.recipe.name} (${order.customerTag})`;
  return true;
}

export function cycleSelectedOrder(state) {
  if (state.phase !== 'playing' || state.orders.length <= 1) return false;
  const idx = state.orders.findIndex((o) => o.id === state.selectedOrderId);
  const nextIdx = (idx + 1) % state.orders.length;
  return selectOrderByIndex(state, nextIdx);
}

function addPopup(state, x, y, text, color = '#fff7e6', scale = 1) {
  state.popups.push({
    x,
    y,
    vy: -46,
    text,
    color,
    scale,
    life: 1.05,
    maxLife: 1.05,
  });
}

function burstParticles(state, x, y, count, palette, speedMin = 45, speedMax = 155, kind = 'spark') {
  for (let i = 0; i < count; i++) {
    const angle = state.rng.range(0, Math.PI * 2);
    const speed = state.rng.range(speedMin, speedMax);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (kind === 'steam' ? 35 : 40),
      size: state.rng.range(kind === 'steam' ? 7 : 3, kind === 'steam' ? 15 : 7),
      color: state.rng.pick(palette),
      life: state.rng.range(0.35, 0.85),
      maxLife: 0.85,
      kind,
    });
  }
}

export function addIngredient(state, ingredientId, options = {}) {
  if (state.phase !== 'playing') return { ok: false, reason: 'not_playing' };
  const spec = INGREDIENTS[ingredientId];
  if (!spec) return { ok: false, reason: 'unknown' };

  const boardCx = BOARD_ZONE_RECT.x + BOARD_ZONE_RECT.w * 0.5;
  const boardCy = BOARD_ZONE_RECT.y + BOARD_ZONE_RECT.h * 0.52;

  // Hot station handling: requires a seared/ready portion unless station is clicked to boost sear
  if (spec.station === 'hot') {
    const st = state.stations[ingredientId];
    if (st.readyCount <= 0) {
      // Speed up cooking when player actively taps the pan/fryer!
      st.cooking = true;
      st.cookProgress = clamp(st.cookProgress + 0.34, 0, 1);
      st.boostPulse = 1;
      const rect = HOT_STATION_RECTS[ingredientId];
      burstParticles(
        state,
        rect.x + rect.w * 0.5,
        rect.y + rect.h * 0.5,
        6,
        ['#ffd166', '#ff8c42', '#fff3c4'],
        30,
        90,
        'spark',
      );
      if (st.cookProgress >= 1) {
        st.readyCount = Math.min(st.maxReady, st.readyCount + 1);
        st.cookProgress = 0;
        st.sizzleFlash = 1;
        addPopup(state, rect.x + rect.w * 0.5, rect.y + 40, 'SEARED READY!', '#ffe082', 0.9);
      } else {
        addPopup(state, rect.x + rect.w * 0.5, rect.y + 42, 'SIZZLING +', '#ffba66', 0.85);
        state.sound?.playSizzle(0);
        return { ok: false, reason: 'cooking_boosted' };
      }
    }
  }

  // Check if appending this ingredient matches ANY active order's prefix
  const candidateIds = [...state.assembly.items.map((i) => i.id), ingredientId];
  const matchingOrders = state.orders.filter((order) => {
    const steps = order.recipe.steps;
    if (candidateIds.length > steps.length) return false;
    for (let i = 0; i < candidateIds.length; i++) {
      if (steps[i] !== candidateIds[i]) return false;
    }
    return true;
  });

  if (matchingOrders.length === 0) {
    // Wrong ingredient! Visual shake, buzz, small shift time penalty
    state.mistakes += 1;
    state.streak = 0;
    state.timeRemaining = Math.max(0.5, state.timeRemaining - 2.0);
    state.assembly.wrongShake = 1;
    state.screenShake = 8;
    state.flashTint = 'rgba(220, 52, 42, 0.28)';
    state.flashAlpha = 1;
    state.sound?.playErrorBuzz();
    addPopup(state, boardCx, boardCy - 48, `WRONG: ${spec.shortName.toUpperCase()} (-2s)`, '#ff6b5e', 1.05);
    burstParticles(state, boardCx, boardCy, 10, ['#ff5c4d', '#ff9e7d', '#54241e'], 60, 160, 'spark');
    state.statusTip = `Oops! Check the highlighted ingredient on the Order Board.`;
    return { ok: false, reason: 'wrong_ingredient' };
  }

  // Consume from hot station if hot
  if (spec.station === 'hot') {
    const st = state.stations[ingredientId];
    st.readyCount = Math.max(0, st.readyCount - 1);
    st.cooking = true;
    st.sizzleFlash = 0.8;
    const rect = HOT_STATION_RECTS[ingredientId];
    burstParticles(
      state,
      rect.x + rect.w * 0.5,
      rect.y + rect.h * 0.5,
      9,
      ['#ffd97d', '#ff9248', '#fff8de'],
      40,
      125,
      'spark',
    );
    state.sound?.playSizzle(candidateIds.length - 1);
  } else {
    state.assembly.knifeChop = 1;
    const tray = COLD_TRAY_RECTS[ingredientId];
    if (tray) {
      burstParticles(
        state,
        tray.x + tray.w * 0.5,
        tray.y + tray.h * 0.5,
        7,
        [spec.accent, '#fff8eb', '#ffd88a'],
        35,
        100,
        'crumb',
      );
    }
    state.sound?.playChop(candidateIds.length - 1);
  }

  // Stack ingredient onto the cutting board
  state.assembly.items.push({ id: ingredientId, anim: 0 });
  state.assembly.boardBounce = 1;
  burstParticles(state, boardCx, boardCy - 18, 9, [spec.accent, '#ffe9b8', '#ffffff'], 40, 120, 'crumb');

  // Lock onto the best matching order
  const target = reconcileTargetOrder(state);
  const stepPoints = 15;
  state.score += stepPoints;
  addPopup(state, boardCx, boardCy - 66, `+${stepPoints} ${spec.shortName}`, '#fff3d1', 0.92);

  // If the assembled stack now completes the matched recipe, auto-plate onto Serving Pass if open!
  if (target && state.assembly.readyToPlateOrderId === target.id && !options.holdOnBoard) {
    if (state.servingPass.length < MAX_SERVING_PLATES) {
      plateCurrentDish(state);
    } else {
      state.statusTip = `Serving Pass is full! Ring the bell [ENTER] to serve a plate, then [SPACE] to plate.`;
    }
  } else if (target) {
    const nextId = getExpectedNextIngredient(state);
    const nextName = nextId ? INGREDIENTS[nextId].name : 'Plate';
    state.statusTip = `Building ${target.recipe.name}: next add ${nextName} [${nextId ? INGREDIENTS[nextId].key : 'SPACE'}]`;
  }

  return { ok: true, targetOrderId: target ? target.id : null };
}

export function plateCurrentDish(state) {
  if (state.phase !== 'playing') return false;
  const orderId = state.assembly.readyToPlateOrderId;
  if (!orderId) return false;

  if (state.servingPass.length >= MAX_SERVING_PLATES) {
    state.screenShake = 4;
    addPopup(
      state,
      PASS_PLATE_SLOTS[0].cx + 80,
      PASS_PLATE_SLOTS[0].cy - 70,
      'SERVE A PLATE FIRST!',
      '#ffd166',
      0.95,
    );
    state.sound?.playErrorBuzz();
    return false;
  }

  const orderIdx = state.orders.findIndex((o) => o.id === orderId);
  if (orderIdx === -1) return false;
  const order = state.orders[orderIdx];
  const patienceRatio = clamp(order.timeLeft / Math.max(1, order.maxTime), 0, 1);

  // Remove ticket from top rail? Wait: keeping the ticket until served OR marking it plated:
  // Replacing the ticket immediately keeps 3-4 active orders on the top board at ALL times!
  state.orders.splice(orderIdx, 1);
  const slotIdx = state.servingPass.length;

  state.servingPass.push({
    uid: state.nextPlateUid++,
    orderId: order.id,
    recipeId: order.recipeId,
    recipe: order.recipe,
    isVip: order.isVip,
    customerTag: order.customerTag,
    patienceRatio,
    bounce: 1,
    glowPhase: 0,
  });

  state.assembly.items = [];
  state.assembly.matchedOrderId = null;
  state.assembly.readyToPlateOrderId = null;
  state.sound?.playPlateComplete();

  const pad = PASS_PLATE_SLOTS[slotIdx] || PASS_PLATE_SLOTS[0];
  burstParticles(state, pad.cx, pad.cy - 10, 14, ['#ffe082', '#ffffff', '#ffae42'], 45, 145, 'star');
  addPopup(state, pad.cx, pad.cy - 78, `${order.recipe.name} PLATED!`, '#ffe28a', 1.02);

  // Immediately ensure the order rail stays rich & bustling
  if (state.orders.length < 3) {
    spawnOrder(state);
  }
  reconcileTargetOrder(state);
  state.statusTip = `Plate ready on the pass! Click the glowing plate or press [ENTER] to serve!`;
  return true;
}

export function servePlate(state, slotIndex = 0) {
  if (state.phase !== 'playing') return { ok: false };
  if (state.servingPass.length === 0) {
    // Convenience: if dish is ready on board, plate & serve smoothly
    if (state.assembly.readyToPlateOrderId) {
      plateCurrentDish(state);
    } else {
      return { ok: false };
    }
  }

  const idx = clamp(slotIndex, 0, state.servingPass.length - 1);
  const plate = state.servingPass.splice(idx, 1)[0];
  const pad = PASS_PLATE_SLOTS[idx] || PASS_PLATE_SLOTS[0];

  state.streak += 1;
  state.maxStreak = Math.max(state.maxStreak, state.streak);
  state.servedCount += 1;

  const multiplier = Math.min(5, 1 + Math.floor((state.streak - 1) / 2));
  const speedBonus = Math.round(plate.patienceRatio * 65);
  const vipBonus = plate.isVip ? 1.4 : 1.0;
  const totalAward = Math.round((plate.recipe.basePoints + speedBonus) * vipBonus * multiplier);

  state.score += totalAward;
  state.bestScore = Math.max(state.bestScore, state.score);
  state.bellBounce = 1;
  state.flashTint = 'rgba(255, 214, 102, 0.16)';
  state.flashAlpha = 1;
  state.sound?.playServiceBell(state.streak);

  burstParticles(state, pad.cx, pad.cy - 12, 22, ['#ffd54f', '#fff8d6', '#ff8f3f', '#68d391'], 60, 210, 'star');
  const bellCx = SERVICE_BELL_RECT.x + SERVICE_BELL_RECT.w * 0.5;
  addPopup(
    state,
    pad.cx,
    pad.cy - 68,
    `+${totalAward}${multiplier > 1 ? ` (x${multiplier} STREAK!)` : ''}`,
    '#ffe066',
    multiplier > 1 ? 1.25 : 1.1,
  );
  addPopup(state, bellCx, SERVICE_BELL_RECT.y - 16, `ORDER UP · ${plate.customerTag}!`, '#ffffff', 0.92);

  state.statusTip = `Served ${plate.recipe.name} for +${totalAward} pts! Streak: ${state.streak}`;
  return { ok: true, award: totalAward, multiplier };
}

export function scrapAssembly(state) {
  if (state.phase !== 'playing') return false;
  if (state.assembly.items.length === 0) return false;
  const boardCx = BOARD_ZONE_RECT.x + BOARD_ZONE_RECT.w * 0.5;
  const boardCy = BOARD_ZONE_RECT.y + BOARD_ZONE_RECT.h * 0.52;
  state.assembly.items = [];
  state.assembly.matchedOrderId = null;
  state.assembly.readyToPlateOrderId = null;
  state.sound?.playScrap();
  burstParticles(state, boardCx, boardCy, 8, ['#b59c80', '#7e6650', '#e3d1b7'], 35, 110, 'crumb');
  addPopup(state, boardCx, boardCy - 40, 'BOARD CLEARED', '#e2d2be', 0.9);
  reconcileTargetOrder(state);
  return true;
}

export function stepKitchen(state, dt) {
  if (state.phase !== 'playing') return;

  state.tick += 1;
  state.elapsed += dt;

  // Countdown global shift timer
  state.timeRemaining = Math.max(0, state.timeRemaining - dt);
  const waveCfg = getWaveConfig(state.timeRemaining);
  state.wave = waveCfg.wave;
  state.waveLabel = waveCfg.label;

  // Urgent heartbeat tick in final 12 seconds
  const ceilSec = Math.ceil(state.timeRemaining);
  if (ceilSec <= 12 && ceilSec > 0 && ceilSec < state.lastUrgentSecond) {
    state.lastUrgentSecond = ceilSec;
    state.sound?.playUrgentTick();
  }

  if (state.timeRemaining <= 0) {
    state.timeRemaining = 0;
    state.phase = 'gameover';
    state.bestScore = Math.max(state.bestScore, state.score);
    state.sound?.playGameOver();
    state.statusTip = 'Shift complete! Press [R] or click Play Again for a new service.';
    return;
  }

  // Update hot sizzle stations (parallel auto-searing up to maxReady)
  for (const id of HOT_INGREDIENT_IDS) {
    const st = state.stations[id];
    if (st.sizzleFlash > 0) st.sizzleFlash = Math.max(0, st.sizzleFlash - dt * 2.5);
    if (st.boostPulse > 0) st.boostPulse = Math.max(0, st.boostPulse - dt * 3.0);

    if (st.readyCount < st.maxReady) {
      st.cooking = true;
      st.cookProgress += dt / st.cookTime;
      if (st.cookProgress >= 1) {
        st.cookProgress = 0;
        st.readyCount = Math.min(st.maxReady, st.readyCount + 1);
        st.sizzleFlash = 1;
        const rect = HOT_STATION_RECTS[id];
        burstParticles(
          state,
          rect.x + rect.w * 0.5,
          rect.y + rect.h * 0.45,
          5,
          ['#fff3c4', '#ffd166'],
          20,
          75,
          'steam',
        );
      }
    } else {
      st.cooking = false;
      st.cookProgress = 0;
    }

    // Gentle deterministic ambient steam over hot burners
    if (state.tick % 24 === (id === 'patty' ? 0 : id === 'egg' ? 8 : 16)) {
      const rect = HOT_STATION_RECTS[id];
      state.particles.push({
        x: rect.x + rect.w * state.rng.range(0.28, 0.72),
        y: rect.y + rect.h * 0.35,
        vx: state.rng.range(-8, 8),
        vy: state.rng.range(-36, -22),
        size: state.rng.range(8, 15),
        color: 'rgba(255, 250, 240, 0.48)',
        life: 0.95,
        maxLife: 0.95,
        kind: 'steam',
      });
    }
  }

  // Update active order ticket timers
  for (let i = state.orders.length - 1; i >= 0; i--) {
    const order = state.orders[i];
    order.enterAnim = Math.min(1, order.enterAnim + dt * 5.2);
    if (order.pulse > 0) order.pulse = Math.max(0, order.pulse - dt * 2.8);
    order.timeLeft -= dt;

    if (order.timeLeft <= 0) {
      const slot = TICKET_SLOTS[i] || TICKET_SLOTS[0];
      state.orders.splice(i, 1);
      state.missedCount += 1;
      state.streak = 0;
      state.screenShake = 6;
      state.sound?.playErrorBuzz();
      addPopup(state, slot.x + slot.w * 0.5, slot.y + 80, 'ORDER EXPIRED!', '#ff6b5e', 1.0);
    }
  }

  // Spawn fresh orders to keep the rush brisk
  state.spawnCooldown -= dt;
  if (state.orders.length < 3 || (state.orders.length < waveCfg.maxOrders && state.spawnCooldown <= 0)) {
    spawnOrder(state);
    state.spawnCooldown = waveCfg.spawnInterval;
    reconcileTargetOrder(state);
  }

  // Animate cutting board items, serving plates, popups, particles
  for (const item of state.assembly.items) {
    item.anim = Math.min(1, item.anim + dt * 6.5);
  }
  if (state.assembly.boardBounce > 0) state.assembly.boardBounce = Math.max(0, state.assembly.boardBounce - dt * 4.5);
  if (state.assembly.wrongShake > 0) state.assembly.wrongShake = Math.max(0, state.assembly.wrongShake - dt * 4.0);
  if (state.assembly.knifeChop > 0) state.assembly.knifeChop = Math.max(0, state.assembly.knifeChop - dt * 5.5);

  for (let i = 0; i < state.servingPass.length; i++) {
    const p = state.servingPass[i];
    p.glowPhase += dt * 3.2;
    if (p.bounce > 0) p.bounce = Math.max(0, p.bounce - dt * 4.2);
    if (state.tick % 32 === i * 15) {
      const pad = PASS_PLATE_SLOTS[i] || PASS_PLATE_SLOTS[0];
      state.particles.push({
        x: pad.cx + state.rng.range(-24, 24),
        y: pad.cy - 28,
        vx: state.rng.range(-6, 6),
        vy: state.rng.range(-30, -18),
        size: state.rng.range(7, 13),
        color: 'rgba(255, 246, 224, 0.52)',
        life: 0.9,
        maxLife: 0.9,
        kind: 'steam',
      });
    }
  }

  if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - dt * 26);
  if (state.flashAlpha > 0) state.flashAlpha = Math.max(0, state.flashAlpha - dt * 3.2);
  if (state.bellBounce > 0) state.bellBounce = Math.max(0, state.bellBounce - dt * 4.5);

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.kind !== 'steam') {
      pt.vy += 260 * dt;
    }
  }

  for (let i = state.popups.length - 1; i >= 0; i--) {
    const pop = state.popups[i];
    pop.life -= dt;
    if (pop.life <= 0) {
      state.popups.splice(i, 1);
      continue;
    }
    pop.y += pop.vy * dt;
    pop.vy *= 0.96;
  }
}

// Deterministic mid-game Showcase/Demo Builder (Shift+D or ?shot=...)
// Uses genuine state simulation operations so every screenshot is 100% live gameplay!
export function applyShowcaseState(state, preset = 'rush') {
  const seed = state.seed;
  const fresh = createKitchenState(seed, state.sound);
  Object.assign(state, fresh);

  // Configure high-density rush hour orders with varied timers and VIP star
  state.orders = [];
  state.nextOrderId = 1;
  state.timeRemaining = preset === 'gameover' ? 0.05 : preset === 'combo' ? 38.4 : preset === 'assembly' ? 51.2 : 62.5;
  const wCfg = getWaveConfig(state.timeRemaining);
  state.wave = wCfg.wave;
  state.waveLabel = wCfg.label;

  const t1 = spawnOrder(state, { recipeId: 'bistro_crown', isVip: true, customerTag: 'T-07', timeLeft: 23.5, ignoreCap: true });
  const t2 = spawnOrder(state, { recipeId: 'copper_sunrise', isVip: false, customerTag: 'BAR-1', timeLeft: 11.4, ignoreCap: true });
  spawnOrder(state, { recipeId: 'orchard_melt', isVip: false, customerTag: 'T-02', timeLeft: 29.8, ignoreCap: true });
  spawnOrder(state, { recipeId: 'golden_fryer', isVip: true, customerTag: 'PATIO', timeLeft: 5.2, ignoreCap: true });

  for (const o of state.orders) o.enterAnim = 1;

  // Populate hot stations so players see seared ready food AND active live sizzle rings
  state.stations.patty.readyCount = 2;
  state.stations.patty.cookProgress = 0.0;
  state.stations.egg.readyCount = 1;
  state.stations.egg.cooking = true;
  state.stations.egg.cookProgress = 0.68;
  state.stations.fries.readyCount = 1;
  state.stations.fries.cooking = true;
  state.stations.fries.cookProgress = 0.44;

  // Put 1 completed gourmet dish (and a 2nd on combo preset) gleaming on the Serving Pass
  state.servingPass = [
    {
      uid: state.nextPlateUid++,
      orderId: 90,
      recipeId: 'ember_stack',
      recipe: RECIPE_MAP.ember_stack,
      isVip: true,
      customerTag: 'T-05',
      patienceRatio: 0.86,
      bounce: 0.15,
      glowPhase: 1.2,
    },
  ];

  if (preset === 'combo') {
    state.servingPass.push({
      uid: state.nextPlateUid++,
      orderId: 91,
      recipeId: 'golden_fryer',
      recipe: RECIPE_MAP.golden_fryer,
      isVip: false,
      customerTag: 'T-09',
      patienceRatio: 0.74,
      bounce: 0.2,
      glowPhase: 2.1,
    });
  }

  // Assemble the active dish mid-way on the central oak cutting board (varied per showcase scene)
  if (preset === 'combo') {
    state.selectedOrderId = t2.id;
    state.assembly.items = [
      { id: 'bun', anim: 1 },
      { id: 'patty', anim: 1 },
      { id: 'egg', anim: 0.94 },
    ];
  } else {
    state.selectedOrderId = t1.id;
    state.assembly.items = [
      { id: 'bun', anim: 1 },
      { id: 'patty', anim: 1 },
      { id: 'cheddar', anim: 1 },
    ];
    if (preset === 'assembly') {
      state.assembly.items.push({ id: 'tomato', anim: 0.88 });
      state.assembly.knifeChop = 0.72;
    }
  }
  reconcileTargetOrder(state);

  // Set realistic score & streak progress
  state.score = preset === 'combo' ? 2480 : preset === 'assembly' ? 1690 : preset === 'gameover' ? 3140 : 1240;
  state.bestScore = Math.max(state.bestScore, state.score);
  state.streak = preset === 'combo' ? 6 : preset === 'gameover' ? 5 : 4;
  state.maxStreak = Math.max(state.streak, 6);
  state.servedCount = preset === 'gameover' ? 14 : preset === 'combo' ? 10 : 6;
  state.missedCount = preset === 'gameover' ? 1 : 0;

  // Add subtle live steam & floating celebratory popup on combo preset
  for (let s = 0; s < 12; s++) {
    stepKitchen(state, 1 / 60);
  }
  if (preset === 'combo') {
    const bellCx = SERVICE_BELL_RECT.x + SERVICE_BELL_RECT.w * 0.5;
    state.bellBounce = 0.65;
    addPopup(state, bellCx, SERVICE_BELL_RECT.y - 18, '+420 (x3 STREAK!)', '#ffe066', 1.28);
    burstParticles(state, bellCx, SERVICE_BELL_RECT.y - 6, 16, ['#ffd54f', '#fff8d6', '#ff8f3f', '#68d391'], 45, 130, 'star');
  }
  if (preset === 'gameover') {
    state.timeRemaining = 0;
    state.phase = 'gameover';
  }
}
