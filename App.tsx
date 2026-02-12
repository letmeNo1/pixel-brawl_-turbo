
import { GoogleGenAI } from "@google/genai";
import React, { useEffect, useRef, useState } from 'react';
import { Fighter } from './Fighter';
import { 
  CANVAS_HEIGHT, 
  CANVAS_WIDTH, 
  GROUND_Y, 
  HIT_ENERGY_GAIN, 
  P1_KEYS, 
  P2_KEYS, 
  PLATFORMS, 
  WORLD_WIDTH 
} from './constants';
import { FighterState, GameMode } from './types';

const App: React.FC = () => {
  const [mode, setMode] = useState<GameMode>(GameMode.MENU);
  const [winner, setWinner] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [p1Health, setP1Health] = useState(100);
  const [p2Health, setP2Health] = useState(100);
  const [p1Energy, setP1Energy] = useState(0);
  const [p2Energy, setP2Energy] = useState(0);
  const [geminiQuote, setGeminiQuote] = useState<string>("");
  
  const fightersRef = useRef<{ p1: Fighter; p2: Fighter } | null>(null);
  const keysPressed = useRef<Set<string>>(new Set());
  
  const cameraX = useRef(WORLD_WIDTH / 2);
  const cameraY = useRef(GROUND_Y - 150);
  const cameraZoom = useRef(1);

  const initGame = (selectedMode: GameMode) => {
    const midWorld = WORLD_WIDTH / 2;
    // Pass character IDs instead of image objects
    // The Fighter class will look for /assets/user1_idle.png, etc.
    const p1 = new Fighter(midWorld - 200, '#3b82f6', 'right', 'user1');
    const p2 = new Fighter(midWorld + 140, '#ef4444', 'left', 'user2');
    fightersRef.current = { p1, p2 };
    cameraX.current = midWorld;
    cameraY.current = GROUND_Y - 150;
    cameraZoom.current = 1;
    setMode(selectedMode);
    setWinner(null);
    setGeminiQuote("");
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
      let damage = 8;
      if (f1.state === FighterState.ULTIMATE) damage = 45;
      f2.takeDamage(damage);
      f1.gainEnergy(HIT_ENERGY_GAIN);
      f1.isAttacking = false; 
    }
  };

  const handleAI = (cpu: Fighter, player: Fighter) => {
    const dist = Math.abs(cpu.position.x - player.position.x);
    if (cpu.state === FighterState.DEAD) return;
    if (cpu.state !== FighterState.CHARGING && cpu.state !== FighterState.HURT) {
        cpu.velocity.x = 0;
        if (dist > 150) {
            if (cpu.energy < 100 && Math.random() < 0.01) {
                cpu.charge(true);
            } else {
                if (cpu.position.x < player.position.x) {
                    cpu.velocity.x = 4.5;
                    cpu.facing = 'right';
                } else {
                    cpu.velocity.x = -4.5;
                    cpu.facing = 'left';
                }
            }
        } else {
            cpu.facing = cpu.position.x < player.position.x ? 'right' : 'left';
            const rand = Math.random();
            if (rand < 0.03) cpu.attack();
            else if (rand < 0.005 && cpu.energy >= 100) cpu.ultimate();
            else if (rand < 0.01 && dist < 50) cpu.teleport();
        }
    } else {
        if (dist < 120 || cpu.energy >= 300 || Math.random() < 0.005) {
            cpu.charge(false);
        }
    }
    // AI Jump Logic
    if (Math.random() < 0.01 && cpu.isGrounded && cpu.state !== FighterState.CHARGING && cpu.state !== FighterState.HURT) {
      cpu.attemptJump();
    }
  };

  const fetchWinnerQuote = async (winnerName: string) => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `A character named ${winnerName} won. Write a 90s arcade style victory line (max 10 words).`
        });
        setGeminiQuote(response.text || "");
    } catch (e) {
        console.error("Gemini failed", e);
    }
  };

  useEffect(() => {
    if (mode === GameMode.MENU) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    let animationFrameId: number;

    const loop = () => {
      if (!fightersRef.current) return;
      const { p1, p2 } = fightersRef.current;

      // P1 Input
      if (p1.state !== FighterState.CHARGING && p1.state !== FighterState.HURT && p1.state !== FighterState.DEAD) {
          p1.velocity.x = 0;
          if (keysPressed.current.has(P1_KEYS.LEFT)) { p1.velocity.x = -7; p1.facing = 'left'; }
          if (keysPressed.current.has(P1_KEYS.RIGHT)) { p1.velocity.x = 7; p1.facing = 'right'; }
      }
      // P2 Input / AI
      if (mode === GameMode.PVP) {
        if (p2.state !== FighterState.CHARGING && p2.state !== FighterState.HURT && p2.state !== FighterState.DEAD) {
            p2.velocity.x = 0;
            if (keysPressed.current.has(P2_KEYS.LEFT)) { p2.velocity.x = -7; p2.facing = 'left'; }
            if (keysPressed.current.has(P2_KEYS.RIGHT)) { p2.velocity.x = 7; p2.facing = 'right'; }
        }
      } else {
        handleAI(p2, p1);
      }

      p1.update(PLATFORMS);
      p2.update(PLATFORMS);

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
      
      if (zoomedWidth >= WORLD_WIDTH) {
        cameraX.current = WORLD_WIDTH / 2;
      } else {
        cameraX.current = Math.max(zoomedWidth / 2, Math.min(WORLD_WIDTH - zoomedWidth / 2, cameraX.current));
      }
      cameraY.current = Math.max(zoomedHeight / 2, Math.min(GROUND_Y + 100, cameraY.current));

      checkCollision(p1, p2);
      checkCollision(p2, p1);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.scale(cameraZoom.current, cameraZoom.current);
      ctx.translate(-cameraX.current, -cameraY.current);

      // Parallax Background
      ctx.save();
      ctx.fillStyle = '#1e293b';
      for(let i = -2; i < 6; i++) {
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

      // Ground extends very far to prevent empty space
      ctx.fillStyle = '#334155';
      ctx.fillRect(-WORLD_WIDTH, GROUND_Y, WORLD_WIDTH * 3, 2000);
      
      p1.draw(ctx);
      p2.draw(ctx);

      setP1Health(p1.health);
      setP2Health(p2.health);
      setP1Energy(p1.energy);
      setP2Energy(p2.energy);

      if (p1.health <= 0 || p2.health <= 0) {
        const winName = p1.health <= 0 ? (mode === GameMode.PVE ? "CPU" : "PLAYER 2") : "PLAYER 1";
        setWinner(winName);
        setMode(GameMode.GAMEOVER);
        fetchWinnerQuote(winName);
        return;
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key);
      if (!fightersRef.current) return;
      const { p1, p2 } = fightersRef.current;
      // Using attemptJump for responsive jumping
      if (e.key === P1_KEYS.JUMP) p1.attemptJump();
      if (e.key === P1_KEYS.ATTACK) p1.attack();
      if (e.key === P1_KEYS.SKILL) p1.charge(true);
      if (e.key === P1_KEYS.ULT) p1.ultimate();
      if (e.key === P1_KEYS.TELEPORT) p1.teleport();
      if (mode === GameMode.PVP) {
        if (e.key === P2_KEYS.JUMP) p2.attemptJump();
        if (e.key === P2_KEYS.ATTACK) p2.attack();
        if (e.key === P2_KEYS.SKILL) p2.charge(true);
        if (e.key === P2_KEYS.ULT) p2.ultimate();
        if (e.key === P2_KEYS.TELEPORT) p2.teleport();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key);
      if (!fightersRef.current) return;
      const { p1, p2 } = fightersRef.current;
      if (e.key === P1_KEYS.SKILL) p1.charge(false);
      if (mode === GameMode.PVP && e.key === P2_KEYS.SKILL) p2.charge(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [mode]);

  const renderEnergyStocks = (energyValue: number) => {
    const bars = [];
    for (let i = 0; i < 3; i++) {
        const fill = Math.max(0, Math.min(100, energyValue - (i * 100)));
        bars.push(
            <div key={i} className="flex-1 h-3 bg-gray-900 border-2 border-white relative overflow-hidden">
                <div className="h-full bg-yellow-400" style={{ width: `${fill}%` }} />
            </div>
        );
    }
    return bars;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      {mode === GameMode.MENU && (
        <div className="text-center z-10 flex flex-col gap-8 animate-in fade-in duration-700">
          <h1 className="text-7xl font-bold mb-4 tracking-tighter text-blue-500 italic drop-shadow-[0_8px_0_rgba(0,0,0,1)]">PIXEL BRAWL</h1>
          
          <div className="flex gap-16 justify-center mb-8 bg-gray-900/50 p-8 rounded border border-gray-800">
             <div className="flex flex-col gap-2 items-center">
                <h3 className="text-blue-400 font-bold mb-2">PLAYER 1</h3>
                <div className="text-xs text-gray-400 mb-1">CHARACTER ID</div>
                <div className="pixel-border bg-gray-800 px-6 py-3 text-lg font-mono text-white">USER1</div>
                <div className="text-[10px] text-gray-500 mt-2">
                    Expects: assets/user1_run.png<br/>
                    assets/user1_attack.png<br/>
                    etc.
                </div>
             </div>
             <div className="flex flex-col gap-2 items-center">
                <h3 className="text-red-400 font-bold mb-2">PLAYER 2</h3>
                <div className="text-xs text-gray-400 mb-1">CHARACTER ID</div>
                <div className="pixel-border bg-gray-800 px-6 py-3 text-lg font-mono text-white">USER2</div>
             </div>
          </div>

          <div className="flex flex-col gap-4">
            <button onClick={() => initGame(GameMode.PVE)} className="pixel-border bg-blue-600 hover:bg-blue-500 px-8 py-5 text-xl transition-all">1P VS CPU</button>
            <button onClick={() => initGame(GameMode.PVP)} className="pixel-border bg-red-600 hover:bg-red-500 px-8 py-5 text-xl transition-all">1P VS 2P</button>
          </div>
          <div className="mt-8 text-[10px] text-gray-500 leading-relaxed uppercase space-y-2 opacity-80">
            <p>P1: WASD | J:ATK K:JUMP L:TELE I:CHARGE(Hold) O:ULT</p>
            <p>P2: ARROWS | 1:ATK 2:JUMP 3:TELE 4:CHARGE(Hold) 5:ULT</p>
          </div>
        </div>
      )}
      {(mode === GameMode.PVP || mode === GameMode.PVE || mode === GameMode.GAMEOVER) && (
        <div className="relative">
          <div className="absolute top-6 left-0 right-0 flex justify-between px-10 z-20 pointer-events-none">
            <div className="w-[40%]">
              <div className="text-xs mb-1 flex justify-between"><span>PLAYER 1</span><span>{Math.ceil(p1Health)}%</span></div>
              <div className="h-5 w-full bg-gray-900 border-2 border-white relative overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-75" style={{ width: `${p1Health}%` }} />
              </div>
              <div className="flex gap-1 mt-1">{renderEnergyStocks(p1Energy)}</div>
            </div>
            <div className="flex flex-col items-center justify-center">
              <div className="text-3xl font-black text-red-600 italic -skew-x-12 drop-shadow-md">VS</div>
            </div>
            <div className="w-[40%] text-right">
              <div className="text-xs mb-1 flex justify-between"><span>{Math.ceil(p2Health)}%</span><span>{mode === GameMode.PVE ? 'CPU' : 'PLAYER 2'}</span></div>
              <div className="h-5 w-full bg-gray-900 border-2 border-white relative overflow-hidden flex justify-end">
                <div className="h-full bg-red-600 transition-all duration-75" style={{ width: `${p2Health}%` }} />
              </div>
              <div className="flex gap-1 mt-1 justify-end">{renderEnergyStocks(p2Energy)}</div>
            </div>
          </div>
          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="border-8 border-white/10 rounded-lg shadow-2xl" />
          {mode === GameMode.GAMEOVER && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-30">
              <h2 className="text-5xl font-black text-yellow-400 mb-4 uppercase tracking-widest skew-x-[-10deg]">{winner} WINS!</h2>
              {geminiQuote && <div className="max-w-xl text-center mb-10 text-white text-xl font-mono italic">"{geminiQuote}"</div>}
              <button onClick={() => setMode(GameMode.MENU)} className="pixel-border bg-white text-black px-10 py-5 text-xl transition-transform">RETURN TO MENU</button>
            </div>
          )}
        </div>
      )}
      <div className="mt-6 text-[8px] text-gray-600 uppercase tracking-[0.3em] opacity-40">
        PIXEL BRAWL TURBO &bull; 3-BAR METER SYSTEM &bull; DYNAMIC CAMERA
      </div>
    </div>
  );
};

export default App;
