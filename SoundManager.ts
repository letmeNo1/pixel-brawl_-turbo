
export class SoundManager {
  private ctx: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private isMuted: boolean = false;
  private initialized: boolean = false;

  // Configuration for local sound files
  // Made public static so App can access paths for counting/loading logic if needed, 
  // though loadAll handles it internally.
  public soundPaths = {
    attack: '/assets/sounds/attack.mp3',
    hit: '/assets/sounds/hit.mp3',           
    heavy_hit: '/assets/sounds/heavy_hit.mp3', 
    ranged_hit: '/assets/sounds/ranged_hit.mp3',
    block: '/assets/sounds/block.mp3',
    guard_break: '/assets/sounds/guard_break.mp3',
    jump: '/assets/sounds/jump.mp3',
    skill: '/assets/sounds/skill.mp3',
    ultimate: '/assets/sounds/ultimate.mp3'
  };

  constructor() {
    // We defer heavy loading to loadAll() called by App
  }

  public async loadAll(onProgress?: (progress: number) => void) {
    if (this.initialized) {
        onProgress?.(1);
        return;
    }

    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContext();
    } catch (e) {
        console.warn('Web Audio API not supported', e);
        // Fake completion if audio not supported
        onProgress?.(1);
        return;
    }

    const keys = Object.keys(this.soundPaths);
    const total = keys.length;
    let loaded = 0;

    const promises = Object.entries(this.soundPaths).map(async ([key, path]) => {
        try {
            const res = await fetch(path);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const arrayBuffer = await res.arrayBuffer();
            if (this.ctx) {
                const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                this.buffers.set(key, audioBuffer);
            }
        } catch (e) {
            console.warn(`[SoundManager] Failed to load sound: ${key} (${path})`, e);
        } finally {
            loaded++;
            onProgress?.(loaded / total);
        }
    });

    await Promise.all(promises);
    this.initialized = true;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    // Resume context if it was suspended (browser autoplay policy)
    if (!this.isMuted && this.ctx?.state === 'suspended') {
        this.ctx.resume();
    }
  }

  // Helper method to ensure context is resumed on first user interaction
  resumeContext() {
      if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
      }
  }

  private play(key: string, volume: number = 0.5) {
    if (this.isMuted || !this.ctx) return;

    // Try to resume if suspended (though ideally called via resumeContext on click)
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
  playGuardBreak() { this.play('guard_break', 0.8); } 
  playSkill() { this.play('skill', 0.6); } 
  playJump() { this.play('jump', 0.3); }
  playUltimate() { this.play('ultimate', 1.0); }
}

export const soundManager = new SoundManager();
