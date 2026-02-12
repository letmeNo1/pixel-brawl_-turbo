
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
  ATTACK = 'ATTACK',
  SKILL = 'SKILL',
  ULTIMATE = 'ULTIMATE',
  HURT = 'HURT',
  DEAD = 'DEAD',
  CHARGING = 'CHARGING'
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
