
import { Platform } from './types';

export const CANVAS_WIDTH = 1024;
export const CANVAS_HEIGHT = 576;
export const WORLD_WIDTH = 2500;
export const GRAVITY = 0.7;
export const GROUND_Y = 500;

export const FIGHTER_WIDTH = 80; 
export const FIGHTER_HEIGHT = 76;

// Game Rules
export const MAX_ROUNDS = 3;
export const WINS_NEEDED = 2;
export const ROUND_TIME = 90; // Seconds

// Stats
export const MAX_ENERGY = 300; // Increased to allow 3 bars
export const ULT_COST = 100;
export const SKILL_COST = 0; 

// Gains & Drains
export const ENERGY_GAIN_HIT = 2;
export const ENERGY_GAIN_TAKE_HIT = 1;
export const ENERGY_GAIN_BLOCK = 3;
export const BLOCK_DRAIN_RATE = 0.08; // Approx 5% per second (0.08 * 60fps = 4.8)

// Mechanics
export const DODGE_DURATION = 30; // 0.5s @ 60fps
export const DODGE_COOLDOWN = 180; // 3s @ 60fps
export const JUGGLE_DAMAGE_CAP = 30; // Damage threshold to force knockdown
export const WAKEUP_INVULNERABILITY = 120; // 2s

// --- SPRITE CONFIGURATION ---
// Configure the "hitbox" area within your sprite sheet to remove transparent whitespace.
// Coordinates are based on the original image pixels. (0,0) is Top-Left.
// Set these to null to use the full image size without auto-centering.
export const SPRITE_CROP_CONFIG = {
  // Example configuration (Uncomment and adjust values):
  P1: {
    blX: 878, blY: 326, // Bottom-Left (Left-most pixel, Bottom-most pixel)
    trX: 289, trY: 770  // Top-Right (Right-most pixel, Top-most pixel)
  },

  P2: {
    blX: 878, blY: 326, // Bottom-Left (Left-most pixel, Bottom-most pixel)
    trX: 289, trY: 770  // 
  }
};

export const PLATFORMS: Platform[] = [
  { x: 150, y: 350, width: 200, height: 20 },
  { x: 50, y: 200, width: 150, height: 20 },
  { x: 600, y: 400, width: 300, height: 20 },
  { x: 1000, y: 250, width: 250, height: 20 }, 
  { x: 1100, y: 120, width: 150, height: 20 }, 
  { x: 1600, y: 400, width: 300, height: 20 }, 
  { x: 1900, y: 220, width: 200, height: 20 },
  { x: 2200, y: 320, width: 200, height: 20 }
];

// Controls Mapping
export const P1_KEYS = {
  UP: 'w',         // Used for menu or aiming
  DOWN: 's',       // Block
  LEFT: 'a',       // Move Left
  RIGHT: 'd',      // Move Right
  ATTACK: 'j',     // Normal Attack
  JUMP: 'k',       // Jump Action
  TELEPORT: 'l',   // Teleport
  SKILL_RANGED: 'i', // Ranged Skill (Energy Ball)
  ULT: 'o',        // Ultimate
  DODGE: ' '       // Spacebar
};

export const P2_KEYS = {
  UP: 'ArrowUp',
  DOWN: 'ArrowDown', // Block
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  ATTACK: '1',
  JUMP: '2', 
  SKILL_RANGED: '4',
  TELEPORT: '3',
  ULT: '5',
  DODGE: '0'
};
