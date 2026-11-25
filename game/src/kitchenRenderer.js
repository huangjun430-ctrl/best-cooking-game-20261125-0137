// Full 1280x800 2D Canvas kitchen scene renderer for Ember & Oak Kitchen.
// Renders the tiled backsplash, hanging copper cookware, top Order Ticket Rail,
// hot sizzle stations, oak prep counter with distinct ingredients, mid-assembly
// cutting board, brass serving pass with glowing ready plates, HUD, and Game Over card.

import { clamp } from './prng.js';
import { INGREDIENTS, COLD_INGREDIENT_IDS, HOT_INGREDIENT_IDS } from './recipes.js';
import { getActiveOrder, getExpectedNextIngredient } from './kitchenState.js';
import {
  STAGE_W,
  STAGE_H,
  HEADER_H,
  ORDER_RAIL_Y,
  ORDER_RAIL_H,
  STOVE_Y,
  STOVE_H,
  COUNTER_Y,
  COUNTER_H,
  FOOTER_Y,
  FOOTER_H,
  HUD_BUTTONS,
  TICKET_SLOTS,
  HOT_STATION_RECTS,
  PREP_ZONE_RECT,
  BOARD_ZONE_RECT,
  PASS_ZONE_RECT,
  COLD_TRAY_RECTS,
  BOARD_ACTION_RECT,
  PASS_PLATE_SLOTS,
  SERVICE_BELL_RECT,
  GAMEOVER_CARD_RECT,
  GAMEOVER_RESTART_RECT,
} from './layout.js';
import {
  drawRoundedRect,
  drawIngredientSprite,
  drawMidAssemblyStack,
  drawFinishedPlate,
} from './foodSprites.js';

function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function renderKitchen(ctx, state, ui = {}) {
  ctx.save();

  // Subtle deterministic micro-shake on wrong ingredient or expired ticket
  if (state.screenShake > 0.1) {
    const sx = Math.sin(state.tick * 1.7) * state.screenShake;
    const sy = Math.cos(state.tick * 2.1) * state.screenShake * 0.6;
    ctx.translate(sx, sy);
  }

  drawKitchenBackdrop(ctx, state);
  drawHeaderHud(ctx, state, ui);
  drawOrderTicketRail(ctx, state, ui);
  drawHotStoveLine(ctx, state, ui);
  drawOakCounterBase(ctx);
  drawColdPrepCounter(ctx, state, ui);
  drawCuttingAssemblyBoard(ctx, state, ui);
  drawServingPassCounter(ctx, state, ui);
  drawParticlesAndPopups(ctx, state);
  drawFooterLegend(ctx, state);

  // Brief impact tint flash
  if (state.flashAlpha > 0.01 && state.flashTint) {
    ctx.save();
    ctx.globalAlpha = state.flashAlpha;
    ctx.fillStyle = state.flashTint;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    ctx.restore();
  }

  // Heartbeat crimson edge vignette in final 12 seconds of shift
  if (state.phase === 'playing' && state.timeRemaining <= 12) {
    const pulse = 0.18 + 0.14 * Math.sin(state.elapsed * 9);
    const vig = ctx.createRadialGradient(STAGE_W * 0.5, STAGE_H * 0.5, 360, STAGE_W * 0.5, STAGE_H * 0.5, 760);
    vig.addColorStop(0, 'rgba(220, 42, 34, 0)');
    vig.addColorStop(1, `rgba(210, 38, 30, ${pulse})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  }

  if (state.phase === 'paused') {
    drawPauseBanner(ctx);
  } else if (state.phase === 'gameover') {
    drawGameOverCard(ctx, state, ui);
  }

  ctx.restore();
}

function drawKitchenBackdrop(ctx, state) {
  // Warm ceramic subway-tiled bistro wall behind the Order Rail
  const wallGrad = ctx.createLinearGradient(0, ORDER_RAIL_Y, 0, STOVE_Y);
  wallGrad.addColorStop(0, '#f5e6cf');
  wallGrad.addColorStop(1, '#e6cfa9');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, ORDER_RAIL_Y, STAGE_W, ORDER_RAIL_H);

  // Crisp subway tile grout lines with subtle alternating warm cream/terracotta accents
  const tileW = 64;
  const tileH = 28;
  ctx.lineWidth = 1.2;
  for (let row = 0; row * tileH < ORDER_RAIL_H; row++) {
    const y = ORDER_RAIL_Y + row * tileH;
    const offset = row % 2 === 0 ? 0 : tileW * 0.5;
    for (let x = -offset; x < STAGE_W; x += tileW) {
      const shade = (row + Math.floor((x + 64) / tileW)) % 5 === 0 ? '#eed5b2' : '#f7ead6';
      ctx.fillStyle = shade;
      ctx.fillRect(x + 1, y + 1, tileW - 2, tileH - 2);
      ctx.strokeStyle = 'rgba(155, 118, 78, 0.24)';
      ctx.strokeRect(x, y, tileW, tileH);
    }
  }

  // Hanging copper pots & kitchen silhouette accents on left/right margins
  drawCopperHangingDecor(ctx, 18, ORDER_RAIL_Y + 26);
  drawCopperHangingDecor(ctx, STAGE_W - 18, ORDER_RAIL_Y + 26);

  // Soft warm brass pendant light cones over the order rail
  for (const cx of [220, 640, 1060]) {
    const cone = ctx.createRadialGradient(cx, ORDER_RAIL_Y, 8, cx, ORDER_RAIL_Y + 60, 210);
    cone.addColorStop(0, 'rgba(255, 226, 156, 0.34)');
    cone.addColorStop(1, 'rgba(255, 226, 156, 0)');
    ctx.fillStyle = cone;
    ctx.fillRect(cx - 210, ORDER_RAIL_Y, 420, ORDER_RAIL_H);
  }

  // Subtle animated shimmer on stainless backsplash separator
  const railMetal = ctx.createLinearGradient(0, STOVE_Y - 12, 0, STOVE_Y + 6);
  railMetal.addColorStop(0, '#a69a8c');
  railMetal.addColorStop(0.5, '#e8dfd2');
  railMetal.addColorStop(1, '#585049');
  ctx.fillStyle = railMetal;
  ctx.fillRect(0, STOVE_Y - 8, STAGE_W, 10);
  void state;
}

function drawCopperHangingDecor(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = '#9c5a2d';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + 36);
  ctx.stroke();

  const pan = ctx.createRadialGradient(x - 3, y + 48, 2, x, y + 50, 14);
  pan.addColorStop(0, '#f3ae76');
  pan.addColorStop(0.65, '#c46c35');
  pan.addColorStop(1, '#783815');
  ctx.fillStyle = pan;
  ctx.beginPath();
  ctx.arc(x, y + 50, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHeaderHud(ctx, state, ui) {
  // Espresso wood & brushed brass top header bar
  const barGrad = ctx.createLinearGradient(0, 0, 0, HEADER_H);
  barGrad.addColorStop(0, '#2c1911');
  barGrad.addColorStop(1, '#1d100a');
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, STAGE_W, HEADER_H);

  ctx.fillStyle = '#c8923c';
  ctx.fillRect(0, HEADER_H - 3, STAGE_W, 3);

  // Brand emblem (left)
  ctx.save();
  ctx.fillStyle = '#f8c967';
  ctx.beginPath();
  ctx.arc(34, 30, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a160e';
  ctx.font = '800 17px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('E', 34, 31);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff3d6';
  ctx.font = '800 20px "Georgia", "Times New Roman", serif';
  ctx.fillText('EMBER & OAK', 58, 22);

  // Wave badge
  const waveColors = ['#4ea864', '#e39c2b', '#e05a33', '#d63333'];
  const waveColor = waveColors[(state.wave - 1) % waveColors.length];
  drawRoundedRect(ctx, 58, 34, 152, 18, 9);
  ctx.fillStyle = waveColor;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 10.5px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`WAVE ${state.wave} · ${state.waveLabel}`, 68, 43.5);
  ctx.restore();

  // Prominent Center Brass Countdown Timer
  const timerRatio = clamp(state.timeRemaining / state.shiftDuration, 0, 1);
  const urgent = state.timeRemaining <= 15 && state.phase === 'playing';
  const pulseScale = urgent ? 1 + 0.045 * Math.sin(state.elapsed * 12) : 1;

  ctx.save();
  ctx.translate(640, 30);
  ctx.scale(pulseScale, pulseScale);

  drawRoundedRect(ctx, -118, -22, 236, 44, 22);
  const timerBg = ctx.createLinearGradient(0, -22, 0, 22);
  timerBg.addColorStop(0, urgent ? '#6e1917' : '#3a2216');
  timerBg.addColorStop(1, urgent ? '#420d0c' : '#24140c');
  ctx.fillStyle = timerBg;
  ctx.fill();
  ctx.strokeStyle = urgent ? '#ff594f' : '#e5b24d';
  ctx.lineWidth = 2.6;
  ctx.stroke();

  // Circular clock urgency ring
  const ringX = -92;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(ringX, 0, 13, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = timerRatio > 0.45 ? '#5fd47b' : timerRatio > 0.2 ? '#ffbe42' : '#ff5247';
  ctx.beginPath();
  ctx.arc(ringX, 0, 13, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * timerRatio);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = urgent ? '#ff9d96' : '#d8b98a';
  ctx.font = '800 9.5px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('SHIFT', -70, -6);
  ctx.fillText('TIMER', -70, 6);

  ctx.fillStyle = '#fff9ec';
  ctx.font = '900 27px "Consolas", "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(formatClock(state.timeRemaining), 36, 1);
  ctx.restore();

  // Score, Streak Combo Badge & Served Count (right-center)
  ctx.save();
  ctx.textBaseline = 'middle';

  // Score box
  drawRoundedRect(ctx, 784, 10, 114, 40, 10);
  ctx.fillStyle = 'rgba(255, 238, 200, 0.1)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(229, 178, 77, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#d6b47e';
  ctx.font = '700 9.5px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SCORE', 841, 20);
  ctx.fillStyle = '#fff5db';
  ctx.font = '800 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(state.score.toLocaleString('en-US'), 841, 38);

  // Streak Combo Pill
  const mult = Math.min(5, 1 + Math.floor(Math.max(0, state.streak - 1) / 2));
  const hotStreak = state.streak >= 2;
  drawRoundedRect(ctx, 906, 10, 96, 40, 10);
  const streakGrad = ctx.createLinearGradient(906, 10, 1002, 50);
  if (hotStreak) {
    streakGrad.addColorStop(0, '#f39c12');
    streakGrad.addColorStop(1, '#d35400');
  } else {
    streakGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
    streakGrad.addColorStop(1, 'rgba(255,255,255,0.04)');
  }
  ctx.fillStyle = streakGrad;
  ctx.fill();
  ctx.strokeStyle = hotStreak ? '#ffe082' : 'rgba(229, 178, 77, 0.35)';
  ctx.lineWidth = hotStreak ? 1.8 : 1.2;
  ctx.stroke();

  ctx.fillStyle = hotStreak ? '#fff7d6' : '#c9aa80';
  ctx.font = '700 9.5px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`STREAK ${state.streak}`, 954, 20);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 17px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`x${mult} COMBO`, 954, 38);

  // Served counter pill
  drawRoundedRect(ctx, 1010, 10, 74, 40, 10);
  ctx.fillStyle = 'rgba(255, 238, 200, 0.1)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(229, 178, 77, 0.38)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#d6b47e';
  ctx.font = '700 9.5px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('SERVED', 1047, 20);
  ctx.fillStyle = '#9be89d';
  ctx.font = '800 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(String(state.servedCount), 1047, 38);
  ctx.restore();

  // Utility HUD buttons: Sound Mute, Rush Demo, Restart
  drawHudButton(ctx, HUD_BUTTONS.mute, state.sound?.isMuted() ? 'SFX×' : 'SFX', ui.hoverKey === 'hud:mute');
  drawHudButton(ctx, HUD_BUTTONS.demo, 'RUSH', ui.hoverKey === 'hud:demo');
  drawHudButton(ctx, HUD_BUTTONS.restart, '↻ R', ui.hoverKey === 'hud:restart');
}

function drawHudButton(ctx, rect, label, hovered) {
  ctx.save();
  drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fillStyle = hovered ? '#5c3823' : '#3a2216';
  ctx.fill();
  ctx.strokeStyle = hovered ? '#ffd478' : '#b7853b';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = '#fff1d1';
  ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w * 0.5, rect.y + rect.h * 0.5 + 0.5);
  ctx.restore();
}

function drawOrderTicketRail(ctx, state, ui) {
  // Brushed steel ticket grabber rail bar across top of wall
  const railGrad = ctx.createLinearGradient(0, ORDER_RAIL_Y + 6, 0, ORDER_RAIL_Y + 20);
  railGrad.addColorStop(0, '#c6bfb7');
  railGrad.addColorStop(0.5, '#f2ede6');
  railGrad.addColorStop(1, '#7a726a');
  ctx.fillStyle = railGrad;
  ctx.fillRect(28, ORDER_RAIL_Y + 8, STAGE_W - 56, 13);
  ctx.strokeStyle = '#4e4740';
  ctx.lineWidth = 1;
  ctx.strokeRect(28, ORDER_RAIL_Y + 8, STAGE_W - 56, 13);

  const activeOrder = getActiveOrder(state);

  for (let i = 0; i < TICKET_SLOTS.length; i++) {
    const slot = TICKET_SLOTS[i];
    const order = state.orders[i];
    if (!order) {
      // Subtle empty clip placeholder
      ctx.save();
      ctx.setLineDash([6, 6]);
      drawRoundedRect(ctx, slot.x, slot.y + 8, slot.w, slot.h - 14, 10);
      ctx.strokeStyle = 'rgba(130, 96, 60, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      continue;
    }

    const isSelected = activeOrder && activeOrder.id === order.id;
    const isMatched = state.assembly.matchedOrderId === order.id;
    const hovered = ui.hoverKey === `ticket:${i}`;
    const ratio = clamp(order.timeLeft / Math.max(1, order.maxTime), 0, 1);

    ctx.save();
    const slideOffset = (1 - order.enterAnim) * -28;
    ctx.translate(0, slideOffset);

    // Paper ticket drop shadow
    ctx.fillStyle = isSelected ? 'rgba(196, 124, 24, 0.34)' : 'rgba(42, 24, 10, 0.24)';
    drawRoundedRect(ctx, slot.x + 3, slot.y + 6, slot.w, slot.h, 10);
    ctx.fill();

    // Ticket body
    const paperGrad = ctx.createLinearGradient(slot.x, slot.y, slot.x, slot.y + slot.h);
    paperGrad.addColorStop(0, order.isVip ? '#fff9e6' : '#fffdf8');
    paperGrad.addColorStop(1, order.isVip ? '#f9ebc2' : '#f4ebdc');
    drawRoundedRect(ctx, slot.x, slot.y, slot.w, slot.h, 10);
    ctx.fillStyle = paperGrad;
    ctx.fill();

    // Active / VIP border highlight
    ctx.strokeStyle = isSelected ? '#e69b1e' : order.isVip ? '#d4a017' : hovered ? '#b88346' : '#cbb99e';
    ctx.lineWidth = isSelected ? 3.2 : 1.8;
    ctx.stroke();

    // Top steel binder clip nub
    drawRoundedRect(ctx, slot.x + slot.w * 0.5 - 24, slot.y - 7, 48, 12, 4);
    ctx.fillStyle = isSelected ? '#e89d22' : '#7b736b';
    ctx.fill();

    // Ticket Header Strip: Dish Name + Table/VIP tag
    ctx.fillStyle = '#2d1a10';
    ctx.font = '800 15.5px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(order.recipe.name, slot.x + 12, slot.y + 22);

    // Table badge + VIP star
    const tagText = order.isVip ? `★ VIP · ${order.customerTag}` : order.customerTag;
    ctx.font = '800 10.5px "Segoe UI", system-ui, sans-serif';
    const tagW = order.isVip ? 88 : 48;
    drawRoundedRect(ctx, slot.x + slot.w - tagW - 10, slot.y + 11, tagW, 20, 6);
    ctx.fillStyle = order.isVip ? '#d98a12' : '#574232';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(tagText, slot.x + slot.w - tagW * 0.5 - 10, slot.y + 21.5);

    // Countdown progress bar
    const barX = slot.x + 12;
    const barY = slot.y + 39;
    const barW = slot.w - 24;
    const barH = 11;
    drawRoundedRect(ctx, barX, barY, barW, barH, 5.5);
    ctx.fillStyle = '#dfd3be';
    ctx.fill();

    const barColor = ratio > 0.5 ? '#3da85b' : ratio > 0.25 ? '#ee9b1e' : '#de3c32';
    if (ratio > 0.01) {
      drawRoundedRect(ctx, barX, barY, Math.max(10, barW * ratio), barH, 5.5);
      ctx.fillStyle = barColor;
      ctx.fill();
    }

    // Remaining seconds label right on bar edge
    ctx.fillStyle = ratio < 0.25 ? '#b3221a' : '#5c4632';
    ctx.font = '700 10.5px "Consolas", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(order.timeLeft)}s`, slot.x + slot.w - 12, slot.y + 62);

    ctx.fillStyle = isSelected ? '#b86a0c' : '#7b644d';
    ctx.font = '700 10.5px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(isSelected ? 'ACTIVE TICKET' : `ORDER #${order.id}`, slot.x + 12, slot.y + 62);

    // Ingredient sequence icons with checkmarks for assembled steps & highlight for next step
    const steps = order.recipe.steps;
    const count = steps.length;
    const spacing = Math.min(52, (slot.w - 26) / count);
    const startX = slot.x + slot.w * 0.5 - ((count - 1) * spacing) * 0.5;
    const iconY = slot.y + 101;
    const completedCount = isMatched ? state.assembly.items.length : 0;

    for (let s = 0; s < count; s++) {
      const ingId = steps[s];
      const spec = INGREDIENTS[ingId];
      const ix = startX + s * spacing;
      const done = isMatched && s < completedCount;
      const isNext = isSelected && isMatched && s === completedCount;

      // Connector arrow between steps
      if (s < count - 1) {
        ctx.strokeStyle = done ? '#3da85b' : '#c7b59a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ix + 18, iconY);
        ctx.lineTo(ix + spacing - 18, iconY);
        ctx.stroke();
      }

      // Bubble backdrop
      ctx.beginPath();
      ctx.arc(ix, iconY, 21, 0, Math.PI * 2);
      ctx.fillStyle = done ? '#dff5e2' : isNext ? '#fff3c4' : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = done ? '#3da85b' : isNext ? '#e59514' : '#d5c5ab';
      ctx.lineWidth = isNext ? 2.8 : 1.5;
      ctx.stroke();

      // Food sprite inside bubble
      drawIngredientSprite(ctx, ingId, ix, iconY - 1, 15, { shadow: false });

      // Key badge below bubble
      drawRoundedRect(ctx, ix - 9, iconY + 15, 18, 14, 4);
      ctx.fillStyle = done ? '#3da85b' : isNext ? '#d97706' : '#4a3525';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 9.5px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(done ? '✓' : spec.key, ix, iconY + 22.5);
    }

    ctx.restore();
  }
}

function drawHotStoveLine(ctx, state, ui) {
  // Dark forged slate stove range across the mid-kitchen
  const stoveGrad = ctx.createLinearGradient(0, STOVE_Y, 0, STOVE_Y + STOVE_H);
  stoveGrad.addColorStop(0, '#302c2a');
  stoveGrad.addColorStop(0.15, '#262321');
  stoveGrad.addColorStop(1, '#1c1918');
  ctx.fillStyle = stoveGrad;
  ctx.fillRect(0, STOVE_Y, STAGE_W, STOVE_H);

  // Subtle brushed metal trim rails
  ctx.fillStyle = '#47413d';
  ctx.fillRect(0, STOVE_Y + STOVE_H - 4, STAGE_W, 4);

  const nextId = getExpectedNextIngredient(state);

  for (const id of HOT_INGREDIENT_IDS) {
    const rect = HOT_STATION_RECTS[id];
    const spec = INGREDIENTS[id];
    const st = state.stations[id];
    const hovered = ui.hoverKey === `hot:${id}`;
    const isNeededNext = nextId === id;

    ctx.save();
    // Station recessed cooking bay
    drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);
    ctx.fillStyle = hovered ? '#352f2c' : '#2b2624';
    ctx.fill();
    ctx.strokeStyle = isNeededNext ? '#ffba3b' : hovered ? '#d49a56' : '#4e4641';
    ctx.lineWidth = isNeededNext ? 3 : 1.8;
    ctx.stroke();

    // Glowing orange burner aura beneath pan
    const glowIntensity = st.cooking ? 0.35 + 0.12 * Math.sin(state.elapsed * 8) : 0.16;
    const burner = ctx.createRadialGradient(
      rect.x + rect.w * 0.42,
      rect.y + rect.h * 0.56,
      14,
      rect.x + rect.w * 0.42,
      rect.y + rect.h * 0.56,
      98,
    );
    burner.addColorStop(0, `rgba(255, 118, 36, ${glowIntensity})`);
    burner.addColorStop(1, 'rgba(255, 118, 36, 0)');
    ctx.fillStyle = burner;
    ctx.fillRect(rect.x + 8, rect.y + 20, rect.w - 16, rect.h - 28);

    // Header label + keycap badge
    drawRoundedRect(ctx, rect.x + 12, rect.y + 10, 26, 24, 6);
    ctx.fillStyle = isNeededNext ? '#f59e0b' : '#b8532a';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 13.5px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.key, rect.x + 25, rect.y + 22.5);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff2da';
    ctx.font = '800 14.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(spec.name.toUpperCase(), rect.x + 46, rect.y + 18);
    ctx.fillStyle = '#bda994';
    ctx.font = '600 10.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(spec.stationTitle, rect.x + 46, rect.y + 32);

    // Ready stock badge (top-right)
    const readyPillW = 92;
    drawRoundedRect(ctx, rect.x + rect.w - readyPillW - 12, rect.y + 11, readyPillW, 22, 11);
    ctx.fillStyle = st.readyCount > 0 ? '#2f854b' : '#8c441c';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      st.readyCount > 0 ? `READY ×${st.readyCount}` : 'SEARING...',
      rect.x + rect.w - readyPillW * 0.5 - 12,
      rect.y + 22.5,
    );

    // Draw distinctive kitchen equipment per station
    const panCx = rect.x + 148;
    const panCy = rect.y + 98;
    if (id === 'patty') {
      // Heavy cast-iron ribbed griddle plate
      drawRoundedRect(ctx, rect.x + 26, rect.y + 52, 232, 92, 12);
      ctx.fillStyle = '#1b1817';
      ctx.fill();
      ctx.strokeStyle = '#57504b';
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.strokeStyle = '#2d2825';
      ctx.lineWidth = 3;
      for (let gx = rect.x + 44; gx < rect.x + 244; gx += 18) {
        ctx.beginPath();
        ctx.moveTo(gx, rect.y + 60);
        ctx.lineTo(gx, rect.y + 136);
        ctx.stroke();
      }
      // Show ready patties on left/right of griddle
      if (st.readyCount >= 1) drawIngredientSprite(ctx, 'patty', rect.x + 90, panCy, 32);
      if (st.readyCount >= 2) drawIngredientSprite(ctx, 'patty', rect.x + 190, panCy, 32);
      else if (st.cooking) {
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.45 * st.cookProgress;
        drawIngredientSprite(ctx, 'patty', rect.x + (st.readyCount === 0 ? 90 : 190), panCy, 28);
        ctx.restore();
      }
    } else if (id === 'egg') {
      // Hammered copper skillet + brass handle
      ctx.strokeStyle = '#d49a4a';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(panCx + 76, panCy);
      ctx.lineTo(panCx + 114, panCy - 8);
      ctx.stroke();

      const rim = ctx.createRadialGradient(panCx - 16, panCy - 16, 12, panCx, panCy, 92);
      rim.addColorStop(0, '#443c38');
      rim.addColorStop(0.84, '#241f1d');
      rim.addColorStop(0.92, '#d98143');
      rim.addColorStop(1, '#8c441c');
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.ellipse(panCx, panCy, 94, 46, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e89d58';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      if (st.readyCount >= 1) drawIngredientSprite(ctx, 'egg', panCx - 30, panCy, 30);
      if (st.readyCount >= 2) drawIngredientSprite(ctx, 'egg', panCx + 34, panCy + 2, 30);
      else if (st.cooking) {
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.45 * st.cookProgress;
        drawIngredientSprite(ctx, 'egg', panCx + (st.readyCount === 0 ? -24 : 34), panCy + 2, 27);
        ctx.restore();
      }
    } else {
      // Brass oil fryer vat & wire basket
      drawRoundedRect(ctx, rect.x + 26, rect.y + 52, 232, 92, 12);
      const oilGrad = ctx.createLinearGradient(0, rect.y + 52, 0, rect.y + 144);
      oilGrad.addColorStop(0, '#c27b19');
      oilGrad.addColorStop(1, '#8a4c0b');
      ctx.fillStyle = oilGrad;
      ctx.fill();
      ctx.strokeStyle = '#b7b0a8';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Wire mesh cross-hatch
      ctx.strokeStyle = 'rgba(255, 240, 200, 0.25)';
      ctx.lineWidth = 1;
      for (let fx = rect.x + 42; fx < rect.x + 244; fx += 16) {
        ctx.beginPath();
        ctx.moveTo(fx, rect.y + 56);
        ctx.lineTo(fx, rect.y + 140);
        ctx.stroke();
      }
      // Bubbling oil dots
      ctx.fillStyle = 'rgba(255, 238, 175, 0.48)';
      for (let b = 0; b < 6; b++) {
        const bx = rect.x + 48 + b * 34;
        const by = rect.y + 72 + ((b * 19 + Math.floor(state.elapsed * 14)) % 52);
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      if (st.readyCount >= 1) drawIngredientSprite(ctx, 'fries', rect.x + 92, panCy - 2, 31);
      if (st.readyCount >= 2) drawIngredientSprite(ctx, 'fries', rect.x + 190, panCy - 2, 31);
      else if (st.cooking) {
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.45 * st.cookProgress;
        drawIngredientSprite(ctx, 'fries', rect.x + (st.readyCount === 0 ? 92 : 190), panCy - 2, 27);
        ctx.restore();
      }
    }

    // Soft animated steam curls rising from hot cookware
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 248, 232, 0.24)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    for (let w = 0; w < 3; w++) {
      const wx = rect.x + 86 + w * 62;
      const sway = Math.sin(state.elapsed * 3.2 + w * 1.9 + rect.x * 0.01) * 5;
      ctx.beginPath();
      ctx.moveTo(wx, rect.y + 72);
      ctx.quadraticCurveTo(wx + sway, rect.y + 58, wx - sway * 0.6, rect.y + 44);
      ctx.stroke();
    }
    ctx.restore();

    // Live circular cook gauge on the right side of each hot station
    const gaugeX = rect.x + rect.w - 46;
    const gaugeY = rect.y + 100;
    ctx.beginPath();
    ctx.arc(gaugeX, gaugeY, 26, 0, Math.PI * 2);
    ctx.fillStyle = '#1b1715';
    ctx.fill();
    ctx.strokeStyle = '#47403b';
    ctx.lineWidth = 5;
    ctx.stroke();

    if (st.readyCount >= st.maxReady) {
      ctx.strokeStyle = '#49c66c';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(gaugeX, gaugeY, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#9ef0b2';
      ctx.font = '800 10.5px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('HOT', gaugeX, gaugeY);
    } else {
      ctx.strokeStyle = '#ff9f2e';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(gaugeX, gaugeY, 26, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * st.cookProgress);
      ctx.stroke();
      ctx.fillStyle = '#ffd999';
      ctx.font = '800 11px "Consolas", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(st.cookProgress * 100)}%`, gaugeX, gaugeY);
    }

    ctx.restore();
  }
}

function drawOakCounterBase(ctx) {
  // Rich warm oak butcher-block counter spanning the foreground
  const wood = ctx.createLinearGradient(0, COUNTER_Y, 0, COUNTER_Y + COUNTER_H);
  wood.addColorStop(0, '#c8925a');
  wood.addColorStop(0.06, '#b77d46');
  wood.addColorStop(0.92, '#8f5a2b');
  wood.addColorStop(1, '#683f1d');
  ctx.fillStyle = wood;
  ctx.fillRect(0, COUNTER_Y, STAGE_W, COUNTER_H);

  // Subtle horizontal oak butcher-block plank seams
  ctx.strokeStyle = 'rgba(72, 38, 12, 0.22)';
  ctx.lineWidth = 1.2;
  for (let y = COUNTER_Y + 24; y < COUNTER_Y + COUNTER_H; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(STAGE_W, y);
    ctx.stroke();
  }

  // Top edge bevel specular highlight
  ctx.fillStyle = 'rgba(255, 232, 196, 0.35)';
  ctx.fillRect(0, COUNTER_Y, STAGE_W, 4);
}

function drawColdPrepCounter(ctx, state, ui) {
  const r = PREP_ZONE_RECT;
  // Recessed chilled Carrara marble prep well
  ctx.save();
  drawRoundedRect(ctx, r.x, r.y, r.w, r.h, 14);
  const marble = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  marble.addColorStop(0, '#f3efe8');
  marble.addColorStop(0.5, '#e6e0d6');
  marble.addColorStop(1, '#d8d0c3');
  ctx.fillStyle = marble;
  ctx.fill();
  ctx.strokeStyle = '#7c532d';
  ctx.lineWidth = 2.6;
  ctx.stroke();

  // Subtle marble veining
  ctx.strokeStyle = 'rgba(140, 130, 118, 0.22)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(r.x + 22, r.y + 42);
  ctx.bezierCurveTo(r.x + 140, r.y + 18, r.x + 260, r.y + 72, r.x + 390, r.y + 28);
  ctx.stroke();

  // Zone title header
  ctx.fillStyle = '#3c2516';
  ctx.font = '800 13.5px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('PREP COUNTER · FRESH INGREDIENTS', r.x + 16, r.y + 22);

  ctx.fillStyle = '#7b5f47';
  ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('CLICK OR KEYS 1–5', r.x + r.w - 14, r.y + 22);

  const nextId = getExpectedNextIngredient(state);

  // 5 chilled stainless gastronorm ingredient trays
  for (const id of COLD_INGREDIENT_IDS) {
    const tr = COLD_TRAY_RECTS[id];
    const spec = INGREDIENTS[id];
    const hovered = ui.hoverKey === `cold:${id}`;
    const isNext = nextId === id;

    // Stainless tray rim + shadow
    ctx.fillStyle = 'rgba(42, 28, 16, 0.16)';
    drawRoundedRect(ctx, tr.x + 2, tr.y + 4, tr.w, tr.h, 12);
    ctx.fill();

    drawRoundedRect(ctx, tr.x, tr.y, tr.w, tr.h, 12);
    ctx.fillStyle = isNext ? '#fff5cf' : hovered ? '#ffffff' : spec.bgTint;
    ctx.fill();
    ctx.strokeStyle = isNext ? '#e89611' : hovered ? '#9e7448' : '#b7afa4';
    ctx.lineWidth = isNext ? 3.2 : 1.8;
    ctx.stroke();

    // Pulsing "NEXT" indicator halo
    if (isNext) {
      const p = 0.65 + 0.35 * Math.sin(state.elapsed * 8);
      drawRoundedRect(ctx, tr.x + 3, tr.y + 3, tr.w - 6, tr.h - 6, 9);
      ctx.strokeStyle = `rgba(245, 158, 11, ${p})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Keycap badge (top-left)
    drawRoundedRect(ctx, tr.x + 8, tr.y + 8, 22, 22, 6);
    ctx.fillStyle = isNext ? '#d97706' : '#3d281a';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.key, tr.x + 19, tr.y + 19.5);

    // Oversized readable procedural ingredient sprite
    drawIngredientSprite(ctx, id, tr.x + tr.w * 0.5, tr.y + 56, 33);

    // Ingredient name footer
    ctx.fillStyle = '#2d1a10';
    ctx.font = '800 12.5px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(spec.name, tr.x + tr.w * 0.5, tr.y + tr.h - 15);
  }

  // 6th slot: Scrap / Clear Board stainless bowl ([X])
  const sc = COLD_TRAY_RECTS.scrap;
  const scrapHovered = ui.hoverKey === 'cold:scrap';
  const hasItems = state.assembly.items.length > 0;
  drawRoundedRect(ctx, sc.x, sc.y, sc.w, sc.h, 12);
  ctx.fillStyle = scrapHovered ? '#fce5e2' : '#ebe4da';
  ctx.fill();
  ctx.strokeStyle = scrapHovered ? '#d44b3e' : '#b7afa4';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  drawRoundedRect(ctx, sc.x + 8, sc.y + 8, 22, 22, 6);
  ctx.fillStyle = hasItems ? '#b83c32' : '#7b6d60';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 12px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('X', sc.x + 19, sc.y + 19.5);

  // Drawn scrap bin icon
  ctx.strokeStyle = hasItems ? '#b83c32' : '#7d7064';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(sc.x + sc.w * 0.5, sc.y + 56, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sc.x + sc.w * 0.5 - 10, sc.y + 46);
  ctx.lineTo(sc.x + sc.w * 0.5 + 10, sc.y + 66);
  ctx.moveTo(sc.x + sc.w * 0.5 + 10, sc.y + 46);
  ctx.lineTo(sc.x + sc.w * 0.5 - 10, sc.y + 66);
  ctx.stroke();

  ctx.fillStyle = hasItems ? '#8f2922' : '#6c5f53';
  ctx.font = '800 12.5px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Clear Board', sc.x + sc.w * 0.5, sc.y + sc.h - 15);

  ctx.restore();
}

function drawCuttingAssemblyBoard(ctx, state, ui) {
  const r = BOARD_ZONE_RECT;
  const activeOrder = getActiveOrder(state);
  const shakeX = state.assembly.wrongShake > 0 ? Math.sin(state.tick * 2.5) * state.assembly.wrongShake * 8 : 0;

  ctx.save();
  ctx.translate(shakeX, 0);

  // End-grain artisanal oak butcher block cutting board
  ctx.fillStyle = 'rgba(34, 18, 6, 0.34)';
  drawRoundedRect(ctx, r.x + 4, r.y + 8, r.w, r.h, 16);
  ctx.fill();

  const boardGrad = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  boardGrad.addColorStop(0, '#f0ce99');
  boardGrad.addColorStop(0.5, '#e2b576');
  boardGrad.addColorStop(1, '#c99352');
  drawRoundedRect(ctx, r.x, r.y, r.w, r.h, 16);
  ctx.fillStyle = boardGrad;
  ctx.fill();
  ctx.strokeStyle = state.assembly.wrongShake > 0.1 ? '#dc3c32' : '#7d4d21';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Inner juice groove border
  drawRoundedRect(ctx, r.x + 12, r.y + 12, r.w - 24, r.h - 24, 11);
  ctx.strokeStyle = 'rgba(116, 68, 25, 0.34)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Brass corner rivets
  ctx.fillStyle = '#d4a347';
  for (const [rx, ry] of [
    [r.x + 22, r.y + 22],
    [r.x + r.w - 22, r.y + 22],
    [r.x + 22, r.y + r.h - 22],
    [r.x + r.w - 22, r.y + r.h - 22],
  ]) {
    ctx.beginPath();
    ctx.arc(rx, ry, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Board Header + Current Target Dish Pill
  ctx.fillStyle = '#3d220e';
  ctx.font = '800 13.5px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const stepTotal = activeOrder ? activeOrder.recipe.steps.length : 0;
  const stepDone = state.assembly.items.length;
  const titleLabel = activeOrder
    ? `ASSEMBLY BOARD · ${activeOrder.recipe.name.toUpperCase()} (${stepDone}/${stepTotal})`
    : 'ASSEMBLY BOARD';
  ctx.fillText(titleLabel, r.x + r.w * 0.5, r.y + 28);

  // Chef's forged steel knife resting on the left of the cutting board (animates on chop!)
  ctx.save();
  const chopAngle = -0.18 + state.assembly.knifeChop * 0.42;
  ctx.translate(r.x + 48, r.y + 188);
  ctx.rotate(chopAngle);
  // Steel blade
  const blade = ctx.createLinearGradient(-8, -75, 16, 15);
  blade.addColorStop(0, '#eef2f5');
  blade.addColorStop(0.5, '#c4ccd2');
  blade.addColorStop(1, '#858f96');
  ctx.fillStyle = blade;
  ctx.beginPath();
  ctx.moveTo(-4, 10);
  ctx.lineTo(14, 10);
  ctx.quadraticCurveTo(16, -42, -3, -78);
  ctx.lineTo(-4, 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#576066';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Walnut handle
  drawRoundedRect(ctx, -6, 10, 14, 48, 5);
  ctx.fillStyle = '#3e2313';
  ctx.fill();
  ctx.fillStyle = '#e5be67';
  ctx.beginPath();
  ctx.arc(1, 24, 2, 0, Math.PI * 2);
  ctx.arc(1, 40, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Central parchment prep mat circle
  const cx = r.x + r.w * 0.5 + 10;
  const cy = r.y + 188;
  ctx.fillStyle = 'rgba(255, 249, 236, 0.72)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 16, 102, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(155, 106, 52, 0.35)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Mid-assembly dish stack!
  if (state.assembly.items.length > 0) {
    const ready = Boolean(state.assembly.readyToPlateOrderId);
    drawMidAssemblyStack(ctx, state.assembly.items, cx, cy + 12, 1.48, {
      capWithCrownBun: ready && activeOrder?.recipe.hasCrownBun,
    });
  } else {
    // Helpful empty board prompt
    ctx.fillStyle = 'rgba(92, 54, 22, 0.58)';
    ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Add First Ingredient', cx, cy + 12);
    const nextId = getExpectedNextIngredient(state);
    if (nextId) {
      ctx.save();
      ctx.globalAlpha = 0.42;
      drawIngredientSprite(ctx, nextId, cx, cy - 22, 26, { shadow: false });
      ctx.restore();
    }
  }

  // Next ingredient prompt badge / Plate button at bottom of board
  const nextId = getExpectedNextIngredient(state);
  const readyToPlate = Boolean(state.assembly.readyToPlateOrderId);
  const btn = BOARD_ACTION_RECT;
  const hovered = ui.hoverKey === 'board:action';

  drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 10);
  if (readyToPlate) {
    ctx.fillStyle = hovered ? '#2d9950' : '#257d42';
    ctx.fill();
    ctx.strokeStyle = '#9ef0b2';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 13.5px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PLATE TO PASS [SPACE]', btn.x + btn.w * 0.5, btn.y + btn.h * 0.5 + 0.5);
  } else if (nextId) {
    const spec = INGREDIENTS[nextId];
    ctx.fillStyle = '#3b2313';
    ctx.fill();
    ctx.strokeStyle = '#e5a93c';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.fillStyle = '#ffe5a3';
    ctx.font = '800 13px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`NEXT: [${spec.key}] ${spec.name.toUpperCase()}`, btn.x + btn.w * 0.5, btn.y + btn.h * 0.5 + 0.5);
  } else {
    ctx.fillStyle = 'rgba(59, 35, 19, 0.72)';
    ctx.fill();
    ctx.fillStyle = '#e6d2b5';
    ctx.font = '700 12.5px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PRESS [X] TO CLEAR BOARD', btn.x + btn.w * 0.5, btn.y + btn.h * 0.5 + 0.5);
  }

  ctx.restore();
}

function drawServingPassCounter(ctx, state, ui) {
  const r = PASS_ZONE_RECT;
  ctx.save();

  // Polished dark granite serving pass illuminated by brass heat lamps
  drawRoundedRect(ctx, r.x, r.y, r.w, r.h, 14);
  const granite = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  granite.addColorStop(0, '#362e2b');
  granite.addColorStop(1, '#201a18');
  ctx.fillStyle = granite;
  ctx.fill();
  ctx.strokeStyle = '#d4a347';
  ctx.lineWidth = 2.6;
  ctx.stroke();

  // Warm overhead heat lamp cones
  for (const slot of PASS_PLATE_SLOTS) {
    const lamp = ctx.createRadialGradient(slot.cx, r.y + 10, 6, slot.cx, slot.cy, 128);
    lamp.addColorStop(0, 'rgba(255, 206, 98, 0.32)');
    lamp.addColorStop(1, 'rgba(255, 206, 98, 0)');
    ctx.fillStyle = lamp;
    ctx.fillRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8);
  }

  // Brass heat lamp hood bar
  ctx.fillStyle = '#d9a441';
  ctx.fillRect(r.x + 16, r.y + 3, r.w - 32, 6);

  ctx.fillStyle = '#ffe5a3';
  ctx.font = '800 13.5px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('SERVING PASS · READY PLATES', r.x + 16, r.y + 26);

  ctx.fillStyle = state.servingPass.length > 0 ? '#7ae582' : '#baa791';
  ctx.font = '800 11px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(
    state.servingPass.length > 0 ? `${state.servingPass.length} READY TO SERVE!` : 'HEAT LAMPS WARM',
    r.x + r.w - 14,
    r.y + 26,
  );

  // Two porcelain serving pads
  for (let i = 0; i < PASS_PLATE_SLOTS.length; i++) {
    const slot = PASS_PLATE_SLOTS[i];
    const plate = state.servingPass[i];
    const hovered = ui.hoverKey === `pass:${i}`;

    // Engraved granite pad ring
    ctx.beginPath();
    ctx.ellipse(slot.cx, slot.cy + 14, 72, 34, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 232, 180, 0.06)';
    ctx.fill();
    ctx.strokeStyle = plate
      ? hovered
        ? '#fff2b2'
        : '#f2be4c'
      : 'rgba(220, 195, 160, 0.22)';
    ctx.lineWidth = plate ? 2.4 : 1.5;
    ctx.stroke();

    if (plate) {
      const bounceScale = 1 + plate.bounce * 0.12;
      drawFinishedPlate(ctx, plate.recipe, slot.cx, slot.cy + 2, 1.04 * bounceScale, plate.glowPhase);

      // Dish badge right above ready plate
      drawRoundedRect(ctx, slot.cx - 66, slot.cy - 80, 132, 24, 12);
      ctx.fillStyle = plate.isVip ? '#d98a12' : '#2f854b';
      ctx.fill();
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`READY · ${plate.recipe.name}`, slot.cx, slot.cy - 67.5);
    } else {
      ctx.fillStyle = 'rgba(210, 190, 165, 0.36)';
      ctx.font = '700 11.5px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`PASS PAD ${i + 1}`, slot.cx, slot.cy + 14);
    }
  }

  // Interactive Brass Service Bell button
  const bell = SERVICE_BELL_RECT;
  const bellHovered = ui.hoverKey === 'pass:bell';
  const hasReady = state.servingPass.length > 0;
  const bounceY = -state.bellBounce * 6;

  ctx.save();
  ctx.translate(0, bounceY);
  drawRoundedRect(ctx, bell.x, bell.y, bell.w, bell.h, 14);
  const bellGrad = ctx.createLinearGradient(bell.x, bell.y, bell.x, bell.y + bell.h);
  if (hasReady) {
    bellGrad.addColorStop(0, bellHovered ? '#ffdc70' : '#f7c143');
    bellGrad.addColorStop(1, '#c77c12');
  } else {
    bellGrad.addColorStop(0, '#5a4e47');
    bellGrad.addColorStop(1, '#3d3430');
  }
  ctx.fillStyle = bellGrad;
  ctx.fill();
  ctx.strokeStyle = hasReady ? '#fff4c2' : '#7b6d63';
  ctx.lineWidth = hasReady ? 2.4 : 1.4;
  ctx.stroke();

  // Mini brass bell dome graphic on left of button
  const bx = bell.x + 30;
  const by = bell.y + 34;
  ctx.fillStyle = hasReady ? '#fff2b2' : '#a89a8c';
  ctx.beginPath();
  ctx.arc(bx, by, 13, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(bx - 16, by, 32, 4);
  ctx.beginPath();
  ctx.arc(bx, by - 14, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = hasReady ? '#291507' : '#d5c7b8';
  ctx.font = '900 15px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('SERVE [ENTER]', bell.x + 56, bell.y + 28);
  ctx.restore();

  ctx.restore();
}

function drawParticlesAndPopups(ctx, state) {
  // Particles (steam wisps, sear sparks, herb crumbs, celebration stars)
  for (const pt of state.particles) {
    const alpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = pt.kind === 'steam' ? alpha * 0.45 : alpha;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * (pt.kind === 'steam' ? 1.5 - alpha * 0.5 : alpha * 0.8 + 0.3), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Crisp floating score & combo popups
  for (const pop of state.popups) {
    const alpha = clamp(pop.life / (pop.maxLife * 0.45), 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `900 ${Math.round(17 * pop.scale)}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = 'rgba(26, 12, 4, 0.85)';
    ctx.strokeText(pop.text, pop.x, pop.y);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, pop.x, pop.y);
    ctx.restore();
  }
}

function drawFooterLegend(ctx, state) {
  ctx.fillStyle = '#20130c';
  ctx.fillRect(0, FOOTER_Y, STAGE_W, FOOTER_H);
  ctx.fillStyle = '#b7853b';
  ctx.fillRect(0, FOOTER_Y, STAGE_W, 2);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffe5a3';
  ctx.font = '700 12.5px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(state.statusTip, 20, FOOTER_Y + 21);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#c4ae92';
  ctx.font = '600 11.5px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('[1-5] Cold  ·  [6-8] Grill/Fry  ·  [TAB] Switch  ·  [ENTER] Serve  ·  [X] Clear  ·  [R] Restart', STAGE_W - 20, FOOTER_Y + 21);
}

function drawPauseBanner(ctx) {
  ctx.save();
  drawRoundedRect(ctx, 490, 316, 300, 96, 16);
  ctx.fillStyle = 'rgba(26, 14, 8, 0.92)';
  ctx.fill();
  ctx.strokeStyle = '#f0b849';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#fff5db';
  ctx.font = '900 24px "Georgia", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SERVICE PAUSED', 640, 352);
  ctx.fillStyle = '#e2c598';
  ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Press [P] to resume cooking', 640, 384);
  ctx.restore();
}

function drawGameOverCard(ctx, state, ui) {
  // Compact, elegant brass-framed modal centered over the lower board zone so
  // the top Order Board, Timer (00:00), Hot Stove, Prep Ingredients, and Ready Plate remain clearly visible!
  const card = GAMEOVER_CARD_RECT;
  ctx.save();

  ctx.fillStyle = 'rgba(18, 9, 4, 0.45)';
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);

  // Re-highlight top order rail & serving pass glow lightly? No need—0.45 scrim keeps everything bright & legible!
  drawRoundedRect(ctx, card.x, card.y, card.w, card.h, 18);
  const bg = ctx.createLinearGradient(card.x, card.y, card.x, card.y + card.h);
  bg.addColorStop(0, '#2e1a10');
  bg.addColorStop(1, '#1b0f09');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = '#f0b849';
  ctx.lineWidth = 3;
  ctx.stroke();

  const cx = card.x + card.w * 0.5;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#f8c967';
  ctx.font = '800 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('EMBER & OAK KITCHEN', cx, card.y + 28);

  ctx.fillStyle = '#fff8e7';
  ctx.font = '900 28px "Georgia", serif';
  ctx.fillText('SHIFT COMPLETE!', cx, card.y + 58);

  // Star rating based on score
  const stars = state.score >= 2200 ? 3 : state.score >= 1100 ? 2 : 1;
  ctx.fillStyle = '#ffd54f';
  ctx.font = '900 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('★'.repeat(stars) + '☆'.repeat(3 - stars), cx, card.y + 92);

  // 2x2 crisp stats grid
  const stats = [
    ['FINAL SCORE', state.score.toLocaleString('en-US')],
    ['DISHES SERVED', String(state.servedCount)],
    ['BEST STREAK', `×${state.maxStreak}`],
    ['MISTAKES', String(state.mistakes)],
  ];
  for (let i = 0; i < stats.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const bx = card.x + 24 + col * 170;
    const by = card.y + 114 + row * 50;
    drawRoundedRect(ctx, bx, by, 158, 42, 9);
    ctx.fillStyle = 'rgba(255, 236, 198, 0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(229, 178, 77, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#d4b483';
    ctx.font = '700 9.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(stats[i][0], bx + 79, by + 13);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 16px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(stats[i][1], bx + 79, by + 30);
  }

  // Instant Restart button
  const btn = GAMEOVER_RESTART_RECT;
  const hovered = ui.hoverKey === 'gameover:restart';
  drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 12);
  const btnGrad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h);
  btnGrad.addColorStop(0, hovered ? '#ffda6b' : '#f2b838');
  btnGrad.addColorStop(1, '#c97c10');
  ctx.fillStyle = btnGrad;
  ctx.fill();
  ctx.strokeStyle = '#fff3c4';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#291507';
  ctx.font = '900 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('PLAY AGAIN [R]', btn.x + btn.w * 0.5, btn.y + btn.h * 0.5 + 1);

  ctx.restore();
}
