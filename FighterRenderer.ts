
import { FighterState, Position } from './types';
import type { Fighter } from './Fighter';

interface SpriteData {
  images: HTMLImageElement[];
}

export const SPRITE_MAPPINGS: Record<string, number> = {
  'idle': 1,
  'run': 5,
  'jump': 1,
  'attack': 4, // 4 frames for combo (Hit 1: 1-2, Hit 2: 3-4)
  'hurt': 1, 
  'block': 1, 
  'skill': 2, 
  'ultimate': 1,
  'crouch': 1 
};

export class FighterRenderer {
  sprites: Record<string, SpriteData> = {};
  characterId: string;
  assetTimestamp: number;

  constructor(characterId: string, assetTimestamp: number) {
    this.characterId = characterId;
    this.assetTimestamp = assetTimestamp;
    this.loadSprites();
  }

  private loadSprites() {
    console.log(`[FighterRenderer] Loading sprites for: ${this.characterId}`);

    Object.entries(SPRITE_MAPPINGS).forEach(([key, count]) => {
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

  draw(ctx: CanvasRenderingContext2D, fighter: Fighter, debug: boolean = false) {
    ctx.save();
    
    const centerX = fighter.position.x + fighter.width / 2;
    const centerY = fighter.position.y + fighter.height / 2;

    // Apply shake effect if hurt
    let shakeX = 0;
    let shakeY = 0;
    if (fighter.state === FighterState.HURT) {
      shakeX = (Math.random() - 0.5) * 10;
      shakeY = (Math.random() - 0.5) * 10;
    }

    ctx.translate(centerX + shakeX, centerY + shakeY);

    if (fighter.facing === 'left') {
        ctx.scale(-1, 1);
    }

    // Visual Feedback for Invulnerability (Wakeup/Dodge)
    if (fighter.invulnerabilityTimer > 0 || fighter.state === FighterState.DODGE) {
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 50) * 0.3;
    }

    if (fighter.state === FighterState.BLOCK) {
        // Change color based on accumulation
        const guardStress = Math.min(1, fighter.accumulatedBlockDamage / 200);
        ctx.fillStyle = `rgba(${59 + (200 * guardStress)}, ${130 - (100 * guardStress)}, 246, 0.3)`; 
        
        // Lower the block shield for crouch height
        const blockH = fighter.height * 0.7; 
        const blockY = -fighter.height/2 + (fighter.height * 0.3);
        ctx.fillRect(-fighter.width/2 - 10, blockY - 10, fighter.width + 20, blockH + 20);
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 3;
        ctx.strokeRect(-fighter.width/2 - 10, blockY - 10, fighter.width + 20, blockH + 20);
    }

    if (fighter.state === FighterState.ULTIMATE) {
      ctx.shadowBlur = 30 + (Math.random() * 20);
      ctx.shadowColor = fighter.color;
    }
    
    // Skill charging visual
    if (fighter.skillStartup > 0 && (fighter.state === FighterState.SKILL || fighter.state === FighterState.ULTIMATE)) {
        ctx.shadowBlur = 10 + (45 - fighter.skillStartup); // Increasing glow
        ctx.shadowColor = fighter.state === FighterState.ULTIMATE ? '#ef4444' : '#fbbf24';
    }

    let spriteKey = 'idle';
    let currentFramesHold = 20; // Default slower speed

    switch (fighter.state) {
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
        fighter.framesElapsed++;

        if (fighter.state === FighterState.ATTACK) {
             // Custom Attack Animation Logic
             if (fighter.framesElapsed % currentFramesHold === 0) {
                 if (fighter.attackComboStep === 1) {
                     // Combo 1: Frames 0 -> 1
                     if (fighter.currentFrame < 1) {
                         fighter.currentFrame++;
                     }
                 } else if (fighter.attackComboStep === 2) {
                     // Combo 2: Frames 2 -> 3
                     if (fighter.currentFrame < 3) {
                         fighter.currentFrame++;
                     }
                 }
             }
        } else {
             // Standard cycling
             if (fighter.framesElapsed % currentFramesHold === 0) {
                fighter.currentFrame = (fighter.currentFrame + 1) % totalFrames;
            }
        }
    } else {
        fighter.currentFrame = 0;
    }

    const currentImage = frames[fighter.currentFrame % totalFrames]; // Safety mod
    const isSpriteLoaded = currentImage && currentImage.complete && currentImage.naturalWidth > 0;

    if (isSpriteLoaded) {
        let drawX = -fighter.width / 2;
        let drawY = -fighter.height / 2;
        let drawW = fighter.width;
        let drawH = fighter.height;

        // --- SMART CROPPING LOGIC ---
        if (fighter.spriteCrop) {
             const { bl, tr } = fighter.spriteCrop;
             const contentW = Math.abs(tr.x - bl.x) || 1; 
             const contentH = Math.abs(bl.y - tr.y) || 1;
             
             const contentCX = (bl.x + tr.x) / 2;
             const contentCY = (bl.y + tr.y) / 2;

             const scaleX = fighter.width / contentW;
             const scaleY = fighter.height / contentH;
             
             drawW = currentImage.width * scaleX;
             drawH = currentImage.height * scaleY;
             
             drawX = -contentCX * scaleX;
             drawY = -contentCY * scaleY;
             
             if ((fighter.state === FighterState.CROUCH || fighter.state === FighterState.BLOCK) && isCrouchFallback) {
                const squashFactor = 0.7;
                drawH *= squashFactor;
                drawY += fighter.height * 0.3; 
             }
        } else {
            // --- LEGACY FALLBACK LOGIC ---
            if ((fighter.state === FighterState.CROUCH || fighter.state === FighterState.BLOCK) && isCrouchFallback) {
                drawH = fighter.height * 0.7;
                drawY = -fighter.height / 2 + (fighter.height * 0.3);
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
        ctx.fillStyle = fighter.state === FighterState.HURT ? '#fff' : fighter.color;
        let h = fighter.height;
        let y = -fighter.height / 2;
        if (fighter.state === FighterState.CROUCH || fighter.state === FighterState.BLOCK) { h *= 0.6; y += fighter.height * 0.4; }
        ctx.fillRect(-fighter.width / 2, y, fighter.width, h);
    }

    // Red Arc Damage Visual
    if (fighter.state === FighterState.HURT && fighter.hitMarker) {
        ctx.save();
        ctx.translate(fighter.hitMarker.x, fighter.hitMarker.y);
        ctx.rotate(fighter.hitMarker.rotation);
        ctx.scale(fighter.hitMarker.scale, fighter.hitMarker.scale);

        ctx.beginPath();
        ctx.arc(0, 0, 30, Math.PI * 0.2, Math.PI * 0.8);
        
        ctx.lineCap = 'round';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff0000';
        ctx.strokeStyle = '#ef4444'; 
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.restore();
    }

    ctx.restore(); 

    if (fighter.state === FighterState.BLOCK) {
        ctx.save();
        ctx.translate(centerX + shakeX, centerY + shakeY);
        
        ctx.fillStyle = '#60a5fa';
        ctx.font = '10px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('BLOCK', 0, -fighter.height/2 - 10);
        ctx.restore();
    }

    // DEBUG: Draw Hitboxes and Hurtboxes
    if (debug) {
        ctx.save();
        // 1. HURTBOX (Body physics box) - RED
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(fighter.position.x, fighter.position.y, fighter.width, fighter.height);
        
        // 2. HITBOX (Active Attack) - YELLOW
        if ((fighter.state === FighterState.ATTACK) && fighter.hitbox.width > 0) {
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
            ctx.lineWidth = 2;
            
            // Calculate world space hitbox based on facing
            const hbX = fighter.facing === 'right' 
                ? fighter.position.x + fighter.hitbox.offset.x 
                : fighter.position.x - fighter.hitbox.width + (fighter.width - fighter.hitbox.offset.x);
            
            ctx.strokeRect(hbX, fighter.position.y + fighter.hitbox.offset.y, fighter.hitbox.width, fighter.hitbox.height);
        }
        ctx.restore();
    }
  }

  private isMissing(data: SpriteData | undefined) {
      return !data || data.images.length === 0 || !data.images[0].complete;
  }
}
