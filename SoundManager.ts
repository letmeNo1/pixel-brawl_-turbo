
export class SoundManager {
  private ctx: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private isMuted: boolean = false;

  // Configuration for local sound files
  private soundPaths = {
    attack: '/assets/sounds/attack.mp3',
    hit: '/assets/sounds/hit.mp3',           // Standard Melee Hit
    heavy_hit: '/assets/sounds/heavy_hit.mp3', // Ultimate/Heavy Hit
    ranged_hit: '/assets/sounds/ranged_hit.mp3', // Ranged/Projectile Hit
    block: '/assets/sounds/block.mp3',
    guard_break: '/assets/sounds/guard_break.mp3', // New: Guard Break
    jump: '/assets/sounds/jump.mp3',
    skill: '/assets/sounds/skill.mp3',
    ultimate: '/assets/sounds/ultimate.mp3'
  };

  constructor() {
    this.init();
  }

  private async init() {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContext();
        
        // Preload all sounds
        for (const [key, path] of Object.entries(this.soundPaths)) {
            this.loadSound(key, path);
        }
    } catch (e) {
        console.warn('Web Audio API not supported', e);
    }
  }

  private async loadSound(key: string, path: string) {
      if (!this.ctx) return;
      try {
          const res = await fetch(path);
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          const arrayBuffer = await res.arrayBuffer();
          const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
          this.buffers.set(key, audioBuffer);
      } catch (e) {
          console.warn(`[SoundManager] Failed to load sound: ${key} (${path})`, e);
      }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    // Resume context if it was suspended (browser autoplay policy)
    if (!this.isMuted && this.ctx?.state === 'suspended') {
        this.ctx.resume();
    }
  }

  private play(key: string, volume: number = 0.5) {
    if (this.isMuted || !this.ctx) return;

    // Ensure context is running (sometimes needed after first user interaction)
    if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
    }

    const buffer = this.buffers.get(key);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    
    source.start(0);
  }

  // Exposed methods used by Fighter.ts
  playAttack() { this.play('attack', 0.5); }
  playHit() { this.play('hit', 0.7); }
  playHeavyHit() { this.play('heavy_hit', 0.8); }
  playRangedHit() { this.play('ranged_hit', 0.7); }

  playBlock() { this.play('block', 0.6); }
  playGuardBreak() { this.play('guard_break', 0.8); } // New
  playSkill() { this.play('skill', 0.6); } // For Throw/Projectile
  playJump() { this.play('jump', 0.3); }
  playUltimate() { this.play('ultimate', 1.0); }
}

export const soundManager = new SoundManager();
