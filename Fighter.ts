
import { FighterState, Position, Velocity, Hitbox, Platform, Projectile } from './types';
import { 
  GRAVITY, GROUND_Y, FIGHTER_WIDTH, FIGHTER_HEIGHT, WORLD_WIDTH,
  MAX_ENERGY, ULT_COST, SKILL_COST,
  ENERGY_GAIN_HIT, ENERGY_GAIN_TAKE_HIT, ENERGY_GAIN_BLOCK, BLOCK_DRAIN_RATE,
  DODGE_DURATION, DODGE_COOLDOWN, JUGGLE_DAMAGE_CAP, WAKEUP_INVULNERABILITY
} from './constants';
import { soundManager } from './SoundManager';
import { FighterRenderer } from './FighterRenderer';

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
  
  // Animation properties (Managed by Renderer but State stored here)
  currentFrame: number = 0;
  framesElapsed: number = 0;
  framesHold: number = 20; // Increased base frame hold to slow down animations
  
  // Renderer
  renderer: FighterRenderer;

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
    
    // Init Renderer
    this.renderer = new FighterRenderer(characterId, assetTimestamp);
  }

  // Set the actual character content boundaries within the image to auto-center
  setSpriteCropping(blX: number, blY: number, trX: number, trY: number) {
      this.spriteCrop = {
          bl: { x: blX, y: blY }, // Bottom-Left (x=min, y=max)
          tr: { x: trX, y: trY }  // Top-Right (x=max, y=min)
      };
  }

  draw(ctx: CanvasRenderingContext2D, debug: boolean = false) {
    this.renderer.draw(ctx, this, debug);
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

    // Skill & Ultimate Startup Handling
    if (this.skillStartup > 0) {
        this.skillStartup--;
        if (this.skillStartup === 0) {
            // Fire projectiles when startup ends
            if (this.state === FighterState.SKILL) {
                this.fireRangedSkill();
            } else if (this.state === FighterState.ULTIMATE) {
                this.fireUltimateBeam();
            }
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
    const allowedStates = [FighterState.IDLE, FighterState.WALK, FighterState.JUMP, FighterState.CROUCH];
    // Allow chaining if already attacking and in step 1, provided the animation hasn't just ended
    const canChain = this.state === FighterState.ATTACK && this.attackComboStep === 1 && this.actionTimer > 0;
    
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
      
      this.actionTimer = 25; // Duration window for the attack
      this.hitbox = { offset: { x: 50, y: 20 }, width: 80, height: 40 };
      
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
      // Total animation lock 90 frames, startup 45 frames
      this.actionTimer = 90; 
      this.skillStartup = 45; 
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
      this.newProjectiles.push(createProj(0, -90));
  }

  block(isBlocking: boolean) {
    // Block condition: Grounded, not acting
    if (this.state === FighterState.HURT || this.state === FighterState.DEAD || this.state === FighterState.ATTACK || this.state === FighterState.ULTIMATE || this.state === FighterState.SKILL || this.state === FighterState.DODGE || !this.isGrounded) return;
    
    if (isBlocking) {
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
    const canUlt = [FighterState.IDLE, FighterState.WALK, FighterState.JUMP].includes(this.state);
    if (!canUlt || this.energy < 100) return; // Must have 100% (cost 100)

    this.energy -= 100; // Deduct cost
    this.state = FighterState.ULTIMATE;
    this.actionTimer = 60; // Longer lock for beam firing
    this.velocity.x = 0;
    this.skillStartup = 20; // Short startup before firing
    this.hitbox = { offset: { x: 0, y: 0 }, width: 0, height: 0 }; // No melee hitbox
  }

  private fireUltimateBeam() {
      soundManager.playUltimate();
      const dir = this.facing === 'right' ? 1 : -1;
      // Start nicely in front of the character (150px out + half width offset)
      const offset = 200; 
      const startX = this.position.x + (this.width / 2) + (dir * offset); 
      
      const beam: Projectile = {
          id: Math.random().toString(36),
          ownerId: this.characterId,
          type: 'beam',
          x: startX,
          y: this.position.y + this.height/2, // Center Y
          startX: startX,
          velocity: { x: dir * 25, y: 0 }, // Very fast
          width: 400, // Longer beam
          height: 80, // Thick
          color: this.color === '#3b82f6' ? '#93c5fd' : '#fca5a5',
          damage: 35, // High damage
          facing: dir,
          createdAt: Date.now()
      };
      this.newProjectiles.push(beam);
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
        if (this.state === FighterState.SKILL || this.state === FighterState.ULTIMATE) {
            this.skillStartup = 0;
            this.actionTimer = 0; // Cancel animation if hit during startup
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
