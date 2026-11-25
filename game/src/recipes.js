// Original ingredient catalog, hot station parameters, signature bistro recipes,
// and escalating service wave schedules for Ember & Oak Kitchen.

export const INGREDIENTS = {
  bun: {
    id: 'bun',
    name: 'Brioche Bun',
    shortName: 'Bun',
    key: '1',
    station: 'cold',
    accent: '#e29d47',
    bgTint: '#fff2dc',
  },
  lettuce: {
    id: 'lettuce',
    name: 'Oak Lettuce',
    shortName: 'Lettuce',
    key: '2',
    station: 'cold',
    accent: '#4ea84f',
    bgTint: '#eaf8e7',
  },
  tomato: {
    id: 'tomato',
    name: 'Ruby Tomato',
    shortName: 'Tomato',
    key: '3',
    station: 'cold',
    accent: '#dc4537',
    bgTint: '#fdebe8',
  },
  cheddar: {
    id: 'cheddar',
    name: 'Aged Cheddar',
    shortName: 'Cheddar',
    key: '4',
    station: 'cold',
    accent: '#f0ab24',
    bgTint: '#fff6db',
  },
  herb: {
    id: 'herb',
    name: 'Thyme Aioli',
    shortName: 'Aioli',
    key: '5',
    station: 'cold',
    accent: '#5d9b6b',
    bgTint: '#ebf5ed',
  },
  patty: {
    id: 'patty',
    name: 'Ember Patty',
    shortName: 'Patty',
    key: '6',
    station: 'hot',
    stationTitle: 'Cast-Iron Griddle',
    cookTime: 1.5,
    maxReady: 2,
    accent: '#7a3b22',
    bgTint: '#f7e5dc',
  },
  egg: {
    id: 'egg',
    name: 'Sun-Up Egg',
    shortName: 'Egg',
    key: '7',
    station: 'hot',
    stationTitle: 'Copper Skillet',
    cookTime: 1.35,
    maxReady: 2,
    accent: '#f3b728',
    bgTint: '#fff7e0',
  },
  fries: {
    id: 'fries',
    name: 'Herb Fries',
    shortName: 'Fries',
    key: '8',
    station: 'hot',
    stationTitle: 'Brass Fryer',
    cookTime: 1.45,
    maxReady: 2,
    accent: '#e8a82e',
    bgTint: '#fef4dd',
  },
};

export const COLD_INGREDIENT_IDS = ['bun', 'lettuce', 'tomato', 'cheddar', 'herb'];
export const HOT_INGREDIENT_IDS = ['patty', 'egg', 'fries'];
export const ALL_INGREDIENT_IDS = [...COLD_INGREDIENT_IDS, ...HOT_INGREDIENT_IDS];

export const KEY_TO_INGREDIENT = Object.fromEntries(
  ALL_INGREDIENT_IDS.map((id) => [INGREDIENTS[id].key, id]),
);

// Original recipes designed with overlapping culinary roots (e.g. bun+patty+cheddar)
// so cooks can plan routes across cold prep and hot sizzle stations.
export const RECIPES = [
  {
    id: 'ember_stack',
    name: 'Ember Stack',
    steps: ['bun', 'patty', 'cheddar', 'lettuce'],
    basePoints: 150,
    patience: 34,
    minWave: 1,
    hasCrownBun: true,
    accent: '#d95d39',
  },
  {
    id: 'copper_sunrise',
    name: 'Copper Sunrise',
    steps: ['bun', 'patty', 'egg', 'herb'],
    basePoints: 170,
    patience: 34,
    minWave: 1,
    hasCrownBun: true,
    accent: '#e39c2b',
  },
  {
    id: 'golden_fryer',
    name: 'Golden Fryer Box',
    steps: ['fries', 'cheddar', 'herb'],
    basePoints: 120,
    patience: 28,
    minWave: 1,
    hasCrownBun: false,
    accent: '#d48d22',
  },
  {
    id: 'orchard_melt',
    name: 'Orchard Melt',
    steps: ['bun', 'lettuce', 'tomato', 'cheddar', 'herb'],
    basePoints: 185,
    patience: 36,
    minWave: 1,
    hasCrownBun: true,
    accent: '#4a9b54',
  },
  {
    id: 'bistro_crown',
    name: 'Bistro Crown',
    steps: ['bun', 'patty', 'cheddar', 'tomato', 'herb'],
    basePoints: 205,
    patience: 36,
    minWave: 2,
    hasCrownBun: true,
    accent: '#c23f35',
  },
  {
    id: 'skillet_ranchero',
    name: 'Skillet Platter',
    steps: ['patty', 'egg', 'tomato', 'fries'],
    basePoints: 195,
    patience: 35,
    minWave: 2,
    hasCrownBun: false,
    accent: '#b85c2e',
  },
  {
    id: 'truffle_feast',
    name: 'Chef Grand Feast',
    steps: ['bun', 'patty', 'cheddar', 'egg', 'fries'],
    basePoints: 245,
    patience: 38,
    minWave: 3,
    hasCrownBun: true,
    accent: '#a44a72',
  },
];

export const RECIPE_MAP = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export const SERVICE_WAVES = [
  {
    wave: 1,
    label: 'OPENING PREP',
    startsAtRemaining: 90,
    maxOrders: 3,
    spawnInterval: 5.5,
    vipChance: 0.08,
    patienceScale: 1.0,
  },
  {
    wave: 2,
    label: 'LUNCH BUZZ',
    startsAtRemaining: 68,
    maxOrders: 4,
    spawnInterval: 4.5,
    vipChance: 0.22,
    patienceScale: 0.92,
  },
  {
    wave: 3,
    label: 'DINNER RUSH',
    startsAtRemaining: 44,
    maxOrders: 4,
    spawnInterval: 3.6,
    vipChance: 0.35,
    patienceScale: 0.84,
  },
  {
    wave: 4,
    label: 'FINAL CALL',
    startsAtRemaining: 20,
    maxOrders: 4,
    spawnInterval: 3.0,
    vipChance: 0.45,
    patienceScale: 0.78,
  },
];

export const GUEST_TABLES = ['T-02', 'T-05', 'T-07', 'T-09', 'T-11', 'BAR-1', 'BAR-3', 'PATIO'];

export function getWaveConfig(timeRemaining) {
  for (let i = SERVICE_WAVES.length - 1; i >= 0; i--) {
    if (timeRemaining <= SERVICE_WAVES[i].startsAtRemaining) {
      return SERVICE_WAVES[i];
    }
  }
  return SERVICE_WAVES[0];
}
