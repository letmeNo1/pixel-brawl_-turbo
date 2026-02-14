
import { GoogleGenAI } from "@google/genai";
import React, { useEffect, useRef, useState } from 'react';
import { Fighter } from './Fighter';
import { 
  CANVAS_HEIGHT, 
  CANVAS_WIDTH, 
  GROUND_Y, 
  P1_KEYS, 
  P2_KEYS, 
  PLATFORMS, 
  WORLD_WIDTH,
  MAX_ROUNDS,
  WINS_NEEDED,
  ROUND_TIME,
  MAX_ENERGY,
  SPRITE_CROP_CONFIG
} from './constants';
import { FighterState, GameMode, Projectile } from './types';

const App: React.FC = () => {
  const [mode, setMode] = useState<GameMode>(GameMode.MENU);
  const [winner, setWinner] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State
  const [p1Health, setP1Health] = useState(100);
  const [p2Health, setP2Health] = useState(100);
  const [p1Energy, setP1Energy] = useState(0);
  const [p2Energy, setP2Energy] = useState(0);
  
  // Round State
  const [p1Wins, setP1Wins] = useState(0);
  const [p2Wins, setP2Wins] = useState(0);
  const [roundTimer, setRoundTimer] = useState(ROUND_TIME);
  const [currentRound, setCurrentRound] = useState(1);
  const [showRoundMessage, setShowRoundMessage] = useState(false);

  // Debug State
  const [debugMode, setDebugMode] = useState(false);

  const [geminiQuote, setGeminiQuote] = useState<string>("");
  const [assetVersion, setAssetVersion] = useState<number>(Date.now());
  
  const fightersRef = useRef<{ p1: Fighter; p2: Fighter } | null>(null);
  const projectilesRef = useRef<Projectile[]>([]);
  const keysPressed = useRef<Set<string>>(new Set());
  
  const cameraX = useRef(WORLD_WIDTH / 2);
  const cameraY = useRef(GROUND_Y - 150);
  const cameraZoom = useRef(1);

  const debugFighterRef = useRef<Fighter | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  const resetRound = (keepScore = true) => {
    const midWorld = WORLD_WIDTH / 2;
    const p1 = new Fighter(midWorld - 300, '#3b82f6', 'right', 'user1', assetVersion);
    const p2 = new Fighter(midWorld + 260, '#ef4444', 'left', 'user2', assetVersion);
    
    // Apply Sprite Cropping Config from constants.ts
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
    }
  };

  const initGame = (selectedMode: GameMode) => {
    setMode(selectedMode);
    setWinner(null);
    setGeminiQuote("");
    resetRound(false); // Reset everything including score
  };

  const reloadAssets = () => {
    const newVersion = Date.now();
    setAssetVersion(newVersion);
    console.clear(); 
    console.log("Assets invalidated. New version:", newVersion);
    if (fightersRef.current) {
        fightersRef.current.p1.assetTimestamp = newVersion;
        fightersRef.current.p2.assetTimestamp = newVersion;
        fightersRef.current.p1.loadSprites();
        fightersRef.current.p2.loadSprites();
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
      let damage = 3; // Reduced from 5
      if (f1.state === FighterState.ULTIMATE) damage = 25; // Reduced from 35
      
      f2.takeDamage(damage);
      // Energy gain handled inside Fighter class now for attacking
      f1.isAttacking = false; 
    }
  };

  const handleAI = (cpu: Fighter, player: Fighter) => {
    const dist = Math.abs(cpu.position.x - player.position.x);
    if (cpu.state === FighterState.DEAD) return;

    // AI Block Logic
    const cpuBack = cpu.position.x < player.position.x ? 'left' : 'right';
    const cpuForward = cpu.position.x < player.position.x ? 'right' : 'left';

    // AI decides to block if player is attacking close by
    if (player.isAttacking && dist < 120 && cpu.isGrounded && Math.random() < 0.6) {
        cpu.block(true);
        return;
    } else {
        cpu.block(false);
    }
    
    // AI Projectile
    if (dist > 300 && Math.random() < 0.02) {
        cpu.triggerSkill(); // No return, internally queued
    }

    if (![FighterState.HURT, FighterState.BLOCK, FighterState.SKILL, FighterState.SUMMON].includes(cpu.state)) {
        cpu.velocity.x = 0;
        if (dist > 150) {
            // Walk towards
            cpu.velocity.x = cpuForward === 'right' ? 4.5 : -4.5;
            cpu.facing = cpuForward as 'right' | 'left';
        } else {
            // Close combat
            cpu.facing = cpuForward as 'right' | 'left';
            const rand = Math.random();
            if (rand < 0.03) cpu.attack();
            else if (rand < 0.005 && cpu.energy >= 100) cpu.ultimate();
            else if (rand < 0.01) cpu.dodge();
        }
    }
    
    if (Math.random() < 0.01 && cpu.isGrounded && ![FighterState.HURT, FighterState.BLOCK, FighterState.SKILL, FighterState.SUMMON].includes(cpu.state)) {
      cpu.attemptJump();
    }
  };

  const handleRoundEnd = (winningPlayer: 'p1' | 'p2' | 'draw') => {
      let p1w = p1Wins;
      let p2w = p2Wins;

      if (winningPlayer === 'p1') p1w++;
      if (winningPlayer === 'p2') p2w++;

      setP1Wins(p1w);
      setP2Wins(p2w);

      if (p1w >= WINS_NEEDED) {
          endMatch("PLAYER 1");
      } else if (p2w >= WINS_NEEDED) {
          const name = mode === GameMode.PVE ? "CPU" : "PLAYER 2";
          endMatch(name);
      } else {
          // Next Round
          setCurrentRound(currentRound + 1);
          resetRound(true);
      }
  };

  const endMatch = (winnerName: string) => {
      setWinner(winnerName);
      setMode(GameMode.GAMEOVER);
      fetchWinnerQuote(winnerName);
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
    }
  };

  // Timer Logic
  useEffect(() => {
      if ((mode === GameMode.PVP || mode === GameMode.PVE) && roundTimer > 0 && !winner) {
          timerIntervalRef.current = window.setInterval(() => {
              setRoundTimer(prev => {
                  if (prev <= 1) {
                      // Time Over Logic
                      if (fightersRef.current) {
                          const { p1, p2 } = fightersRef.current;
                          if (p1.health > p2.health) handleRoundEnd('p1');
                          else if (p2.health > p1.health) handleRoundEnd('p2');
                          else handleRoundEnd('draw'); // Draw logic, just replay round or give point to both? simple: replay
                      }
                      return 0;
                  }
                  return prev - 1;
              });
          }, 1000);
      }
      return () => {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      };
  }, [mode, roundTimer, winner, p1Wins, p2Wins]); // Dep dependencies critical

  useEffect(() => {
    if (mode === GameMode.MENU) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    let animationFrameId: number;

    const loop = () => {
      if (!fightersRef.current) return;
      const { p1, p2 } = fightersRef.current;

      const lockedStates = [FighterState.HURT, FighterState.DEAD, FighterState.SKILL, FighterState.SUMMON, FighterState.ULTIMATE];

      // P1 Input
      if (!lockedStates.includes(p1.state)) {
          const isHoldingLeft = keysPressed.current.has(P1_KEYS.LEFT);
          const isHoldingRight = keysPressed.current.has(P1_KEYS.RIGHT);
          const isHoldingDown = keysPressed.current.has(P1_KEYS.DOWN);
          
          // Block is now active on holding DOWN
          p1.block(isHoldingDown);

          // No movement while blocking
          if (p1.state !== FighterState.BLOCK) {
            p1.velocity.x = 0;
            if (isHoldingLeft) { p1.velocity.x = -7; p1.facing = 'left'; }
            if (isHoldingRight) { p1.velocity.x = 7; p1.facing = 'right'; }
          }
      }
      
      // P2 Input / AI
      if (mode === GameMode.PVP) {
        if (!lockedStates.includes(p2.state)) {
            const isHoldingLeft = keysPressed.current.has(P2_KEYS.LEFT);
            const isHoldingRight = keysPressed.current.has(P2_KEYS.RIGHT);
            const isHoldingDown = keysPressed.current.has(P2_KEYS.DOWN);

            // Block is now active on holding DOWN
            p2.block(isHoldingDown);

            if (p2.state !== FighterState.BLOCK) {
                p2.velocity.x = 0;
                if (isHoldingLeft) { p2.velocity.x = -7; p2.facing = 'left'; }
                if (isHoldingRight) { p2.velocity.x = 7; p2.facing = 'right'; }
            }
        }
      } else {
        handleAI(p2, p1);
      }

      p1.update(PLATFORMS);
      p2.update(PLATFORMS);

      // --- Collect New Projectiles ---
      if (p1.newProjectiles.length > 0) {
          projectilesRef.current.push(...p1.newProjectiles);
          p1.newProjectiles = [];
      }
      if (p2.newProjectiles.length > 0) {
          projectilesRef.current.push(...p2.newProjectiles);
          p2.newProjectiles = [];
      }
      // -------------------------------

      // --- Projectile Update Logic ---
      for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
        const p = projectilesRef.current[i];
        p.x += p.velocity.x;
        p.y += p.velocity.y;
        
        // Remove after distance/time
        if (p.type === 'clone') {
            const age = Date.now() - p.createdAt;
            if (age > 800) { 
                projectilesRef.current.splice(i, 1);
                continue;
            }
        }

        if (p.type === 'energy' && Math.abs(p.x - p.startX) > 550) {
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
                opponent.takeDamage(p.damage);
                if (p.type === 'clone') opponent.velocity.x = (p.facing) * 8;
            }
            projectilesRef.current.splice(i, 1);
            continue;
        }
      }
      
      // Camera
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

      // Rendering
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.scale(cameraZoom.current, cameraZoom.current);
      ctx.translate(-cameraX.current, -cameraY.current);

      // BG
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
      
      // Pass debugMode to draw method
      p1.draw(ctx, debugMode);
      p2.draw(ctx, debugMode);

      for (const p of projectilesRef.current) {
        if (p.type === 'clone') {
            ctx.save();
            ctx.globalAlpha = 0.6; 
            ctx.translate(p.x + p.width/2, p.y + p.height/2);
            if (p.facing === -1) ctx.scale(-1, 1);
            const owner = p.ownerId === p1.characterId ? p1 : p2;
            const spriteData = owner.sprites['attack']; 
            const img = spriteData?.images[0];
            if (img && img.complete && img.naturalWidth > 0) ctx.drawImage(img, -p.width/2, -p.height/2, p.width, p.height);
            else { ctx.fillStyle = p.color; ctx.fillRect(-p.width/2, -p.height/2, p.width, p.height); }
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

      // Match Logic
      if ((p1.health <= 0 || p2.health <= 0) && mode !== GameMode.GAMEOVER) {
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
      
      // P1
      if (key === P1_KEYS.JUMP) p1.attemptJump();
      if (key === P1_KEYS.ATTACK) p1.attack();
      if (key === P1_KEYS.ULT) p1.ultimate();
      if (key === P1_KEYS.DODGE) p1.dodge();
      if (key === P1_KEYS.TELEPORT) p1.teleport();
      if (key === P1_KEYS.SKILL_RANGED) { 
         p1.triggerSkill(); // Internal queue
      }
      if (key === P1_KEYS.SKILL2) { // Keeping legacy name for now
        const proj = p1.triggerSummon();
        if (proj) projectilesRef.current.push(proj);
      }

      // P2
      if (mode === GameMode.PVP) {
        if (key === P2_KEYS.JUMP) p2.attemptJump();
        if (key === P2_KEYS.ATTACK) p2.attack();
        if (key === P2_KEYS.ULT) p2.ultimate();
        if (key === P2_KEYS.DODGE) p2.dodge();
        if (key === P2_KEYS.TELEPORT) p2.teleport();
        if (key === P2_KEYS.SKILL_RANGED) { 
            p2.triggerSkill();
        }
        if (key === P2_KEYS.SKILL2) { // Legacy key mapping
            const proj = p2.triggerSummon();
            if (proj) projectilesRef.current.push(proj);
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
  }, [mode, roundTimer, p1Wins, p2Wins, currentRound, debugMode]); // Added debugMode dependency

  // Helper for Round Dots
  const renderRoundDots = (wins: number) => {
      return (
          <div className="flex gap-1">
              <div className={`w-3 h-3 rounded-full border border-white ${wins >= 1 ? 'bg-yellow-400' : 'bg-gray-800'}`}></div>
              <div className={`w-3 h-3 rounded-full border border-white ${wins >= 2 ? 'bg-yellow-400' : 'bg-gray-800'}`}></div>
          </div>
      );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      {mode === GameMode.MENU && (
        <div className="text-center z-10 flex flex-col gap-8 animate-in fade-in duration-700">
          <h1 className="text-7xl font-bold mb-4 tracking-tighter text-blue-500 italic drop-shadow-[0_8px_0_rgba(0,0,0,1)]">PIXEL BRAWL</h1>
          
          <div className="flex flex-col gap-4">
            <button onClick={() => initGame(GameMode.PVE)} className="pixel-border bg-blue-600 hover:bg-blue-500 px-8 py-5 text-xl transition-all">1P VS CPU</button>
            <button onClick={() => initGame(GameMode.PVP)} className="pixel-border bg-red-600 hover:bg-red-500 px-8 py-5 text-xl transition-all">1P VS 2P (LOCAL)</button>
          </div>
          
          <div className="flex justify-center">
            <button 
                onClick={() => setDebugMode(!debugMode)} 
                className={`pixel-border px-6 py-3 text-sm transition-all font-mono ${debugMode ? 'bg-yellow-600 text-white' : 'bg-gray-800 text-gray-400'}`}
            >
                [ DEBUG MODE: {debugMode ? 'ON' : 'OFF'} ]
            </button>
          </div>

          <div className="mt-8 text-[10px] text-gray-500 leading-relaxed uppercase space-y-2 opacity-80 text-left bg-gray-900 p-4 border border-gray-700">
            <div className="grid grid-cols-2 gap-8">
                <div>
                    <strong className="text-blue-400">P1 (WASD)</strong><br/>
                    Move: WASD<br/>
                    Actions: J(Atk) K(Jump)<br/>
                    Skills: I(Ball) L(Tele) O(Ult)<br/>
                    Block: S | Dodge: Space
                </div>
                <div>
                    <strong className="text-red-400">P2 (ARROWS)</strong><br/>
                    Move: Arrows<br/>
                    Actions: 1(Atk) 2(Jump)<br/>
                    Skills: 4(Ball) 3(Tele) 5(Ult)<br/>
                    Block: Down | Dodge: 0
                </div>
            </div>
          </div>
        </div>
      )}
      {(mode === GameMode.PVP || mode === GameMode.PVE || mode === GameMode.GAMEOVER) && (
        <div className="relative">
          <div className="absolute top-6 left-0 right-0 flex justify-between px-10 z-20 pointer-events-none items-start">
            {/* P1 HUD */}
            <div className="w-[40%] flex flex-col gap-1">
              <div className="text-xs flex justify-between items-end">
                  <span className="text-blue-400 font-bold text-lg">PLAYER 1</span>
                  {renderRoundDots(p1Wins)}
              </div>
              <div className="h-6 w-full bg-gray-900 border-2 border-white relative skew-x-[-15deg]">
                <div className="h-full bg-yellow-500 transition-all duration-75" style={{ width: `${p1Health}%` }} />
              </div>
              {/* Energy Bar */}
              <div className="h-2 w-[80%] bg-gray-800 border border-gray-600 mt-1 skew-x-[-15deg] relative">
                  <div className="h-full bg-blue-500 transition-all duration-75" style={{ width: `${(Math.min(MAX_ENERGY, p1Energy) / MAX_ENERGY) * 100}%` }} />
                  {/* Energy Dividers */}
                  <div className="absolute left-1/3 top-0 bottom-0 w-[1px] bg-black/50 z-10"></div>
                  <div className="absolute left-2/3 top-0 bottom-0 w-[1px] bg-black/50 z-10"></div>
              </div>
            </div>

            {/* Timer */}
            <div className="flex flex-col items-center justify-start -mt-2">
              <div className="text-5xl font-black text-white drop-shadow-md bg-gray-800 border-2 border-white px-4 py-2 rounded-lg">{roundTimer}</div>
              <div className="text-xs text-gray-400 mt-1">ROUND {currentRound}</div>
            </div>

            {/* P2 HUD */}
            <div className="w-[40%] text-right flex flex-col gap-1 items-end">
              <div className="text-xs flex justify-between items-end w-full flex-row-reverse">
                  <span className="text-red-400 font-bold text-lg">{mode === GameMode.PVE ? 'CPU' : 'PLAYER 2'}</span>
                  {renderRoundDots(p2Wins)}
              </div>
              <div className="h-6 w-full bg-gray-900 border-2 border-white relative skew-x-[15deg] flex justify-end">
                <div className="h-full bg-yellow-500 transition-all duration-75" style={{ width: `${p2Health}%` }} />
              </div>
               {/* Energy Bar */}
               <div className="h-2 w-[80%] bg-gray-800 border border-gray-600 mt-1 skew-x-[15deg] flex justify-end relative">
                  <div className="h-full bg-red-500 transition-all duration-75" style={{ width: `${(Math.min(MAX_ENERGY, p2Energy) / MAX_ENERGY) * 100}%` }} />
                   {/* Energy Dividers */}
                   <div className="absolute right-1/3 top-0 bottom-0 w-[1px] bg-black/50 z-10"></div>
                   <div className="absolute right-2/3 top-0 bottom-0 w-[1px] bg-black/50 z-10"></div>
              </div>
            </div>
          </div>

          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="border-8 border-white/10 rounded-lg shadow-2xl" />
          
          {showRoundMessage && !winner && (
              <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                  <h1 className="text-8xl font-black text-white drop-shadow-[0_10px_0_rgba(0,0,0,1)] animate-pulse">ROUND {currentRound}</h1>
              </div>
          )}

          {mode === GameMode.GAMEOVER && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-30">
              <h2 className="text-6xl font-black text-yellow-400 mb-4 uppercase tracking-widest skew-x-[-10deg]">{winner} WINS!</h2>
              {geminiQuote && <div className="max-w-xl text-center mb-10 text-white text-xl font-mono italic">"{geminiQuote}"</div>}
              <button onClick={() => setMode(GameMode.MENU)} className="pixel-border bg-white text-black px-10 py-5 text-xl transition-transform hover:scale-110">RETURN TO MENU</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
