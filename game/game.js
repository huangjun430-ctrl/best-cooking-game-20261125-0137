// Main bootstrap, deterministic fixed-timestep driver, pointer/keyboard router,
// and showcase snapshot trigger for Ember & Oak Kitchen.

import { FIXED_DT, DEFAULT_SEED } from './src/prng.js';
import { KEY_TO_INGREDIENT, COLD_INGREDIENT_IDS, HOT_INGREDIENT_IDS } from './src/recipes.js';
import { createSoundEngine } from './src/soundEngine.js';
import {
  createKitchenState,
  addIngredient,
  plateCurrentDish,
  servePlate,
  scrapAssembly,
  selectOrderByIndex,
  cycleSelectedOrder,
  stepKitchen,
  applyShowcaseState,
} from './src/kitchenState.js';
import {
  STAGE_W,
  STAGE_H,
  HUD_BUTTONS,
  TICKET_SLOTS,
  HOT_STATION_RECTS,
  COLD_TRAY_RECTS,
  BOARD_ACTION_RECT,
  PASS_PLATE_SLOTS,
  SERVICE_BELL_RECT,
  GAMEOVER_RESTART_RECT,
  hitTestRect,
} from './src/layout.js';
import { renderKitchen } from './src/kitchenRenderer.js';

const canvas = document.getElementById('kitchen-canvas');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const parsedSeed = Number.parseInt(params.get('seed') || '', 10);
const initialSeed = Number.isFinite(parsedSeed) && parsedSeed > 0 ? parsedSeed : DEFAULT_SEED;
const shotPreset = params.get('shot');

const sound = createSoundEngine();
let state = createKitchenState(initialSeed, sound);
const ui = { hoverKey: null };

if (shotPreset) {
  applyShowcaseState(state, shotPreset);
}

function resetShift(nextSeed = state.seed) {
  const prevBest = state.bestScore;
  state = createKitchenState(nextSeed, sound);
  state.bestScore = Math.max(prevBest, state.bestScore);
}

function toStageCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * STAGE_W,
    y: ((clientY - rect.top) / rect.height) * STAGE_H,
  };
}

function findHitTarget(px, py) {
  if (state.phase === 'gameover') {
    if (hitTestRect(px, py, GAMEOVER_RESTART_RECT)) return 'gameover:restart';
  }
  if (hitTestRect(px, py, HUD_BUTTONS.mute)) return 'hud:mute';
  if (hitTestRect(px, py, HUD_BUTTONS.demo)) return 'hud:demo';
  if (hitTestRect(px, py, HUD_BUTTONS.restart)) return 'hud:restart';

  for (let i = 0; i < TICKET_SLOTS.length; i++) {
    if (state.orders[i] && hitTestRect(px, py, TICKET_SLOTS[i])) return `ticket:${i}`;
  }
  for (const id of HOT_INGREDIENT_IDS) {
    if (hitTestRect(px, py, HOT_STATION_RECTS[id])) return `hot:${id}`;
  }
  for (const id of COLD_INGREDIENT_IDS) {
    if (hitTestRect(px, py, COLD_TRAY_RECTS[id])) return `cold:${id}`;
  }
  if (hitTestRect(px, py, COLD_TRAY_RECTS.scrap)) return 'cold:scrap';
  if (hitTestRect(px, py, BOARD_ACTION_RECT)) return 'board:action';
  for (let i = 0; i < PASS_PLATE_SLOTS.length; i++) {
    if (hitTestRect(px, py, PASS_PLATE_SLOTS[i].rect)) return `pass:${i}`;
  }
  if (hitTestRect(px, py, SERVICE_BELL_RECT)) return 'pass:bell';

  return null;
}

function handlePointerMove(event) {
  const { x, y } = toStageCoords(event.clientX, event.clientY);
  ui.hoverKey = findHitTarget(x, y);
  canvas.style.cursor = ui.hoverKey ? 'pointer' : 'default';
}

function handlePointerDown(event) {
  sound.unlock();
  const { x, y } = toStageCoords(event.clientX, event.clientY);
  const target = findHitTarget(x, y);
  if (!target) return;

  if (target === 'gameover:restart' || target === 'hud:restart') {
    resetShift(state.seed);
    return;
  }
  if (target === 'hud:mute') {
    sound.toggleMute();
    return;
  }
  if (target === 'hud:demo') {
    applyShowcaseState(state, 'rush');
    return;
  }
  if (state.phase !== 'playing') return;

  if (target.startsWith('ticket:')) {
    selectOrderByIndex(state, Number(target.split(':')[1]));
  } else if (target.startsWith('hot:')) {
    addIngredient(state, target.split(':')[1]);
  } else if (target === 'cold:scrap') {
    scrapAssembly(state);
  } else if (target.startsWith('cold:')) {
    addIngredient(state, target.split(':')[1]);
  } else if (target === 'board:action') {
    if (state.assembly.readyToPlateOrderId) plateCurrentDish(state);
    else if (state.assembly.items.length > 0 && !state.assembly.matchedOrderId) scrapAssembly(state);
  } else if (target === 'pass:bell') {
    servePlate(state, 0);
  } else if (target.startsWith('pass:')) {
    const idx = Number(target.split(':')[1]);
    if (state.servingPass[idx]) servePlate(state, idx);
    else if (state.servingPass.length > 0) servePlate(state, 0);
  }
}

function handleKeyDown(event) {
  sound.unlock();
  const key = event.key;

  // Built-in Showcase / Demo state shortcut (Shift+D)
  if (event.shiftKey && (key === 'D' || key === 'd')) {
    event.preventDefault();
    applyShowcaseState(state, 'rush');
    return;
  }

  if (key === 'm' || key === 'M') {
    sound.toggleMute();
    return;
  }
  if (key === 'r' || key === 'R') {
    resetShift(state.seed);
    return;
  }
  if (key === 'p' || key === 'P') {
    if (state.phase === 'playing') state.phase = 'paused';
    else if (state.phase === 'paused') state.phase = 'playing';
    return;
  }
  if (state.phase !== 'playing') return;

  if (KEY_TO_INGREDIENT[key]) {
    event.preventDefault();
    addIngredient(state, KEY_TO_INGREDIENT[key]);
    return;
  }
  if (key === 'Tab') {
    event.preventDefault();
    cycleSelectedOrder(state);
    return;
  }
  if (key === ' ') {
    event.preventDefault();
    if (state.assembly.readyToPlateOrderId) plateCurrentDish(state);
    else if (state.servingPass.length > 0) servePlate(state, 0);
    return;
  }
  if (key === 'Enter' || key === 's' || key === 'S') {
    event.preventDefault();
    servePlate(state, 0);
    return;
  }
  if (key === 'x' || key === 'X' || key === 'Backspace' || key === 'Escape') {
    event.preventDefault();
    scrapAssembly(state);
  }
}

canvas.addEventListener('pointermove', handlePointerMove);
canvas.addEventListener('pointerdown', handlePointerDown);
window.addEventListener('keydown', handleKeyDown);

// Fixed-timestep simulation loop (freezes progression when opened with ?shot= for crisp deterministic captures)
const frozenShot = Boolean(shotPreset);
let lastFrameMs = null;
let accumulator = 0;

function frame(nowMs) {
  if (!frozenShot) {
    if (lastFrameMs === null) lastFrameMs = nowMs;
    const rawDt = Math.min(0.1, (nowMs - lastFrameMs) / 1000);
    lastFrameMs = nowMs;
    accumulator += rawDt;
    while (accumulator >= FIXED_DT) {
      stepKitchen(state, FIXED_DT);
      accumulator -= FIXED_DT;
    }
  }
  renderKitchen(ctx, state, ui);
  window.requestAnimationFrame(frame);
}

// Expose clean deterministic API for automated verification & play-testing
window.__EMBER_OAK__ = {
  getState: () => state,
  stepTicks: (count = 1) => {
    for (let i = 0; i < count; i++) stepKitchen(state, FIXED_DT);
    renderKitchen(ctx, state, ui);
  },
  applyShowcase: (preset = 'rush') => {
    applyShowcaseState(state, preset);
    renderKitchen(ctx, state, ui);
  },
  reset: (seed = initialSeed) => {
    resetShift(seed);
    renderKitchen(ctx, state, ui);
  },
};

renderKitchen(ctx, state, ui);
window.requestAnimationFrame(frame);
