
import { FighterState, Position, Velocity, Hitbox, Platform } from './types';
import { 
  GRAVITY, GROUND_Y, FIGHTER_WIDTH, FIGHTER_HEIGHT, WORLD_WIDTH,
  MAX_ENERGY, ULT_COST, CHARGE_SPEED, HIT_ENERGY_GAIN
} from './constants';

export class Fighter {
  position: Position;
  velocity: Velocity;
  width: number = FIGHTER_WIDTH;
  height: number = FIGHTER_HEIGHT;
  state: FighterState = FighterState.IDLE;
  health: number = 100;
  maxHealth: number = 100;
  energy: number = 0;
  maxEnergy: number = MAX_ENERGY;
  color: string;
  characterId: string;
  sprites: Record<string, HTMLImageElement> = {};
  facing: 'left' | 'right' = 'right';
  isAttacking: boolean = false;
  isInvulnerable: boolean = false;
  attackCooldown: number = 0;
  hurtCooldown: number = 0;
  
  // New physics properties
  isGrounded: boolean = false;
  jumpBuffer: number = 0;
  
  hitbox: Hitbox = { offset: { x: 0, y: 0 }, width: 0, height: 0 };

  constructor(x: number, color: string, facing: 'left' | 'right', characterId: string) {
    this.position = { x, y: 0 };
    this.velocity = { x: 0, y: 0 };
    this.color = color;
    this.facing = facing;
    this.characterId = characterId;
    this.loadSprites();
  }

  loadSprites() {
    // Maps internal state keys to filename suffixes
    // Expects files in /assets/ folder: user1_idle.png, user1_run.png, etc.
    const mappings: Record<string, string> = {
      'idle': 'idle',
      'run': 'run',
      'jump': 'jump',
      'attack': 'attack', 
      'hurt': 'hurt',
      'ultimate': 'ultimate'
    };

    Object.entries(mappings).forEach(([key, suffix]) => {
      const img = new Image();
      img.src = `/assets/${this.characterId}_${suffix}.png`;
      this.sprites[key] = img;
    });
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    
    // Determine center point for transformations
    const centerX = this.position.x + this.width / 2;
    const centerY = this.position.y + this.height / 2;

    ctx.translate(centerX, centerY);

    // Flip context if facing left
    if (this.facing === 'left') {
        ctx.scale(-1, 1);
    }

    // Charging Aura (drawn relative to center)
    if (this.state === FighterState.CHARGING) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, this.height * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ultimate visual effect
    if (this.state === FighterState.ULTIMATE) {
      ctx.shadowBlur = 30;
      ctx.shadowColor = this.color;
    }

    // Determine sprite to draw
    let spriteKey = 'idle';
    switch (this.state) {
        case FighterState.WALK: spriteKey = 'run'; break;
        case FighterState.JUMP: spriteKey = 'jump'; break;
        case FighterState.ATTACK: spriteKey = 'attack'; break;
        case FighterState.ULTIMATE: spriteKey = 'ultimate'; break;
        case FighterState.HURT: spriteKey = 'hurt'; break;
        case FighterState.DEAD: spriteKey = 'hurt'; break;
        default: spriteKey = 'idle';
    }

    // Fallback logic for ultimate -> attack, etc if needed could go here
    // For now, straightforward mapping.

    const sprite = this.sprites[spriteKey];
    const isSpriteLoaded = sprite && sprite.complete && sprite.naturalWidth > 0;

    // Draw Character (Image or Rect)
    if (isSpriteLoaded) {
        // Draw image centered
        // Assuming sprite is roughly compatible with hitbox or scaling needed?
        // We draw it to fill the hitbox size
        ctx.drawImage(sprite!, -this.width / 2, -this.height / 2, this.width, this.height);
        
        // If hurt, draw a white overlay with opacity
        if (this.hurtCooldown > 0) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }
    } else {
        // Fallback to rectangle drawing if sprite missing
        ctx.fillStyle = this.hurtCooldown > 0 ? '#fff' : this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

        // Head
        ctx.fillStyle = '#fce4ec';
        ctx.fillRect(-this.width / 2 + 10, -this.height / 2 - 10, this.width - 20, 30);

        // Eyes (Always "right" relative to flipped context)
        ctx.fillStyle = '#000';
        ctx.fillRect(10, -this.height / 2, 10, 5);
    }

    // Reset transformation for text/UI elements that shouldn't flip
    ctx.restore(); 

    // Draw status text (needs to be un-flipped, so we use absolute coordinates again)
    if (this.state === FighterState.CHARGING) {
        ctx.save();
        ctx.fillStyle = '#fbbf24';
        ctx.font = '10px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('CHARGING', this.position.x + this.width/2, this.position.y - 30);
        ctx.restore();
    }
  }

  update(platforms: Platform[]) {
    const prevY = this.position.y;
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;

    // Energy logic for charging state
    if (this.state === FighterState.CHARGING) {
        this.energy = Math.min(this.maxEnergy, this.energy + CHARGE_SPEED);
    }

    // Reset grounded state for this frame
    this.isGrounded = false;

    // Platform collisions
    let onPlatform = false;
    // Check >= 0 to ensure we catch the player even if they are standing still (vel=0)
    if (this.velocity.y >= 0) {
      for (const platform of platforms) {
        const feetY = prevY + this.height;
        const newFeetY = this.position.y + this.height;
        if (this.position.x + this.width > platform.x && this.position.x < platform.x + platform.width) {
          if (feetY <= platform.y && newFeetY >= platform.y) {
            this.position.y = platform.y - this.height;
            this.velocity.y = 0;
            onPlatform = true;
            this.isGrounded = true;
            break;
          }
        }
      }
    }

    if (!onPlatform) {
      if (this.position.y + this.height + this.velocity.y >= GROUND_Y) {
        this.velocity.y = 0;
        this.position.y = GROUND_Y - this.height;
        this.isGrounded = true;
      } else {
        this.velocity.y += GRAVITY;
      }
    }

    if (this.position.x < 0) this.position.x = 0;
    if (this.position.x + this.width > WORLD_WIDTH) this.position.x = WORLD_WIDTH - this.width;

    // Handle Jump Buffer
    if (this.jumpBuffer > 0) {
        this.jumpBuffer--;
        // Check if can jump
        if (this.isGrounded && this.state !== FighterState.CHARGING && this.state !== FighterState.HURT && this.state !== FighterState.DEAD && this.state !== FighterState.ATTACK && this.state !== FighterState.ULTIMATE) {
            this.velocity.y = -17;
            this.isGrounded = false;
            this.jumpBuffer = 0; // Consume buffer
            this.state = FighterState.JUMP;
        }
    }

    if (this.attackCooldown > 0) this.attackCooldown--;
    if (this.hurtCooldown > 0) this.hurtCooldown--;
    
    // State machine update
    if (this.attackCooldown === 0 && this.hurtCooldown === 0 && this.state !== FighterState.CHARGING) {
      this.isAttacking = false;
      if (this.velocity.y !== 0) {
          this.state = FighterState.JUMP;
      } else if (this.velocity.x !== 0) {
          this.state = FighterState.WALK;
      } else {
          this.state = FighterState.IDLE;
      }
    }
  }

  attemptJump() {
      // Set buffer to ~10 frames (approx 160ms at 60fps)
      this.jumpBuffer = 10;
  }

  attack() {
    if (this.attackCooldown > 0 || this.state === FighterState.CHARGING || this.state === FighterState.HURT) return;
    this.isAttacking = true;
    this.state = FighterState.ATTACK;
    this.attackCooldown = 20;
    this.hitbox = { offset: { x: 50, y: 20 }, width: 100, height: 50 };
  }

  charge(start: boolean) {
    if (start) {
        if (this.attackCooldown > 0 || this.state === FighterState.HURT) return;
        this.state = FighterState.CHARGING;
        this.velocity.x = 0;
    } else {
        if (this.state === FighterState.CHARGING) {
            this.state = FighterState.IDLE;
        }
    }
  }

  ultimate() {
    if (this.attackCooldown > 0 || this.energy < ULT_COST || this.state === FighterState.CHARGING || this.state === FighterState.HURT) return;
    this.energy -= ULT_COST;
    this.isAttacking = true;
    this.state = FighterState.ULTIMATE;
    this.attackCooldown = 60;
    this.hitbox = { offset: { x: -50, y: -50 }, width: 200, height: 200 };
  }

  teleport() {
    if (this.attackCooldown > 0 || this.state === FighterState.CHARGING || this.state === FighterState.HURT) return;
    const distance = 180;
    const targetX = this.position.x + (this.facing === 'right' ? distance : -distance);
    this.position.x = Math.max(0, Math.min(WORLD_WIDTH - this.width, targetX));
    this.hurtCooldown = 15; 
  }

  gainEnergy(amount: number) {
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
  }

  takeDamage(amount: number) {
    if (this.hurtCooldown > 0) return;
    this.health -= amount;
    this.hurtCooldown = 20;
    this.state = FighterState.HURT;
    
    if (this.health <= 0) {
      this.health = 0;
      this.state = FighterState.DEAD;
    }
  }
}
