
export enum GameMode {
  MENU = 'MENU',
  PVP = 'PVP',
  PVE = 'PVE',
  GAMEOVER = 'GAMEOVER'
}

export enum FighterState {
  IDLE = 'IDLE',
  WALK = 'WALK',
  JUMP = 'JUMP',
  CROUCH = 'CROUCH',
  DODGE = 'DODGE',
  ATTACK = 'ATTACK',
  SKILL = 'SKILL',
  ULTIMATE = 'ULTIMATE',
  HURT = 'HURT',
  DEAD = 'DEAD',
  CHARGING = 'CHARGING', // Keeping for legacy, though not used in new controls
  BLOCK = 'BLOCK',
  SUMMON = 'SUMMON'
}

export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface Hitbox {
  offset: Position;
  width: number;
  height: number;
}

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Projectile {
  id: string;
  ownerId: string;
  type: 'energy' | 'clone'; 
  x: number;
  y: number;
  startX: number; 
  velocity: { x: number; y: number };
  width: number;
  height: number;
  color: string;
  damage: number;
  facing: number; 
  createdAt: number;
}
