
import { Platform } from './types';

export const CANVAS_WIDTH = 1024;
export const CANVAS_HEIGHT = 576;
export const WORLD_WIDTH = 3000; // 稍微扩大地图宽度
export const GRAVITY = 0.7;
export const GROUND_Y = 500;

export const FIGHTER_WIDTH = 60;
export const FIGHTER_HEIGHT = 120;

export const MAX_ENERGY = 300; // 3 bars
export const ENERGY_PER_BAR = 100;
export const ULT_COST = 100; // Costs 1 bar
export const HIT_ENERGY_GAIN = 15;
export const CHARGE_SPEED = 1.5;

// Max jump height is approx 206px (v=-17, g=0.7)
// Safe jump height used here is <= 180px
export const PLATFORMS: Platform[] = [
  // Left Area
  { x: 200, y: 350, width: 300, height: 20 },  // Base Left (h=150 from ground)
  { x: 150, y: 200, width: 200, height: 20 },  // High Left (h=150 from Base)

  // Middle Low Area
  { x: 800, y: 400, width: 400, height: 20 },  // Step 1 (h=100 from ground)

  // Middle High Tower
  { x: 1000, y: 250, width: 250, height: 20 }, // Step 2 (h=150 from Step 1)
  { x: 1100, y: 110, width: 150, height: 20 }, // Peak (h=140 from Step 2)

  // Right Transition
  { x: 1600, y: 350, width: 300, height: 20 }, // Base Right 1 (h=150 from ground)
  { x: 1800, y: 200, width: 200, height: 20 }, // High Right 1 (h=150 from Base)

  // Far Right Area
  { x: 2300, y: 320, width: 300, height: 20 }, // Base Right 2 (h=180 from ground)
  { x: 2600, y: 170, width: 200, height: 20 }, // High Right 2 (h=150 from Base)
];

export const P1_KEYS = {
  UP: 'w',
  DOWN: 's',
  LEFT: 'a',
  RIGHT: 'd',
  ATTACK: 'j',
  JUMP: 'k',
  TELEPORT: 'l',
  SKILL: 'i',
  ULT: 'o'
};

export const P2_KEYS = {
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  ATTACK: '1',
  JUMP: '2',
  TELEPORT: '3',
  SKILL: '4',
  ULT: '5'
};
