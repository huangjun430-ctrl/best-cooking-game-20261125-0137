// High-craft procedural 2D Canvas food sprites for Ember & Oak Kitchen.
// Every ingredient, mid-assembly stack layer, and finished porcelain plate is drawn
// mathematically via Canvas paths, gradients, and highlights (zero external images).

import { easeOutBack } from './prng.js';

export function drawRoundedRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function drawIngredientSprite(ctx, id, cx, cy, radius, opts = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  const s = radius / 32;
  ctx.scale(s, s);

  if (opts.shadow !== false) {
    ctx.fillStyle = 'rgba(34, 18, 8, 0.24)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 25, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  switch (id) {
    case 'bun':
      drawBriocheBun(ctx, opts.crownOnly ? 'crown' : opts.baseOnly ? 'base' : 'full');
      break;
    case 'lettuce':
      drawOakLettuce(ctx);
      break;
    case 'tomato':
      drawRubyTomato(ctx);
      break;
    case 'cheddar':
      drawAgedCheddar(ctx);
      break;
    case 'herb':
      drawThymeAioli(ctx);
      break;
    case 'patty':
      drawEmberPatty(ctx);
      break;
    case 'egg':
      drawSunUpEgg(ctx);
      break;
    case 'fries':
      drawHerbFries(ctx);
      break;
    default:
      break;
  }

  ctx.restore();
}

function drawBriocheBun(ctx, mode = 'full') {
  if (mode === 'base') {
    // Toasted golden bottom heel
    const baseGrad = ctx.createLinearGradient(0, -4, 0, 18);
    baseGrad.addColorStop(0, '#f4cf8e');
    baseGrad.addColorStop(0.45, '#df9c45');
    baseGrad.addColorStop(1, '#a9621d');
    ctx.fillStyle = baseGrad;
    drawRoundedRect(ctx, -28, -2, 56, 17, 7);
    ctx.fill();
    ctx.strokeStyle = '#7e4312';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Warm toasted crumb surface
    ctx.fillStyle = '#fce3b0';
    ctx.beginPath();
    ctx.ellipse(0, -1, 26, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (mode === 'full') {
    // Bottom slice peek
    ctx.fillStyle = '#c87e2e';
    drawRoundedRect(ctx, -26, 8, 52, 9, 4.5);
    ctx.fill();
  }

  // Glossy brioche dome crown
  const domeGrad = ctx.createRadialGradient(-9, -12, 4, 0, 0, 32);
  domeGrad.addColorStop(0, '#ffd88a');
  domeGrad.addColorStop(0.5, '#e89b3c');
  domeGrad.addColorStop(1, '#a75a16');
  ctx.fillStyle = domeGrad;
  ctx.beginPath();
  ctx.moveTo(-27, 8);
  ctx.bezierCurveTo(-28, -20, 28, -20, 27, 8);
  ctx.quadraticCurveTo(0, 14, -27, 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#7c4110';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Specular glaze arc
  ctx.fillStyle = 'rgba(255, 248, 224, 0.36)';
  ctx.beginPath();
  ctx.ellipse(-8, -7, 11, 4.2, -0.25, 0, Math.PI * 2);
  ctx.fill();

  // Golden sesame seeds
  ctx.fillStyle = '#fff5d6';
  const seeds = [
    [-12, -5, -0.35],
    [-2, -9, 0.1],
    [9, -6, 0.4],
    [-6, 0, -0.15],
    [5, 0, 0.25],
    [15, 0, 0.55],
    [-16, 1, -0.5],
  ];
  for (const [sx, sy, rot] of seeds) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.7, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawOakLettuce(ctx) {
  const leafGrad = ctx.createLinearGradient(-26, -12, 26, 14);
  leafGrad.addColorStop(0, '#72cc57');
  leafGrad.addColorStop(0.5, '#43a047');
  leafGrad.addColorStop(1, '#266b2f');
  ctx.fillStyle = leafGrad;

  // Ruffled multi-lobe oak-leaf silhouette
  ctx.beginPath();
  const lobes = 11;
  for (let i = 0; i <= lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const r = i % 2 === 0 ? 27 : 20;
    const rx = Math.cos(a) * r;
    const ry = Math.sin(a) * (r * 0.58) + 2;
    if (i === 0) ctx.moveTo(rx, ry);
    else {
      const prevA = ((i - 0.5) / lobes) * Math.PI * 2;
      const cr = 30;
      ctx.quadraticCurveTo(Math.cos(prevA) * cr, Math.sin(prevA) * (cr * 0.56) + 2, rx, ry);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1f5a24';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Crisp light leaf ribs
  ctx.strokeStyle = '#b9f09d';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-15, 4);
  ctx.quadraticCurveTo(0, -1, 16, 3);
  ctx.moveTo(-4, 2);
  ctx.lineTo(-10, -7);
  ctx.moveTo(4, 1);
  ctx.lineTo(10, -7);
  ctx.stroke();
}

function drawRubyTomato(ctx) {
  // Deep heirloom ruby slice
  const outer = ctx.createRadialGradient(-6, -4, 3, 0, 2, 27);
  outer.addColorStop(0, '#ff6859');
  outer.addColorStop(0.65, '#dc3327');
  outer.addColorStop(1, '#941c15');
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.ellipse(0, 3, 26, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#79150f';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Inner pulp ring
  ctx.fillStyle = '#f55547';
  ctx.beginPath();
  ctx.ellipse(0, 2, 20.5, 11.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Seed pockets
  ctx.fillStyle = '#b3221a';
  const pockets = [
    [-9, -1, -0.3],
    [9, -1, 0.3],
    [-8, 5, 0.4],
    [8, 5, -0.4],
  ];
  for (const [px, py, rot] of pockets) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.5, 2.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe599';
    ctx.beginPath();
    ctx.arc(-1.8, 0, 1.1, 0, Math.PI * 2);
    ctx.arc(1.8, 0.4, 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b3221a';
    ctx.restore();
  }

  // Wet highlight sheen
  ctx.fillStyle = 'rgba(255, 240, 235, 0.42)';
  ctx.beginPath();
  ctx.ellipse(-9, -4, 6.5, 2.1, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawAgedCheddar(ctx) {
  // Melted diamond-drape aged cheddar slice
  const grad = ctx.createLinearGradient(-26, -12, 26, 16);
  grad.addColorStop(0, '#ffe26a');
  grad.addColorStop(0.55, '#f6b123');
  grad.addColorStop(1, '#d47c0e');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(28, 0);
  ctx.quadraticCurveTo(22, 10, 13, 14);
  ctx.quadraticCurveTo(6, 16, 0, 11);
  ctx.quadraticCurveTo(-8, 17, -16, 13);
  ctx.lineTo(-28, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#a85f0a';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Warm sheen
  ctx.fillStyle = 'rgba(255, 252, 224, 0.42)';
  ctx.beginPath();
  ctx.ellipse(-6, -4, 10, 3, -0.25, 0, Math.PI * 2);
  ctx.fill();
}

function drawThymeAioli(ctx) {
  // Creamy garlic-herb aioli dollop swirl
  const swirl = ctx.createRadialGradient(-4, -5, 2, 0, 3, 24);
  swirl.addColorStop(0, '#fffef7');
  swirl.addColorStop(0.6, '#f2e8c9');
  swirl.addColorStop(1, '#d3c297');
  ctx.fillStyle = swirl;
  ctx.beginPath();
  ctx.ellipse(0, 4, 24, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a59268';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Swirl ridge
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 3, 11, 0.4, Math.PI * 1.65);
  ctx.stroke();

  // Fresh green thyme sprig on top
  ctx.strokeStyle = '#2d6a36';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-14, 7);
  ctx.quadraticCurveTo(0, -2, 15, -9);
  ctx.stroke();

  ctx.fillStyle = '#48a14d';
  const leaves = [
    [-8, 2, -0.8],
    [-2, -2, 0.5],
    [4, -5, -0.7],
    [10, -8, 0.6],
    [2, 2, 0.8],
    [-3, 5, -0.5],
  ];
  for (const [lx, ly, rot] of leaves) {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, 4.6, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawEmberPatty(ctx) {
  // Thick flame-seared prime burger patty
  const body = ctx.createLinearGradient(0, -10, 0, 16);
  body.addColorStop(0, '#8d4829');
  body.addColorStop(0.5, '#662f18');
  body.addColorStop(1, '#431c0d');
  ctx.fillStyle = body;
  drawRoundedRect(ctx, -28, -6, 56, 20, 10);
  ctx.fill();
  ctx.strokeStyle = '#2e1207';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Juicy top sear surface
  const top = ctx.createRadialGradient(-7, -4, 3, 0, -2, 26);
  top.addColorStop(0, '#a35634');
  top.addColorStop(0.7, '#75361b');
  top.addColorStop(1, '#4f2210');
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.ellipse(0, -2, 26.5, 11.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Diagonal char grill marks
  ctx.strokeStyle = '#2c1106';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  for (const dx of [-13, -3, 7, 16]) {
    ctx.beginPath();
    ctx.moveTo(dx - 5, -7);
    ctx.lineTo(dx + 4, 4);
    ctx.stroke();
  }

  // Glossy basting sheen
  ctx.fillStyle = 'rgba(255, 224, 180, 0.25)';
  ctx.beginPath();
  ctx.ellipse(-10, -5, 8, 2.6, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawSunUpEgg(ctx) {
  // Lacy crisp-edged fried egg white
  const whiteGrad = ctx.createRadialGradient(0, 0, 6, 0, 2, 28);
  whiteGrad.addColorStop(0, '#ffffff');
  whiteGrad.addColorStop(0.8, '#fbf4e4');
  whiteGrad.addColorStop(1, '#e1c596');
  ctx.fillStyle = whiteGrad;
  ctx.beginPath();
  ctx.moveTo(-25, 2);
  ctx.bezierCurveTo(-28, -12, -10, -17, 4, -14);
  ctx.bezierCurveTo(22, -16, 30, -3, 25, 8);
  ctx.bezierCurveTo(22, 18, 2, 17, -10, 15);
  ctx.bezierCurveTo(-24, 16, -26, 9, -25, 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#c59c5b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Rich glossy golden yolk
  const yolk = ctx.createRadialGradient(-3, -4, 2, 0, 0, 12);
  yolk.addColorStop(0, '#fff07c');
  yolk.addColorStop(0.45, '#ffbe1a');
  yolk.addColorStop(1, '#dc7b06');
  ctx.fillStyle = yolk;
  ctx.beginPath();
  ctx.ellipse(1, 0, 11.5, 8.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b96504';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Yolk specular highlight + cracked black pepper flecks
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.beginPath();
  ctx.ellipse(-2.5, -3.2, 3.6, 1.8, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3d2817';
  for (const [px, py] of [[-12, -4], [14, 5], [-9, 8], [12, -6]]) {
    ctx.beginPath();
    ctx.arc(px, py, 1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHerbFries(ctx) {
  // Golden crisp bistro fries fanned neatly
  const sticks = [
    [-15, 6, -0.32, 26],
    [-9, 2, -0.18, 29],
    [-3, 0, -0.05, 31],
    [4, 0, 0.08, 30],
    [10, 2, 0.22, 28],
    [16, 6, 0.36, 25],
  ];
  for (const [fx, fy, rot, len] of sticks) {
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(rot);
    const g = ctx.createLinearGradient(-4, -len * 0.5, 4, len * 0.5);
    g.addColorStop(0, '#ffe37a');
    g.addColorStop(0.55, '#f0ae2b');
    g.addColorStop(1, '#c47612');
    ctx.fillStyle = g;
    drawRoundedRect(ctx, -3.8, -len * 0.55, 7.6, len, 2.2);
    ctx.fill();
    ctx.strokeStyle = '#97550a';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Sea salt & thyme specks
    ctx.fillStyle = '#3f8a42';
    ctx.fillRect(-1.2, -4, 2.2, 1.8);
    ctx.fillStyle = '#fff9df';
    ctx.fillRect(0.6, 3, 1.8, 1.6);
    ctx.restore();
  }

  // Front kraft bistro cuff holding the bundle
  const cuff = ctx.createLinearGradient(0, 2, 0, 17);
  cuff.addColorStop(0, '#d85738');
  cuff.addColorStop(1, '#9e331c');
  ctx.fillStyle = cuff;
  ctx.beginPath();
  ctx.moveTo(-17, 3);
  ctx.lineTo(17, 3);
  ctx.lineTo(13, 17);
  ctx.lineTo(-13, 17);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#6f2110';
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

// Renders a gorgeous 2.5D layered mid-assembly stack on the central oak cutting board
export function drawMidAssemblyStack(ctx, items, cx, baseY, scale = 1.25, opts = {}) {
  ctx.save();
  ctx.translate(cx, baseY);
  ctx.scale(scale, scale);

  // Subtle ambient shadow under the stack
  ctx.fillStyle = 'rgba(46, 24, 10, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 16, 46, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  let yOffset = 0;
  for (let i = 0; i < items.length; i++) {
    const entry = items[i];
    const t = easeOutBack(entry.anim ?? 1);
    const dropY = (1 - Math.min(1, entry.anim ?? 1)) * -42;
    const squashX = 1 + (1 - Math.min(1, entry.anim ?? 1)) * 0.14;
    const squashY = 1 - (1 - Math.min(1, entry.anim ?? 1)) * 0.1;

    ctx.save();
    ctx.translate(0, yOffset + dropY);
    ctx.scale(squashX * (0.9 + 0.1 * t), squashY * (0.9 + 0.1 * t));

    const isBaseBun = i === 0 && entry.id === 'bun';
    drawIngredientSprite(ctx, entry.id, 0, 0, 42, {
      shadow: i === 0,
      baseOnly: isBaseBun,
    });
    ctx.restore();

    yOffset -= entry.id === 'bun' ? 16 : entry.id === 'patty' ? 17 : 13;
  }

  // If complete and recipe has a crown bun, cap with the glossy sesame brioche top
  if (opts.capWithCrownBun) {
    ctx.save();
    ctx.translate(0, yOffset - 4);
    drawIngredientSprite(ctx, 'bun', 0, 0, 42, { shadow: false, crownOnly: true });
    ctx.restore();
  }

  ctx.restore();
}

// Renders a finished, garnished porcelain bistro plate ready to serve on the Serving Pass
export function drawFinishedPlate(ctx, recipe, cx, cy, scale = 1, glowPhase = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Warm brass heat-lamp halo underneath the plate
  const pulse = 0.72 + 0.28 * Math.sin(glowPhase * 2.2);
  const halo = ctx.createRadialGradient(0, 6, 16, 0, 6, 78);
  halo.addColorStop(0, `rgba(255, 214, 102, ${0.42 * pulse})`);
  halo.addColorStop(0.65, `rgba(255, 178, 66, ${0.18 * pulse})`);
  halo.addColorStop(1, 'rgba(255, 178, 66, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 6, 78, 0, Math.PI * 2);
  ctx.fill();

  // Plate cast shadow
  ctx.fillStyle = 'rgba(18, 10, 4, 0.42)';
  ctx.beginPath();
  ctx.ellipse(0, 22, 66, 26, 0, 0, Math.PI * 2);
  ctx.fill();

  // Outer porcelain rim
  const rimGrad = ctx.createLinearGradient(-64, -18, 64, 34);
  rimGrad.addColorStop(0, '#ffffff');
  rimGrad.addColorStop(0.55, '#f2eee6');
  rimGrad.addColorStop(1, '#cfc5b4');
  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.ellipse(0, 12, 64, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#9c8f7a';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Inner recessed porcelain well + gold bistro pinstripe
  ctx.fillStyle = '#faf7f1';
  ctx.beginPath();
  ctx.ellipse(0, 11, 49, 21, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Tiny ramekin of house sauce on the side
  ctx.fillStyle = '#c84b31';
  ctx.beginPath();
  ctx.ellipse(36, 14, 11, 6.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5e4bc';
  ctx.beginPath();
  ctx.ellipse(36, 13, 8.2, 4.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw the complete stacked gourmet dish centered on the plate
  const items = recipe.steps.map((id) => ({ id, anim: 1 }));
  drawMidAssemblyStack(ctx, items, -4, 10, 0.88, { capWithCrownBun: recipe.hasCrownBun });

  // Fresh parsley garnish leaf on the front-left rim
  ctx.fillStyle = '#3ea14a';
  ctx.beginPath();
  ctx.ellipse(-34, 21, 7, 3.6, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6ad16f';
  ctx.beginPath();
  ctx.ellipse(-29, 23, 5, 2.5, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
