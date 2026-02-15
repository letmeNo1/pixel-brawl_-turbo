
import { GoogleGenAI } from "@google/genai";
import React, { useEffect, useRef, useState } from 'react';
import { Fighter } from '../Fighter';
import { HUD } from './HUD';
import { TouchControls } from './TouchControls';
import { 
  CANVAS_HEIGHT, 
  CANVAS_WIDTH, 
  GROUND_Y, 
  P1_KEYS, 
  P2_KEYS, 
  PLATFORMS, 
  WORLD_WIDTH,
  WINS_NEEDED,
  ROUND_TIME,
  MAX_ENERGY,
  SPRITE_CROP_CONFIG
} from '../constants';
import { FighterState, GameMode, Projectile } from '../types';

interface GameProps {
  mode: GameMode;
  username: string;
  opponentName: string;
  onBackToMenu: () => void;
  isMobile: boolean;
  isLandscape: boolean;
}

export const Game: React.FC<GameProps> = ({ mode, username, opponentName, onBackToMenu, isMobile, isLandscape }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State
  const [winner, setWinner] = useState<string | null>(null);
  const [p1Health, setP1Health] = useState(100);
  const [p2Health, setP2Health] = useState(100);
  const [p1Energy, setP1Energy] = useState(0);
  const [p2Energy, setP2Energy] = useState(0);
  const [p1Wins, setP1Wins] = useState(0);
  const [p2Wins, setP2Wins] = useState(0);
  const [roundTimer, setRoundTimer] = useState(ROUND_TIME);
  const [currentRound, setCurrentRound] = useState(1);
  const [showRoundMessage, setShowRoundMessage] = useState(false);
  const [geminiQuote, setGeminiQuote] = useState<string>("");
  
  // Refs
  const fightersRef = useRef<{ p1: Fighter; p2: Fighter } | null>(null);
  const projectilesRef = useRef<Projectile[]>([]);
  const keysPressed = useRef<Set<string>>(new Set());
  const cameraX = useRef(WORLD_WIDTH / 2);
  const cameraY = useRef(GROUND_Y - 150);
  const cameraZoom = useRef(1);
  const timerIntervalRef = useRef<number | null>(null);
  const joystickRef = useRef<{active: boolean, startX: number, startY: number, currentX: number, currentY: number}>({ 
      active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 
  });
  const [joystickVisual, setJoystickVisual] = useState({ x: 0, y: 0 });
  const [assetVersion] = useState<number>(Date.now());
  const [debugMode] = useState(false);

  // Initialize Round
  useEffect(() => {
    resetRound(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  const resetRound = (keepScore = true) => {
    const midWorld = WORLD_WIDTH / 2;
    const p1 = new Fighter(midWorld - 300, '#3b82f6', 'right', 'user1', assetVersion);
    const p2 = new Fighter(midWorld + 260, '#ef4444', 'left', 'user2', assetVersion);
    
    if (SPRITE_CROP_CONFIG.P1) {
        const c = SPRITE_CROP_CONFIG.P1;
        p1.setSpriteCropping(c.blX, c.blY, c.trX, c.trY);
    }
    if (SPRITE_CROP_CONFIG.P2) {
        const c = SPRITE_CROP_CONFIG.P2;
        p2.setSpriteCropping(c.blX, c.blY, c.trX, c.trY);
    }

    fightersRef.current = { p1, p2 };
    projectilesRef.current = [];
    cameraX.current = midWorld;
    cameraY.current = GROUND_Y - 150;
    cameraZoom.current = 1;
    
    setRoundTimer(ROUND_TIME);
    setShowRoundMessage(true);
    setTimeout(() => setShowRoundMessage(false), 2000);

    if (!keepScore) {
        setP1Wins(0);
        setP2Wins(0);
        setCurrentRound(1);
        setWinner(null);
        setGeminiQuote("");
    }
  };

  const fetchWinnerQuote = async (winnerName: string) => {
    if (!process.env.API_KEY || process.env.API_KEY === 'undefined' || process.env.API_KEY.includes('YOUR_API_KEY')) {
        setGeminiQuote("FIGHTING LEGEND!"); 
        return;
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `A character named ${winnerName} won a pixel fighting game. Write a 90s arcade style victory line (max 10 words).`
        });
        setGeminiQuote(response.text || "");
    } catch (e) {
        console.error("Gemini failed", e);
        setGeminiQuote("VICTORY!");
    }
  };

  const endMatch = (winnerName: string) => {
    setWinner(winnerName);
    fetchWinnerQuote(winnerName);
  };

  const handleRoundEnd = (winningPlayer: 'p1' | 'p2' | 'draw') => {
    let p1w = p1Wins;
    let p2w = p2Wins;

    if (winningPlayer === 'p1') p1w++;
    if (winningPlayer === 'p2') p2w++;

    setP1Wins(p1w);
    setP2Wins(p2w);

    if (p1w >= WINS_NEEDED) {
        endMatch(username);
    } else if (p2w >= WINS_NEEDED) {
        endMatch(opponentName);
    } else {
        // Next Round
        setCurrentRound(currentRound + 1);
        resetRound(true);
    }
  };

  const checkCollision = (f1: Fighter, f2: Fighter) => {
    if (!f1.isAttacking) return;
    const f1HitboxX = f1.facing === 'right' 
        ? f1.position.x + f1.hitbox.offset.x 
        : f1.position.x - f1.hitbox.width + (f1.width - f1.hitbox.offset.x);
    const f1HitboxY = f1.position.y + f1.hitbox.offset.y;
    if (
      f1HitboxX < f2.position.x + f2.width &&
      f1HitboxX + f1.hitbox.width > f2.position.x &&
      f1HitboxY < f2.position.y + f2.height &&
      f1HitboxY + f1.hitbox.height > f2.position.y
    ) {
      if (f1.hitbox.width > 0) {
        f2.takeDamage(3, 'melee');
        f1.isAttacking = false; 
      }
    }
  };

  const handleAI = (cpu: Fighter, player: Fighter) => {
    const dist = Math.abs(cpu.position.x - player.position.x);
    if (cpu.state === FighterState.DEAD) return;

    const cpuForward = cpu.position.x < player.position.x ? 'right' : 'left';

    if (player.isAttacking && dist < 120 && cpu.isGrounded && Math.random() < 0.6) {
        cpu.block(true);
        cpu.facing = cpuForward as 'right' | 'left'; 
        return;
    } else {
        cpu.block(false);
    }
    
    if (dist > 300 && Math.random() < 0.02) {
        cpu.triggerSkill(); 
    }

    if (![FighterState.HURT, FighterState.BLOCK, FighterState.SKILL, FighterState.ULTIMATE].includes(cpu.state)) {
        cpu.velocity.x = 0;
        if (dist > 150) {
            const moveSpeed = 5;
            cpu.velocity.x = cpuForward === 'right' ? moveSpeed : -moveSpeed;
            cpu.facing = cpuForward as 'right' | 'left';
        } else {
            cpu.facing = cpuForward as 'right' | 'left';
            const rand = Math.random();
            if (rand < 0.03) cpu.attack();
            else if (rand < 0.005 && cpu.energy >= 100) cpu.ultimate();
            else if (rand < 0.01) cpu.dodge();
        }
    }
    
    if (Math.random() < 0.01 && cpu.isGrounded && ![FighterState.HURT, FighterState.BLOCK, FighterState.SKILL, FighterState.ULTIMATE].includes(cpu.state)) {
      cpu.attemptJump();
    }
  };

  // Timer
  useEffect(() => {
    if (roundTimer > 0 && !winner) {
        const intervalId = window.setInterval(() => {
            setRoundTimer(prev => {
                if (prev <= 1) {
                    if (fightersRef.current) {
                        const { p1, p2 } = fightersRef.current;
                        if (p1.health > p2.health) handleRoundEnd('p1');
                        else if (p2.health > p1.health) handleRoundEnd('p2');
                        else handleRoundEnd('draw'); 
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        timerIntervalRef.current = intervalId as unknown as number;
    }
    return () => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [roundTimer, winner, p1Wins, p2Wins]); // Depend on wins to ensure updated closure

  // Game Loop
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    let animationFrameId: number;

    const loop = () => {
      if (!fightersRef.current) return;
      const { p1, p2 } = fightersRef.current;

      const lockedStates = [FighterState.HURT, FighterState.DEAD, FighterState.SKILL, FighterState.ULTIMATE];

      // P1 Input
      if (!lockedStates.includes(p1.state) && !winner) {
          const isHoldingLeft = keysPressed.current.has(P1_KEYS.LEFT);
          const isHoldingRight = keysPressed.current.has(P1_KEYS.RIGHT);
          const isHoldingDown = keysPressed.current.has(P1_KEYS.DOWN);
          
          p1.block(isHoldingDown);

          if (p1.state === FighterState.BLOCK) {
              p1.facing = p2.position.x < p1.position.x ? 'left' : 'right';
          }

          if (p1.state !== FighterState.BLOCK) {
            p1.velocity.x = 0;
            if (isHoldingLeft) { p1.velocity.x = -7; p1.facing = 'left'; }
            if (isHoldingRight) { p1.velocity.x = 7; p1.facing = 'right'; }
          }
      }
      
      // P2 Input / AI
      if (!winner) {
        if (mode === GameMode.PVP) {
            if (!lockedStates.includes(p2.state)) {
                const isHoldingLeft = keysPressed.current.has(P2_KEYS.LEFT);
                const isHoldingRight = keysPressed.current.has(P2_KEYS.RIGHT);
                const isHoldingDown = keysPressed.current.has(P2_KEYS.DOWN);

                p2.block(isHoldingDown);

                if (p2.state === FighterState.BLOCK) {
                    p2.facing = p1.position.x < p2.position.x ? 'left' : 'right';
                }

                if (p2.state !== FighterState.BLOCK) {
                    p2.velocity.x = 0;
                    if (isHoldingLeft) { p2.velocity.x = -7; p2.facing = 'left'; }
                    if (isHoldingRight) { p2.velocity.x = 7; p2.facing = 'right'; }
                }
            }
        } else {
            handleAI(p2, p1);
        }
      }

      p1.update(PLATFORMS);
      p2.update(PLATFORMS);

      if (p1.newProjectiles.length > 0) {
          projectilesRef.current.push(...p1.newProjectiles);
          p1.newProjectiles = [];
      }
      if (p2.newProjectiles.length > 0) {
          projectilesRef.current.push(...p2.newProjectiles);
          p2.newProjectiles = [];
      }

      // Projectiles Logic
      for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
        const p = projectilesRef.current[i];
        p.x += p.velocity.x;
        p.y += p.velocity.y;
        
        if (p.type === 'clone') {
            const age = Date.now() - p.createdAt;
            if (age > 800) { 
                projectilesRef.current.splice(i, 1);
                continue;
            }
        }

        const maxDist = p.type === 'beam' ? 3000 : 350; 
        if (p.type !== 'clone' && Math.abs(p.x - p.startX) > maxDist) {
             projectilesRef.current.splice(i, 1);
             continue;
        }

        if (p.x < -200 || p.x > WORLD_WIDTH + 200) {
            projectilesRef.current.splice(i, 1);
            continue;
        }

        const opponent = p.ownerId === p1.characterId ? p2 : p1;
        if (
            p.x + p.width/2 > opponent.position.x &&
            p.x - p.width/2 < opponent.position.x + opponent.width &&
            p.y + p.height/2 > opponent.position.y &&
            p.y - p.height/2 < opponent.position.y + opponent.height
        ) {
            if (opponent.state !== FighterState.DEAD && opponent.state !== FighterState.DODGE) {
                const dmgType = p.type === 'beam' ? 'heavy' : 'ranged';
                opponent.takeDamage(p.damage, dmgType);
                if (p.type === 'clone') opponent.velocity.x = (p.facing) * 8;
            }
            projectilesRef.current.splice(i, 1);
            continue;
        }
      }
      
      // Camera Logic
      const padding = 100;
      const fighterMidX = (p1.position.x + p2.position.x + p1.width) / 2;
      const fighterMidY = (p1.position.y + p2.position.y + p1.height) / 2;
      const requiredWidth = Math.abs(p1.position.x - p2.position.x) + p1.width + padding * 2;
      const requiredHeight = Math.abs(p1.position.y - p2.position.y) + p1.height + padding * 2;
      
      const targetZoomW = CANVAS_WIDTH / requiredWidth;
      const targetZoomH = CANVAS_HEIGHT / requiredHeight;
      const targetZoom = Math.max(CANVAS_WIDTH / WORLD_WIDTH, Math.min(1.0, targetZoomW, targetZoomH));

      cameraZoom.current += (targetZoom - cameraZoom.current) * 0.05;
      cameraX.current += (fighterMidX - cameraX.current) * 0.08;
      cameraY.current += (fighterMidY - cameraY.current) * 0.08;
      
      const zoomedWidth = CANVAS_WIDTH / cameraZoom.current;
      const zoomedHeight = CANVAS_HEIGHT / cameraZoom.current;
      if (zoomedWidth >= WORLD_WIDTH) cameraX.current = WORLD_WIDTH / 2;
      else cameraX.current = Math.max(zoomedWidth / 2, Math.min(WORLD_WIDTH - zoomedWidth / 2, cameraX.current));
      cameraY.current = Math.max(zoomedHeight / 2, Math.min(GROUND_Y + 100, cameraY.current));

      checkCollision(p1, p2);
      checkCollision(p2, p1);

      // Render
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.scale(cameraZoom.current, cameraZoom.current);
      ctx.translate(-cameraX.current, -cameraY.current);

      // Background
      ctx.save();
      ctx.fillStyle = '#1e293b';
      for(let i = -1; i < 6; i++) {
        const xPos = i * 1000 + cameraX.current * 0.2;
        ctx.beginPath();
        ctx.moveTo(xPos, GROUND_Y);
        ctx.lineTo(xPos + 500, GROUND_Y - 400);
        ctx.lineTo(xPos + 1000, GROUND_Y);
        ctx.fill();
      }
      ctx.restore();

      PLATFORMS.forEach(p => {
        ctx.fillStyle = '#475569';
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(p.x, p.y, p.width, 4);
      });
      ctx.fillStyle = '#334155';
      ctx.fillRect(-WORLD_WIDTH, GROUND_Y, WORLD_WIDTH * 3, 2000);
      
      p1.draw(ctx, debugMode);
      p2.draw(ctx, debugMode);

      // Draw Projectiles
      for (const p of projectilesRef.current) {
        if (p.type === 'clone') {
            ctx.save();
            ctx.globalAlpha = 0.6; 
            ctx.translate(p.x + p.width/2, p.y + p.height/2);
            if (p.facing === -1) ctx.scale(-1, 1);
            const owner = p.ownerId === p1.characterId ? p1 : p2;
            const spriteData = owner.renderer.sprites['attack']; 
            const img = spriteData?.images[0];
            if (img && img.complete && img.naturalWidth > 0) ctx.drawImage(img, -p.width/2, -p.height/2, p.width, p.height);
            else { ctx.fillStyle = p.color; ctx.fillRect(-p.width/2, -p.height/2, p.width, p.height); }
            ctx.restore();
        } else if (p.type === 'beam') {
            ctx.save();
            const flicker = Math.random() * 10;
            const beamHeight = p.height + flicker;
            
            ctx.shadowBlur = 30 + flicker;
            ctx.shadowColor = p.color;
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.width/2, p.y - beamHeight/2, p.width, beamHeight);
            
            ctx.shadowBlur = 10;
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(p.x - p.width/2, p.y - beamHeight/4, p.width, beamHeight/2);
            
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const segments = 10;
            const segWidth = p.width / segments;
            const startX = p.x - p.width/2;
            ctx.moveTo(startX, p.y);
            for(let j=0; j<=segments; j++) {
                ctx.lineTo(startX + j*segWidth, p.y + (Math.random() - 0.5) * beamHeight);
            }
            ctx.stroke();

            ctx.beginPath();
            const headX = p.facing === 1 ? p.x + p.width/2 : p.x - p.width/2;
            ctx.arc(headX, p.y, beamHeight/1.2, 0, Math.PI*2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(headX, p.y, beamHeight, 0, Math.PI*2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = 0.4;
            ctx.fill();
            
            ctx.restore();
        } else {
            ctx.save();
            ctx.beginPath();
            ctx.shadowBlur = 20; 
            ctx.shadowColor = p.color;
            ctx.fillStyle = '#ffffff'; 
            ctx.arc(p.x, p.y, p.width/2, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = p.color; 
            ctx.stroke();
            ctx.restore();
        }
      }

      setP1Health(p1.health);
      setP2Health(p2.health);
      setP1Energy(p1.energy);
      setP2Energy(p2.energy);

      if (!winner && (p1.health <= 0 || p2.health <= 0)) {
          if (p1.health <= 0) handleRoundEnd('p2');
          else handleRoundEnd('p1');
      }

      animationFrameId = requestAnimationFrame(loop);
    };
    loop();

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keysPressed.current.add(key);
      if (!fightersRef.current) return;
      const { p1, p2 } = fightersRef.current;
      
      if (!winner) {
          if (key === P1_KEYS.JUMP) p1.attemptJump();
          if (key === P1_KEYS.ATTACK) p1.attack();
          if (key === P1_KEYS.ULT) p1.ultimate();
          if (key === P1_KEYS.DODGE) p1.dodge();
          if (key === P1_KEYS.TELEPORT) p1.teleport();
          if (key === P1_KEYS.SKILL_RANGED) p1.triggerSkill();

          if (mode === GameMode.PVP) {
            if (key === P2_KEYS.JUMP) p2.attemptJump();
            if (key === P2_KEYS.ATTACK) p2.attack();
            if (key === P2_KEYS.ULT) p2.ultimate();
            if (key === P2_KEYS.DODGE) p2.dodge();
            if (key === P2_KEYS.TELEPORT) p2.teleport();
            if (key === P2_KEYS.SKILL_RANGED) p2.triggerSkill();
          }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keysPressed.current.delete(key);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [mode, roundTimer, p1Wins, p2Wins, currentRound, debugMode, username, opponentName, winner]);

  // Touch Handlers
  const handleJoystickStart = (e: React.TouchEvent) => {
      const touch = e.touches[0];
      joystickRef.current = {
          active: true,
          startX: touch.clientX,
          startY: touch.clientY,
          currentX: touch.clientX,
          currentY: touch.clientY
      };
      setJoystickVisual({ x: 0, y: 0 });
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
      if (!joystickRef.current.active) return;
      const touch = e.touches[0];
      const maxDist = 40;
      
      const dx = touch.clientX - joystickRef.current.startX;
      const dy = touch.clientY - joystickRef.current.startY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      const scale = Math.min(1, maxDist / (dist || 1));
      setJoystickVisual({ x: dx * scale, y: dy * scale });

      const deadzone = 10;
      if (dx < -deadzone) { keysPressed.current.add(P1_KEYS.LEFT); keysPressed.current.delete(P1_KEYS.RIGHT); }
      else if (dx > deadzone) { keysPressed.current.add(P1_KEYS.RIGHT); keysPressed.current.delete(P1_KEYS.LEFT); }
      else { keysPressed.current.delete(P1_KEYS.LEFT); keysPressed.current.delete(P1_KEYS.RIGHT); }

      if (dy > deadzone) { keysPressed.current.add(P1_KEYS.DOWN); keysPressed.current.delete(P1_KEYS.UP); }
      else if (dy < -deadzone) { keysPressed.current.add(P1_KEYS.UP); keysPressed.current.delete(P1_KEYS.DOWN); }
      else { keysPressed.current.delete(P1_KEYS.UP); keysPressed.current.delete(P1_KEYS.DOWN); }
  };

  const handleJoystickEnd = () => {
      joystickRef.current.active = false;
      setJoystickVisual({ x: 0, y: 0 });
      keysPressed.current.delete(P1_KEYS.LEFT);
      keysPressed.current.delete(P1_KEYS.RIGHT);
      keysPressed.current.delete(P1_KEYS.UP);
      keysPressed.current.delete(P1_KEYS.DOWN);
  };

  const handleBtnTouch = (key: string, isPress: boolean) => {
      if (isPress) {
          keysPressed.current.add(key);
          // Immediate triggers for visual response or state changes that don't rely on loop
          if(fightersRef.current) { 
              const { p1 } = fightersRef.current;
              if(key === P1_KEYS.JUMP) p1.attemptJump();
              if(key === P1_KEYS.ATTACK) p1.attack();
              if(key === P1_KEYS.ULT) p1.ultimate();
              if(key === P1_KEYS.DODGE) p1.dodge();
              if(key === P1_KEYS.TELEPORT) p1.teleport();
              if(key === P1_KEYS.SKILL_RANGED) p1.triggerSkill(); 
          }
      } else {
          keysPressed.current.delete(key);
      }
  };

  return (
    <div className="relative w-full h-full">
      <HUD 
        p1={{ name: username, health: p1Health, energy: p1Energy, wins: p1Wins }}
        p2={{ name: opponentName, health: p2Health, energy: p2Energy, wins: p2Wins }}
        timer={roundTimer}
        round={currentRound}
        isMobile={isMobile}
      />

      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="border-0 md:border-8 border-white/10 rounded-none md:rounded-lg shadow-2xl w-full h-full object-contain" />
      
      {isMobile && isLandscape && !winner && (
          <TouchControls 
             onJoystickStart={handleJoystickStart}
             onJoystickMove={handleJoystickMove}
             onJoystickEnd={handleJoystickEnd}
             joystickVisual={joystickVisual}
             joystickActive={joystickRef.current.active}
             onBtnTouch={handleBtnTouch}
          />
      )}

      {showRoundMessage && !winner && (
          <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
              <h1 className="text-4xl md:text-8xl font-black text-white drop-shadow-[0_10px_0_rgba(0,0,0,1)] animate-pulse tracking-tighter italic">ROUND {currentRound}</h1>
          </div>
      )}

      {winner && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-30 animate-in fade-in duration-500">
          <h2 className="text-4xl md:text-7xl font-black text-yellow-400 mb-4 uppercase tracking-widest skew-x-[-10deg] drop-shadow-[0_4px_0_#b45309] text-center">{winner} WINS!</h2>
          {geminiQuote && <div className="max-w-xl text-center mb-10 text-white text-sm md:text-xl font-mono italic px-8">"{geminiQuote}"</div>}
          <button onClick={onBackToMenu} className="pixel-border bg-white text-black px-12 py-6 text-xl font-bold tracking-widest hover:scale-105 transition-transform hover:bg-gray-200">RETURN TO MENU</button>
        </div>
      )}
    </div>
  );
};
