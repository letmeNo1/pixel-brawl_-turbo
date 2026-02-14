
import { FighterState, Position, Velocity, Hitbox, Platform, Projectile } from './types';
import { 
  GRAVITY, GROUND_Y, FIGHTER_WIDTH, FIGHTER_HEIGHT, WORLD_WIDTH,
  MAX_ENERGY, ULT_COST, SKILL_COST, SUMMON_COST,
  ENERGY_GAIN_HIT, ENERGY_GAIN_TAKE_HIT, ENERGY_GAIN_BLOCK, BLOCK_DRAIN_RATE,
  DODGE_DURATION, DODGE_COOLDOWN, JUGGLE_DAMAGE_CAP, WAKEUP_INVULNERABILITY
} from './constants';

interface SpriteData {
  images: HTMLImageElement[];
}

export class Fighter {
  position: Position;
  velocity: Velocity;
  width: number = FIGHTER_WIDTH;
  height: number = FIGHTER_HEIGHT;
  
  // State management
  private _state: FighterState = FighterState.IDLE;
  get state(): FighterState { return this._state; }
  set state(newState: FighterState) {
    if (this._state !== newState) {
      this._state = newState;
      this.currentFrame = 0;
      this.framesElapsed = 0;
      
      // Reset hitbox on state change
      if (newState !== FighterState.ATTACK && newState !== FighterState.ULTIMATE) {
          this.hitbox = { offset: { x: 0, y: 0 }, width: 0, height: 0 };
      }
    }
  }

  health: number = 100;
  maxHealth: number = 100;
  energy: number = 0; // Starts at 0
  maxEnergy: number = MAX_ENERGY;
  color: string;
  characterId: string;
  assetTimestamp: number;
  
  // Animation properties
  sprites: Record<string, SpriteData> = {};
  currentFrame: number = 0;
  framesElapsed: number = 0;
  framesHold: number = 20; // Increased base frame hold to slow down animations
  
  // Sprite Cropping / Centering Config
  spriteCrop: { bl: Position, tr: Position } | null = null;
  
  facing: 'left' | 'right' = 'right';
  isAttacking: boolean = false;
  attackComboIndex: number = 0; // For 3-step combo
  
  // Timers & Mechanics
  actionTimer: number = 0;
  hurtTimer: number = 0;
  dodgeTimer: number = 0;
  dodgeCooldown: number = 0;
  blockTimer: number = 0; // To track how long held (guard break)
  invulnerabilityTimer: number = 0; // Wakeup protection
  
  // Skill Mechanics
  skillStartup: number = 0;
  newProjectiles: Projectile[] = [];

  // Physics
  isGrounded: boolean = false;
  jumpBuffer: number = 0;
  jumpCount: number = 0; // Track jumps for double jump logic
  airDamageTaken: number = 0; // Juggle protection
  
  hitbox: Hitbox = { offset: { x: 0, y: 0 }, width: 0, height: 0 };

  constructor(x: number, color: string, facing: 'left' | 'right', characterId: string, assetTimestamp: number = 0) {
    this.position = { x, y: 0 };
    this.velocity = { x: 0, y: 0 };
    this.color = color;
    this.facing = facing;
    this.characterId = characterId;
    this.assetTimestamp = assetTimestamp;
    this.loadSprites();
  }

  // Set the actual character content boundaries within the image to auto-center
  setSpriteCropping(blX: number, blY: number, trX: number, trY: number) {
      this.spriteCrop = {
          bl: { x: blX, y: blY }, // Bottom-Left (x=min, y=max)
          tr: { x: trX, y: trY }  // Top-Right (x=max, y=min)
      };
  }

  loadSprites() {
    // Map new states to existing assets for now (fallback logic used in draw)
    const mappings: Record<string, number> = {
      'idle': 1,
      'run': 5,
      'jump': 1,
      'attack': 3, // Changed to 3 frames for combo
      'hurt': 1, 
      'block': 1, 
      'skill': 2, // Changed to 2 frames
      'ultimate': 1,
      'summon': 1,
      'crouch': 1 // Will need asset or fallback
    };

    console.log(`[Fighter] Init loadSprites for: ${this.characterId}`);

    Object.entries(mappings).forEach(([key, count]) => {
      const images: HTMLImageElement[] = [];
      if (count > 1) {
        for (let i = 1; i <= count; i++) {
            const img = new Image();
            const src = `/assets/characters/${this.characterId}/${key}${i}.png?v=${this.assetTimestamp}`;
            img.src = src;
            images.push(img);
        }
      } else {
        const img = new Image();
        const src = `/assets/characters/${this.characterId}/${key}.png?v=${this.assetTimestamp}`;
        img.src = src;
        images.push(img);
      }
      this.sprites[key] = { images };
    });
  }

  draw(ctx: CanvasRenderingContext2D, debug: boolean = false) {
    ctx.save();
    
    const centerX = this.position.x + this.width / 2;
    const centerY = this.position.y + this.height / 2;

    // Apply shake effect if hurt
    let shakeX = 0;
    let shakeY = 0;
    if (this.state === FighterState.HURT) {
      shakeX = (Math.random() - 0.5) * 10;
      shakeY = (Math.random() - 0.5) * 10;
    }

    ctx.translate(centerX + shakeX, centerY + shakeY);

    if (this.facing === 'left') {
        ctx.scale(-1, 1);
    }

    // Visual Feedback for Invulnerability (Wakeup/Dodge)
    if (this.invulnerabilityTimer > 0 || this.state === FighterState.DODGE) {
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 50) * 0.3;
    }

    if (this.state === FighterState.BLOCK) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'; 
        ctx.fillRect(-this.width/2 - 10, -this.height/2 - 10, this.width + 20, this.height + 20);
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 3;
        ctx.strokeRect(-this.width/2 - 10, -this.height/2 - 10, this.width + 20, this.height + 20);
    }

    if (this.state === FighterState.ULTIMATE) {
      ctx.shadowBlur = 30;
      ctx.shadowColor = this.color;
    }
    
    // Skill charging visual
    if (this.skillStartup > 0 && this.state === FighterState.SKILL) {
        ctx.shadowBlur = 10 + (25 - this.skillStartup); // Increasing glow
        ctx.shadowColor = '#fbbf24';
    }

    let spriteKey = 'idle';
    let currentFramesHold = 20; // Default slower speed

    switch (this.state) {
        case FighterState.WALK: spriteKey = 'run'; currentFramesHold = 15; break;
        case FighterState.JUMP: spriteKey = 'jump'; break;
        case FighterState.ATTACK: spriteKey = 'attack'; currentFramesHold = 15; break;
        case FighterState.ULTIMATE: spriteKey = 'ultimate'; currentFramesHold = 18; break;
        case FighterState.HURT: spriteKey = 'hurt'; break;
        case FighterState.DEAD: spriteKey = 'hurt'; break;
        case FighterState.BLOCK: spriteKey = 'block'; break;
        case FighterState.SKILL: spriteKey = 'skill'; currentFramesHold = 20; break;
        case FighterState.SUMMON: spriteKey = 'summon'; currentFramesHold = 18; break;
        case FighterState.CROUCH: spriteKey = 'crouch'; break;
        case FighterState.DODGE: spriteKey = 'run'; break; // Reuse run for dodge visual
        default: spriteKey = 'idle';
    }

    let spriteData = this.sprites[spriteKey];
    
    // Fallbacks
    if (spriteKey === 'block' && this.isMissing(spriteData)) spriteData = this.sprites['idle'];
    if (spriteKey === 'summon' && this.isMissing(spriteData)) spriteData = this.sprites['attack'];
    if (spriteKey === 'skill' && this.isMissing(spriteData)) spriteData = this.sprites['attack'];
    if (spriteKey === 'crouch' && this.isMissing(spriteData)) spriteData = this.sprites['idle']; // Fallback crouch

    const frames = spriteData ? spriteData.images : [];
    const totalFrames = frames.length;

    if (totalFrames > 1) {
        // Special logic for ATTACK: do not cycle automatically, frames are manually set in attack()
        if (this.state !== FighterState.ATTACK) {
            this.framesElapsed++;
            if (this.framesElapsed % currentFramesHold === 0) {
                this.currentFrame = (this.currentFrame + 1) % totalFrames;
            }
        }
    } else {
        this.currentFrame = 0;
    }

    const currentImage = frames[this.currentFrame % totalFrames]; // Safety mod
    const isSpriteLoaded = currentImage && currentImage.complete && currentImage.naturalWidth > 0;

    if (isSpriteLoaded) {
        let drawX = -this.width / 2;
        let drawY = -this.height / 2;
        let drawW = this.width;
        let drawH = this.height;

        // --- SMART CROPPING LOGIC ---
        if (this.spriteCrop) {
             const { bl, tr } = this.spriteCrop;
             // Width/Height of the character content in the source image
             const contentW = Math.abs(tr.x - bl.x) || 1; 
             const contentH = Math.abs(bl.y - tr.y) || 1;
             
             // Calculate center of the content in the source image
             const contentCX = (bl.x + tr.x) / 2;
             const contentCY = (bl.y + tr.y) / 2;

             // Determine how much we need to scale the content to fit the Hitbox
             const scaleX = this.width / contentW;
             const scaleY = this.height / contentH;
             
             // The full image must be drawn scaled
             drawW = currentImage.width * scaleX;
             drawH = currentImage.height * scaleY;
             
             // Shift so that Content Center aligns with (0,0) [Hitbox Center]
             drawX = -contentCX * scaleX;
             drawY = -contentCY * scaleY;
             
             // Adjust for Crouch (squash effect)
             if (this.state === FighterState.CROUCH && spriteKey !== 'crouch') {
                const squashFactor = 0.7;
                drawH *= squashFactor;
                drawY += this.height * 0.3; // Visual shift down
             }
        } else {
            // --- LEGACY FALLBACK LOGIC ---
            // Crouch visual adjustment if reusing idle sprite
            if (this.state === FighterState.CROUCH && spriteKey !== 'crouch') {
                drawH = this.height * 0.7;
                drawY = -this.height / 2 + (this.height * 0.3);
            }
        }

        ctx.drawImage(
            currentImage,
            drawX, 
            drawY, 
            drawW, 
            drawH 
        );
        
        if (this.state === FighterState.HURT) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fillRect(drawX, drawY, drawW, drawH);
        }
    } else {
        // Fallback rectangle
        ctx.fillStyle = this.state === FighterState.HURT ? '#fff' : this.color;
        let h = this.height;
        let y = -this.height / 2;
        if (this.state === FighterState.CROUCH) { h *= 0.6; y += this.height * 0.4; }
        ctx.fillRect(-this.width / 2, y, this.width, h);
    }

    ctx.restore(); 

    if (this.state === FighterState.BLOCK) {
        ctx.save();
        ctx.fillStyle = '#60a5fa';
        ctx.font = '10px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('BLOCK', this.position.x + this.width/2, this.position.y - 30);
        ctx.restore();
    }

    // DEBUG: Draw Hitboxes and Hurtboxes
    if (debug) {
        ctx.save();
        // 1. HURTBOX (Body physics box) - RED
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.position.x, this.position.y, this.width, this.height);
        
        // 2. HITBOX (Active Attack) - YELLOW
        if ((this.state === FighterState.ATTACK || this.state === FighterState.ULTIMATE) && this.hitbox.width > 0) {
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
            ctx.lineWidth = 2;
            
            // Calculate world space hitbox based on facing
            const hbX = this.facing === 'right' 
                ? this.position.x + this.hitbox.offset.x 
                : this.position.x - this.hitbox.width + (this.width - this.hitbox.offset.x);
            
            ctx.strokeRect(hbX, this.position.y + this.hitbox.offset.y, this.hitbox.width, this.hitbox.height);
        }
        ctx.restore();
    }
  }
  
  private isMissing(data: SpriteData | undefined) {
      return !data || data.images.length === 0 || !data.images[0].complete;
  }

  update(platforms: Platform[]) {
    const prevY = this.position.y;
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;

    // Physics constants
    const FRICTION = 0.85; 
    const AIR_RESISTANCE = 0.95;

    // Apply friction
    if (this.isGrounded) {
       this.velocity.x *= FRICTION;
    } else {
       this.velocity.x *= AIR_RESISTANCE;
    }

    if (Math.abs(this.velocity.x) < 0.1) this.velocity.x = 0;

    // Reset grounded state
    this.isGrounded = false;

    // Platform collisions
    let onPlatform = false;
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
            this.jumpCount = 0; // Reset jumps on landing
            this.airDamageTaken = 0; // Reset juggle damage on landing
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
        this.jumpCount = 0; // Reset jumps on landing
        this.airDamageTaken = 0; // Reset juggle damage on landing
      } else {
        // Gravity Logic with Buffer
        // If falling after double jump (jumpCount >= 2), reduce gravity for "buffer" feel
        const isDoubleJumpFall = this.jumpCount >= 2 && this.velocity.y > 0;
        const appliedGravity = isDoubleJumpFall ? GRAVITY * 0.5 : GRAVITY;
        this.velocity.y += appliedGravity;

        // If falling without jumping (e.g., walking off ledge), treat as using first jump
        if (this.jumpCount === 0 && this.velocity.y > 2) {
            this.jumpCount = 1;
        }
      }
    }

    if (this.position.x < 0) this.position.x = 0;
    if (this.position.x + this.width > WORLD_WIDTH) this.position.x = WORLD_WIDTH - this.width;

    // --- Timers ---
    if (this.actionTimer > 0) this.actionTimer--;
    if (this.hurtTimer > 0) this.hurtTimer--;
    if (this.dodgeCooldown > 0) this.dodgeCooldown--;
    if (this.invulnerabilityTimer > 0) this.invulnerabilityTimer--;

    // Skill Startup Handling
    if (this.skillStartup > 0) {
        this.skillStartup--;
        if (this.skillStartup === 0) {
            // Fire projectiles when startup ends
            this.fireRangedSkill();
        }
    }

    // Dodge Logic
    if (this.state === FighterState.DODGE) {
        this.velocity.x = this.facing === 'right' ? 8 : -8; // Dash speed
        this.dodgeTimer--;
        if (this.dodgeTimer <= 0) {
            this.state = FighterState.IDLE;
            this.velocity.x = 0;
        }
        return; // Skip other state logic during dodge
    }

    // Block Energy Drain
    if (this.state === FighterState.BLOCK) {
        this.energy -= BLOCK_DRAIN_RATE;
        this.blockTimer++;
        // Guard Break: Energy empty or held too long (3s = 180 frames)
        if (this.energy <= 0 || this.blockTimer > 180) {
            this.state = FighterState.HURT; // Guard break stun
            this.hurtTimer = 60;
            this.energy = 0;
        }
    } else {
        this.blockTimer = 0;
    }

    // Jump Buffer & Logic
    if (this.jumpBuffer > 0) {
        this.jumpBuffer--;
        const lockedStates = [FighterState.HURT, FighterState.DEAD, FighterState.SKILL, FighterState.SUMMON, FighterState.ULTIMATE];
        
        if (!lockedStates.includes(this.state)) {
            if (this.isGrounded) {
                // Ground Jump
                this.velocity.y = -17;
                this.isGrounded = false;
                this.jumpBuffer = 0;
                this.state = FighterState.JUMP;
                this.jumpCount = 1;
            } else if (this.jumpCount < 2) {
                // Double Jump
                this.velocity.y = -13; // Slightly lower velocity for air jump
                this.jumpCount = 2;
                this.jumpBuffer = 0;
                
                // Reset animation frame to restart jump visual
                if (this.state === FighterState.JUMP) {
                    this.currentFrame = 0;
                    this.framesElapsed = 0;
                }
                this.state = FighterState.JUMP;
            }
        }
    }

    // State Recovery
    if (this.state === FighterState.HURT) {
        if (this.hurtTimer <= 0) {
             this.state = FighterState.IDLE;
             // Wakeup Invulnerability if grounded
             if (this.isGrounded) {
                 this.invulnerabilityTimer = WAKEUP_INVULNERABILITY;
             }
        }
    } 
    else if ([FighterState.ATTACK, FighterState.SKILL, FighterState.ULTIMATE, FighterState.SUMMON].includes(this.state)) {
        if (this.actionTimer <= 0) {
            this.isAttacking = false;
            this.state = FighterState.IDLE;
            // Reset combo if idle for too long? 
            // Simplified: we only increment on press, reset is not strictly needed as it loops 0,1,2
        }
    }
    else if (![FighterState.BLOCK, FighterState.DODGE, FighterState.DEAD, FighterState.CROUCH].includes(this.state)) {
        if (this.velocity.y !== 0) {
            this.state = FighterState.JUMP;
        } else if (Math.abs(this.velocity.x) > 0.5) {
            this.state = FighterState.WALK;
        } else {
            this.state = FighterState.IDLE;
        }
    }
  }

  // --- Actions ---

  attemptJump() {
      this.jumpBuffer = 10;
  }

  crouch(isCrouching: boolean) {
      // Crouch is now effectively replaced by BLOCK in main logic, but keeping method if needed later
      const allowed = [FighterState.IDLE, FighterState.WALK, FighterState.CROUCH].includes(this.state);
      if (!allowed || !this.isGrounded) return;

      if (isCrouching) {
          this.state = FighterState.CROUCH;
          this.velocity.x = 0;
      } else {
          if (this.state === FighterState.CROUCH) this.state = FighterState.IDLE;
      }
  }

  dodge() {
      if (this.dodgeCooldown > 0 || this.state === FighterState.HURT || this.state === FighterState.DEAD) return;
      if (!this.isGrounded) return; // Only ground dodge

      this.state = FighterState.DODGE;
      this.dodgeTimer = DODGE_DURATION;
      this.dodgeCooldown = DODGE_COOLDOWN;
      // Dodge grants immediate invulnerability frame, effectively handled by state check in takeDamage
  }

  attack() {
    const canAttack = [FighterState.IDLE, FighterState.WALK, FighterState.JUMP, FighterState.CROUCH].includes(this.state);
    
    if (canAttack) {
        this.gainEnergy(2); // +2 on attack
        this.isAttacking = true;
        this.state = FighterState.ATTACK;
        this.actionTimer = 15; // Set duration for one swing
        
        // Manual frame step
        this.currentFrame = this.attackComboIndex;
        this.attackComboIndex = (this.attackComboIndex + 1) % 3;
        
        this.hitbox = { offset: { x: 50, y: 20 }, width: 80, height: 40 };
        
        if (this.isGrounded) {
             this.velocity.x = this.facing === 'right' ? 2 : -2;
        }
    }
  }

  triggerSkill() {
      // I key: Energy Ball with Startup
      const canSkill = [FighterState.IDLE, FighterState.WALK, FighterState.JUMP].includes(this.state);
      if (!canSkill) return;
      
      this.state = FighterState.SKILL;
      // Total animation lock 70 frames, startup 25 frames
      this.actionTimer = 70; 
      this.skillStartup = 25; 
      this.velocity.x = 0; 
  }

  private fireRangedSkill() {
      const dir = this.facing === 'right' ? 1 : -1;
      const startX = this.facing === 'right' 
        ? this.position.x + this.width 
        : this.position.x - 30;
        
      const createProj = (offsetY: number, offsetX: number): Projectile => ({
          id: Math.random().toString(36).substr(2, 9),
          ownerId: this.characterId,
          type: 'energy',
          x: startX + (dir * offsetX),
          y: this.position.y + this.height / 2 + offsetY - 15,
          startX: startX + (dir * offsetX),
          velocity: { x: dir * 9, y: 0 },
          width: 30,
          height: 30,
          color: this.color,
          damage: 4, 
          facing: dir,
          createdAt: Date.now()
      });

      this.newProjectiles.push(createProj(0, 0));
      // Add slight delay to second projectile locally or just fire both?
      // Let's fire both but spaced out in space
      this.newProjectiles.push(createProj(0, -90));
  }

  triggerSummon(): Projectile | null {
    // Summon Clone (Instant)
    const canSummon = [FighterState.IDLE, FighterState.WALK].includes(this.state);
    if (!canSummon || this.energy < SUMMON_COST) return null;

    this.energy -= SUMMON_COST;
    this.state = FighterState.SUMMON;
    this.actionTimer = 25; 
    this.velocity.x = 0;

    const dir = this.facing === 'right' ? 1 : -1;
    const startX = this.facing === 'right' 
      ? this.position.x + this.width + 10
      : this.position.x - 80;

    return {
        id: Math.random().toString(36).substr(2, 9),
        ownerId: this.characterId,
        type: 'clone',
        x: startX,
        y: this.position.y,
        startX: startX,
        velocity: { x: dir * 9, y: 0 },
        width: this.width,
        height: this.height,
        color: this.color,
        damage: 12, 
        facing: dir,
        createdAt: Date.now()
    };
  }

  block(isBlocking: boolean) {
    // Block condition: Grounded, not acting
    if (this.state === FighterState.HURT || this.state === FighterState.DEAD || this.state === FighterState.ATTACK || this.state === FighterState.ULTIMATE || this.state === FighterState.SKILL || this.state === FighterState.SUMMON || this.state === FighterState.DODGE || !this.isGrounded) return;
    
    if (isBlocking) {
        if (this.energy > 0) {
            this.state = FighterState.BLOCK;
            this.velocity.x = 0; 
        }
    } else {
        if (this.state === FighterState.BLOCK) {
            this.state = FighterState.IDLE;
        }
    }
  }

  teleport() {
      const canTeleport = [FighterState.IDLE, FighterState.WALK, FighterState.JUMP].includes(this.state);
      if (!canTeleport) return;

      const distance = 250;
      const targetX = this.position.x + (this.facing === 'right' ? distance : -distance);
      this.position.x = Math.max(0, Math.min(WORLD_WIDTH - this.width, targetX));
      this.actionTimer = 5; 
  }

  ultimate() {
    const canUlt = [FighterState.IDLE, FighterState.WALK, FighterState.JUMP].includes(this.state);
    if (!canUlt || this.energy < 100) return; // Must have 100% (cost 100)

    this.energy -= 100; // Deduct cost
    this.isAttacking = true;
    this.state = FighterState.ULTIMATE;
    this.actionTimer = 50; 
    this.hitbox = { offset: { x: -60, y: -60 }, width: 220, height: 220 };
  }

  gainEnergy(amount: number) {
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
  }

  takeDamage(amount: number) {
    // Invulnerability checks
    if (this.state === FighterState.DEAD || this.state === FighterState.DODGE || this.invulnerabilityTimer > 0) return;

    if (this.state === FighterState.BLOCK) {
        this.gainEnergy(ENERGY_GAIN_BLOCK); // +3 on block
        this.health -= Math.max(1, Math.floor(amount * 0.1)); // Chip damage (10% damage, 90% blocked)
        this.actionTimer = 5; 
        // Block pushback
        const knockbackDir = this.facing === 'right' ? -1 : 1;
        this.velocity.x = knockbackDir * 4;
    } else {
        this.health -= amount;
        this.gainEnergy(ENERGY_GAIN_TAKE_HIT); // +1 on hit

        // Juggle Logic
        if (!this.isGrounded) {
            this.airDamageTaken += amount;
        }
        
        // Interrupt Skill Startup
        if (this.state === FighterState.SKILL) {
            this.skillStartup = 0;
        }

        this.state = FighterState.HURT;
        this.hurtTimer = 35; 

        // Knockback physics
        const knockbackDir = this.facing === 'right' ? -1 : 1;
        this.velocity.x = knockbackDir * 4; 
        this.velocity.y = -6; 
        this.isGrounded = false;
        
        this.isAttacking = false;

        // Juggle Cap Protection
        if (this.airDamageTaken >= JUGGLE_DAMAGE_CAP) {
            // Force landing
            this.velocity.y = 15; // Slam down
            this.hurtTimer = 60; // Long knockdown
            this.invulnerabilityTimer = 60; // Invulnerable on way down
        }
    }
    
    if (this.health <= 0) {
      this.health = 0;
      this.state = FighterState.DEAD;
    }
  }
}
