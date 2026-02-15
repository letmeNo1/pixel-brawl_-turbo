
import { FighterState, Position, Velocity, Hitbox, Platform, Projectile } from './types';
import { 
  GRAVITY, GROUND_Y, FIGHTER_WIDTH, FIGHTER_HEIGHT, WORLD_WIDTH,
  MAX_ENERGY, ULT_COST, SKILL_COST,
  ENERGY_GAIN_HIT, ENERGY_GAIN_TAKE_HIT, ENERGY_GAIN_BLOCK, BLOCK_DRAIN_RATE,
  DODGE_DURATION, DODGE_COOLDOWN, JUGGLE_DAMAGE_CAP, WAKEUP_INVULNERABILITY,
  CHARACTER_ANIMATIONS
} from './constants';
import { soundManager } from './SoundManager';
import { AssetManager } from './AssetManager';

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
          this.isAttacking = false;
      }
      
      // Reset combo step if leaving attack
      if (newState !== FighterState.ATTACK) {
          this.attackComboStep = 0;
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
  attackComboStep: number = 0; // 0=None, 1=First(Frame 0-1), 2=Second(Frame 2-3)
  
  // Timers & Mechanics
  actionTimer: number = 0;
  hurtTimer: number = 0;
  dodgeTimer: number = 0;
  dodgeCooldown: number = 0;
  attackCooldown: number = 0; // New: Cooldown between attacks
  blockTimer: number = 0; // Keeping for legacy reference or future use
  invulnerabilityTimer: number = 0; // Wakeup protection
  
  // New: Guard Mechanics
  accumulatedBlockDamage: number = 0;

  // Skill Mechanics
  skillStartup: number = 0;
  newProjectiles: Projectile[] = [];

  // Physics
  isGrounded: boolean = false;
  jumpBuffer: number = 0;
  jumpCount: number = 0; // Track jumps for double jump logic
  airDamageTaken: number = 0; // Juggle protection
  
  hitbox: Hitbox = { offset: { x: 0, y: 0 }, width: 0, height: 0 };
  
  // Visual Effects
  hitMarker: { x: number, y: number, rotation: number, scale: number } | null = null;

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
    console.log(`[Fighter] Init loadSprites for: ${this.characterId}`);

    Object.entries(CHARACTER_ANIMATIONS).forEach(([key, count]) => {
      const images: HTMLImageElement[] = [];
      if (count > 1) {
        for (let i = 1; i <= count; i++) {
            const path = `/assets/characters/${this.characterId}/${key}${i}.png?v=${this.assetTimestamp}`;
            // Try getting from AssetManager cache first
            let img = AssetManager.getImage(path);
            if (!img) {
                // Fallback to loading directly if not in cache (shouldn't happen with preload)
                img = new Image();
                img.src = path;
            }
            images.push(img);
        }
      } else {
        const path = `/assets/characters/${this.characterId}/${key}.png?v=${this.assetTimestamp}`;
        let img = AssetManager.getImage(path);
        if (!img) {
            img = new Image();
            img.src = path;
        }
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
        // Change color based on accumulation
        const guardStress = Math.min(1, this.accumulatedBlockDamage / 200);
        ctx.fillStyle = `rgba(${59 + (200 * guardStress)}, ${130 - (100 * guardStress)}, 246, 0.3)`; 
        
        // Lower the block shield for crouch height
        const blockH = this.height * 0.7; 
        const blockY = -this.height/2 + (this.height * 0.3);
        ctx.fillRect(-this.width/2 - 10, blockY - 10, this.width + 20, blockH + 20);
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 3;
        ctx.strokeRect(-this.width/2 - 10, blockY - 10, this.width + 20, blockH + 20);
    }

    if (this.state === FighterState.ULTIMATE) {
      ctx.shadowBlur = 30;
      ctx.shadowColor = this.color;
    }
    
    // Skill charging visual
    if (this.skillStartup > 0 && this.state === FighterState.SKILL) {
        ctx.shadowBlur = 10 + (45 - this.skillStartup); // Increasing glow
        ctx.shadowColor = '#fbbf24';
    }

    let spriteKey = 'idle';
    let currentFramesHold = 20; // Default slower speed

    switch (this.state) {
        case FighterState.WALK: spriteKey = 'run'; currentFramesHold = 15; break;
        case FighterState.JUMP: spriteKey = 'jump'; break;
        case FighterState.ATTACK: spriteKey = 'attack'; currentFramesHold = 8; break; // Fast attack animation
        case FighterState.ULTIMATE: spriteKey = 'ultimate'; currentFramesHold = 18; break;
        case FighterState.HURT: spriteKey = 'hurt'; break;
        case FighterState.DEAD: spriteKey = 'hurt'; break;
        case FighterState.BLOCK: spriteKey = 'crouch'; break; // Use crouch sprite for block
        case FighterState.SKILL: spriteKey = 'skill'; currentFramesHold = 20; break;
        case FighterState.CROUCH: spriteKey = 'crouch'; break;
        case FighterState.DODGE: spriteKey = 'run'; break; // Reuse run for dodge visual
        default: spriteKey = 'idle';
    }

    let spriteData = this.sprites[spriteKey];
    
    // Fallbacks
    let isCrouchFallback = false;
    
    if (spriteKey === 'block' && this.isMissing(spriteData)) spriteData = this.sprites['idle'];
    if (spriteKey === 'skill' && this.isMissing(spriteData)) spriteData = this.sprites['attack'];
    if (spriteKey === 'crouch' && this.isMissing(spriteData)) {
        spriteData = this.sprites['idle']; // Fallback crouch
        isCrouchFallback = true;
    }

    const frames = spriteData ? spriteData.images : [];
    const totalFrames = frames.length;

    if (totalFrames > 1) {
        this.framesElapsed++;

        if (this.state === FighterState.ATTACK) {
             // Custom Attack Animation Logic
             if (this.framesElapsed % currentFramesHold === 0) {
                 if (this.attackComboStep === 1) {
                     // Combo 1: Frames 0 -> 1
                     if (this.currentFrame < 1) {
                         this.currentFrame++;
                     }
                 } else if (this.attackComboStep === 2) {
                     // Combo 2: Frames 2 -> 3
                     if (this.currentFrame < 3) {
                         this.currentFrame++;
                     }
                 }
             }
        } else {
             // Standard cycling
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
             
             // Adjust for Crouch (squash effect) only if falling back to idle
             if ((this.state === FighterState.CROUCH || this.state === FighterState.BLOCK) && isCrouchFallback) {
                const squashFactor = 0.7;
                drawH *= squashFactor;
                drawY += this.height * 0.3; // Visual shift down
             }
        } else {
            // --- LEGACY FALLBACK LOGIC ---
            // Crouch visual adjustment if reusing idle sprite
            if ((this.state === FighterState.CROUCH || this.state === FighterState.BLOCK) && isCrouchFallback) {
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
        
    } else {
        // Fallback rectangle
        ctx.fillStyle = this.state === FighterState.HURT ? '#fff' : this.color;
        let h = this.height;
        let y = -this.height / 2;
        if (this.state === FighterState.CROUCH || this.state === FighterState.BLOCK) { h *= 0.6; y += this.height * 0.4; }
        ctx.fillRect(-this.width / 2, y, this.width, h);
    }

    // NEW: Red Arc Damage Visual
    if (this.state === FighterState.HURT && this.hitMarker) {
        ctx.save();
        // Since we are already translated to center + shake, we move by hitMarker offset
        // hitMarker coordinates are relative to the fighter's center (0,0 here)
        ctx.translate(this.hitMarker.x, this.hitMarker.y);
        ctx.rotate(this.hitMarker.rotation);
        ctx.scale(this.hitMarker.scale, this.hitMarker.scale);

        ctx.beginPath();
        // Draw a simple arc/slash
        ctx.arc(0, 0, 30, Math.PI * 0.2, Math.PI * 0.8);
        
        ctx.lineCap = 'round';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff0000';
        ctx.strokeStyle = '#ef4444'; // Bright Red
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.restore();
    }

    ctx.restore(); 

    if (this.state === FighterState.BLOCK) {
        ctx.save();
        ctx.fillStyle = '#60a5fa';
        ctx.font = '10px "Press Start 2P"';
        ctx.textAlign = 'center';
        // Lower text slightly
        ctx.fillText('BLOCK', this.position.x + this.width/2, this.position.y - 10);
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
    if (this.attackCooldown > 0) this.attackCooldown--;

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

    // Guard Damage Decay (Recover when not blocking)
    if (this.state !== FighterState.BLOCK && this.accumulatedBlockDamage > 0) {
        this.accumulatedBlockDamage = Math.max(0, this.accumulatedBlockDamage - 0.5);
    }
    
    // Reset block timer logic (Removed old 3s check)
    if (this.state !== FighterState.BLOCK) {
        this.blockTimer = 0;
    }

    // Jump Buffer & Logic
    if (this.jumpBuffer > 0) {
        this.jumpBuffer--;
        const lockedStates = [FighterState.HURT, FighterState.DEAD, FighterState.SKILL, FighterState.ULTIMATE];
        
        if (!lockedStates.includes(this.state)) {
            if (this.isGrounded) {
                // Ground Jump
                this.velocity.y = -17;
                this.isGrounded = false;
                this.jumpBuffer = 0;
                this.state = FighterState.JUMP;
                this.jumpCount = 1;
                soundManager.playJump();
            } else if (this.jumpCount < 2) {
                // Double Jump
                this.velocity.y = -13; // Slightly lower velocity for air jump
                this.jumpCount = 2;
                this.jumpBuffer = 0;
                soundManager.playJump();
                
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
    else if ([FighterState.ATTACK, FighterState.SKILL, FighterState.ULTIMATE].includes(this.state)) {
        if (this.actionTimer <= 0) {
            this.isAttacking = false;
            this.state = FighterState.IDLE;
            this.attackComboStep = 0; // Reset Combo
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
    // Check chain condition first
    const canChain = this.state === FighterState.ATTACK && this.attackComboStep === 1 && this.actionTimer > 0;
    
    // Block if cooldown active AND we cannot chain
    if (!canChain && this.attackCooldown > 0) return;

    const allowedStates = [FighterState.IDLE, FighterState.WALK, FighterState.JUMP, FighterState.CROUCH];
    
    if (allowedStates.includes(this.state)) {
        this.performAttack(1);
    } else if (canChain) {
        this.performAttack(2);
    }
  }

  private performAttack(step: number) {
      soundManager.playAttack();
      this.gainEnergy(2); 
      this.isAttacking = true;
      this.state = FighterState.ATTACK;
      this.attackComboStep = step;
      
      // Step 1: Start at frame 0 (play 0->1)
      // Step 2: Start at frame 2 (play 2->3)
      this.currentFrame = step === 1 ? 0 : 2;
      this.framesElapsed = 0;
      
      this.actionTimer = 18; // Shortened from 25 for faster recovery
      this.attackCooldown = 30; // Add delay before next attack can start
      this.hitbox = { offset: { x: 40, y: 20 }, width: 50, height: 40 }; // Narrower Hitbox
      
      // Reset isAttacking to true to allow damage re-check in main loop if it was cleared by a previous hit
      this.isAttacking = true;

      if (this.isGrounded) {
           this.velocity.x = this.facing === 'right' ? 2 : -2;
      }
  }

  triggerSkill() {
      // I key: Energy Ball with Startup
      const canSkill = [FighterState.IDLE, FighterState.WALK, FighterState.JUMP].includes(this.state);
      if (!canSkill) return;
      
      this.state = FighterState.SKILL;
      // Total animation lock 50 frames, startup 25 frames (Faster)
      this.actionTimer = 50; 
      this.skillStartup = 25; 
      this.velocity.x = 0; 
  }

  private fireRangedSkill() {
      soundManager.playSkill();
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

  block(isBlocking: boolean) {
    // Block condition: Grounded, not acting
    if (this.state === FighterState.HURT || this.state === FighterState.DEAD || this.state === FighterState.ATTACK || this.state === FighterState.ULTIMATE || this.state === FighterState.SKILL || this.state === FighterState.DODGE || !this.isGrounded) return;
    
    if (isBlocking) {
        // Removed: if (this.energy > 0)
        this.state = FighterState.BLOCK;
        this.velocity.x = 0; 
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
    // Only allow ult if in neutral states
    const canUlt = [FighterState.IDLE, FighterState.WALK, FighterState.JUMP].includes(this.state);
    
    if (!canUlt || this.energy < 100) return; // Must have 100% (cost 100)

    this.energy -= 100; // Deduct cost
    
    // Set state
    this.state = FighterState.ULTIMATE;
    this.actionTimer = 60; // Lock for 1 second while beam fires
    this.velocity.x = 0; // Stop movement
    this.velocity.y = 0; // Hover
    
    // Play sound
    soundManager.playUltimate();

    // Create BEAM Projectile
    const dir = this.facing === 'right' ? 1 : -1;
    const beamLength = 2000; // Extremely long to cover screen
    const beamHeight = 100;
    
    // Center X of beam relative to player
    // Start slightly in front of player
    const startOffset = 40;
    const originX = this.position.x + (this.width / 2) + (dir * startOffset);
    // Center of the beam rect
    const centerX = originX + (dir * (beamLength / 2));
    
    this.newProjectiles.push({
        id: Math.random().toString(36).substr(2, 9),
        ownerId: this.characterId,
        type: 'beam',
        x: centerX,
        y: this.position.y + (this.height / 2) - 10, // Adjust height to chest level
        startX: this.position.x,
        velocity: { x: 0, y: 0 }, // Stationary beam
        width: beamLength,
        height: beamHeight,
        color: this.color, 
        damage: 25, 
        facing: dir,
        createdAt: Date.now(),
        hitTargets: [] // Initialize empty list of hit targets for this beam
    });
  }

  gainEnergy(amount: number) {
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
  }

  takeDamage(amount: number, type: 'melee' | 'ranged' | 'heavy' = 'melee') {
    // Invulnerability checks
    if (this.state === FighterState.DEAD || this.state === FighterState.DODGE || this.invulnerabilityTimer > 0) return;

    if (this.state === FighterState.BLOCK) {
        // 1. Accumulate Block Damage
        this.accumulatedBlockDamage += amount;

        // 2. Check Threshold (200% of 100 HP = 200)
        if (this.accumulatedBlockDamage > 200) { 
             soundManager.playGuardBreak();
             
             // Guard Broken: Take Full Damage + Stun
             this.health -= amount;
             this.gainEnergy(ENERGY_GAIN_TAKE_HIT);
             this.state = FighterState.HURT;
             this.hurtTimer = 60; // Long stun
             this.accumulatedBlockDamage = 0; // Reset
             
             // Visuals for break
             this.hitMarker = {
                x: 0, y: 0, rotation: 0, scale: 1.5
            };
            const knockbackDir = this.facing === 'right' ? -1 : 1;
            this.velocity.x = knockbackDir * 5;
            this.velocity.y = -5;
            this.isGrounded = false;

        } else {
            // Successful Block
            soundManager.playBlock();
            this.gainEnergy(ENERGY_GAIN_BLOCK); 
            
            // Take 10% damage
            const reducedDamage = Math.floor(amount * 0.1); 
            if (reducedDamage > 0) this.health -= reducedDamage;

            this.actionTimer = 5; 
            const knockbackDir = this.facing === 'right' ? -1 : 1;
            this.velocity.x = knockbackDir * 4;
        }
    } else {
        if (type === 'ranged') {
            soundManager.playRangedHit();
        } else if (type === 'heavy') {
            soundManager.playHeavyHit();
        } else {
            soundManager.playHit();
        }

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

        // Generate Hit Marker (Random Red Slash Visual)
        // Position relative to center
        this.hitMarker = {
            x: (Math.random() - 0.5) * (this.width * 0.5),
            y: (Math.random() - 0.5) * (this.height * 0.5),
            rotation: (Math.random() * 2) - 1, // Random rotation
            scale: 0.8 + Math.random() * 0.4
        };

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
