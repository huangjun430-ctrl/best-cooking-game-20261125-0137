// Shared 1280x800 logical kitchen layout geometry for pixel-accurate rendering and hit-testing.

export const STAGE_W = 1280;
export const STAGE_H = 800;

export const HEADER_H = 60;
export const ORDER_RAIL_Y = 60;
export const ORDER_RAIL_H = 166;
export const STOVE_Y = 226;
export const STOVE_H = 192;
export const COUNTER_Y = 418;
export const COUNTER_H = 342;
export const FOOTER_Y = 760;
export const FOOTER_H = 40;

export const HUD_BUTTONS = {
  mute: { x: 1094, y: 12, w: 46, h: 36, label: 'M' },
  demo: { x: 1148, y: 12, w: 56, h: 36, label: 'RUSH' },
  restart: { x: 1212, y: 12, w: 50, h: 36, label: 'R' },
};

export const TICKET_SLOTS = [
  { x: 42, y: 74, w: 280, h: 142 },
  { x: 344, y: 74, w: 280, h: 142 },
  { x: 646, y: 74, w: 280, h: 142 },
  { x: 948, y: 74, w: 280, h: 142 },
];

export const HOT_STATION_RECTS = {
  patty: { x: 66, y: 242, w: 354, h: 160 },
  egg: { x: 462, y: 242, w: 356, h: 160 },
  fries: { x: 860, y: 242, w: 354, h: 160 },
};

export const PREP_ZONE_RECT = { x: 24, y: 432, w: 416, h: 316 };
export const BOARD_ZONE_RECT = { x: 458, y: 432, w: 396, h: 316 };
export const PASS_ZONE_RECT = { x: 872, y: 432, w: 384, h: 316 };

// 3x2 grid inside the chilled marble prep counter: 5 cold ingredients + 1 scrap bowl
export const COLD_TRAY_RECTS = {
  bun: { x: 40, y: 476, w: 122, h: 122 },
  lettuce: { x: 171, y: 476, w: 122, h: 122 },
  tomato: { x: 302, y: 476, w: 122, h: 122 },
  cheddar: { x: 40, y: 610, w: 122, h: 122 },
  herb: { x: 171, y: 610, w: 122, h: 122 },
  scrap: { x: 302, y: 610, w: 122, h: 122 },
};

export const BOARD_ACTION_RECT = { x: 540, y: 694, w: 232, h: 40 };

export const PASS_PLATE_SLOTS = [
  { cx: 970, cy: 560, r: 80, rect: { x: 888, y: 478, w: 164, h: 168 } },
  { cx: 1152, cy: 560, r: 80, rect: { x: 1070, y: 478, w: 164, h: 168 } },
];

export const SERVICE_BELL_RECT = { x: 966, y: 676, w: 196, h: 56 };

// Compact game-over summary card placed cleanly in the lower-center board zone
// so top order rail, countdown timer, ingredients, mid-assembly edge, and finished plate stay visible.
export const GAMEOVER_CARD_RECT = { x: 468, y: 446, w: 376, h: 288 };
export const GAMEOVER_RESTART_RECT = { x: 546, y: 668, w: 220, h: 46 };

export function hitTestRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}
