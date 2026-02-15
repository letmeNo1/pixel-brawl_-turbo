
import { GoogleGenAI } from "@google/genai";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Fighter } from './Fighter';
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
  SPRITE_CROP_CONFIG,
  CHARACTER_ANIMATIONS
} from './constants';
import { FighterState, GameMode, Projectile } from './types';
import { AssetManager } from './AssetManager';
import { soundManager } from './SoundManager';

const MOCK_OPPONENTS = ["ShadowNinja", "PixelKing", "RetroBrawler", "CyberPunk99", "WaveDashing", "GlitchUser"];

const App: React.FC = () => {
  // States
  const [mode, setMode] = useState<GameMode | 'LOADING'>('LOADING'); // Initial State is LOADING
  const [loadingProgress, setLoadingProgress] = useState(0);

  const [winner, setWinner] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Auth & Matchmaking State
  const [username, setUsername] = useState<string>("PLAYER 1");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [loginInput, setLoginInput] = useState<string>("");
  
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [opponentName, setOpponentName] = useState<string>("CPU");

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
  const [roundResult, setRoundResult] = useState<string | null>(null);

  // Debug & Settings State
  const [debugMode, setDebugMode] = useState(false);
  const [targetFPS, setTargetFPS] = useState(90); // Default 90 FPS

  // Mobile State
  const [isMobile, setIsMobile] = useState(false);
  const [isLandscape, setIsLandscape] = useState(true);
  const joystickRef = useRef<{active: boolean, startX: number, startY: number, currentX: number, currentY: number}>({ 
      active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 
  });
  const [joystickVisual, setJoystickVisual] = useState({ x: 0, y: 0 }); // Relative position for visual knob

  const [geminiQuote, setGeminiQuote] = useState<string>("");
  const [assetVersion, setAssetVersion] = useState<number>(Date.now());
  
  const fightersRef = useRef<{ p1: Fighter; p2: Fighter } | null>(null);
  const projectilesRef = useRef<Projectile[]>([]);
  const keysPressed = useRef<Set<string>>(new Set());
  
  const cameraX = useRef(WORLD_WIDTH / 2);
  const cameraY = useRef(GROUND_Y - 150);
  const cameraZoom = useRef(1);

  const timerIntervalRef = useRef<number | null>(null);
  const isRoundProcessing = useRef(false);

  // Refs for State Optimization (prevents loop restarts)
  const gameLogicRef = useRef({
      p1Wins: 0,
      p2Wins: 0,
      currentRound: 1,
      mode: mode,
      winner: winner
  });

  const settingsRef = useRef({
      debugMode: false,
      targetFPS: 90
  });

  const lastUIState = useRef({
      p1Health: 100,
      p2Health: 100,
      p1Energy: 0,
      p2Energy: 0
  });

  // Sync state to refs
  useEffect(() => {
      gameLogicRef.current.p1Wins = p1Wins;
      gameLogicRef.current.p2Wins = p2Wins;
      gameLogicRef.current.currentRound = currentRound;
      gameLogicRef.current.mode = mode;
      gameLogicRef.current.winner = winner;
  }, [p1Wins, p2Wins, currentRound, mode, winner]);

  useEffect(() => {
      settingsRef.current.debugMode = debugMode;
      settingsRef.current.targetFPS = targetFPS;
  }, [debugMode, targetFPS]);

  // Preload Assets Effect
  useEffect(() => {
    const preloadAssets = async () => {
        const characters = ['user1', 'user2'];
        const imagePaths: string[] = [];

        // 1. Generate Image Paths
        characters.forEach(charId => {
            Object.entries(CHARACTER_ANIMATIONS).forEach(([animName, frameCount]) => {
                if (frameCount > 1) {
                    for (let i = 1; i <= frameCount; i++) {
                        imagePaths.push(`/assets/characters/${charId}/${animName}${i}.png?v=${assetVersion}`);
                    }
                } else {
                    imagePaths.push(`/assets/characters/${charId}/${animName}.png?v=${assetVersion}`);
                }
            });
        });

        const totalItems = imagePaths.length + 1; // +1 for sounds (grouped)
        let loadedItems = 0;

        const updateProgress = () => {
            setLoadingProgress(Math.min(100, Math.floor((loadedItems / totalItems) * 100)));
        };

        // 2. Load Images
        await AssetManager.loadImages(imagePaths, (ratio) => {
            // We can treat images as a chunk of progress
            const imgProgress = Math.floor(ratio * imagePaths.length);
            loadedItems = imgProgress;
            updateProgress();
        });

        // 3. Load Sounds
        await soundManager.loadAll((ratio) => {
             // Optional fine-grained sound progress
        });
        loadedItems++; // Sounds chunk done
        updateProgress();

        // 4. Finish
        setTimeout(() => {
            setMode(GameMode.MENU);
        }, 500); // Small delay for polish
    };

    preloadAssets();
  }, [assetVersion]);


  // Mobile Detection & Orientation
  useEffect(() => {
      const checkMobile = () => {
          const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
          setIsMobile(isTouch);
          setIsLandscape(window.innerWidth > window.innerHeight);
      };
      
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginInput.trim().length > 0) {
        setUsername(loginInput.trim().toUpperCase());
        setIsLoggedIn(true);
        setShowLoginModal(false);
    }
  };

  const handleReloadAssets = () => {
      // Force re-mount of assets by updating version key
      setAssetVersion(Date.now());
      setLoadingProgress(0);
      setMode('LOADING');
  };

  const startMatchmaking = () => {
    if (!isLoggedIn) {
        setShowLoginModal(true);
        return;
    }
    setIsSearching(true);
    // Simulate network delay
    setTimeout(() => {
        const randomOpponent = MOCK_OPPONENTS[Math.floor(Math.random() * MOCK_OPPONENTS.length)];
        setOpponentName(randomOpponent);
        setIsSearching(false);
        initGame(GameMode.ONLINE);
    }, 2000 + Math.random() * 1500);
  };

  const resetRound = (keepScore = true) => {
    isRoundProcessing.current = false;
    const midWorld = WORLD_WIDTH / 2;
    // Create new fighters (they will use AssetManager cache now)
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

    // Set names based on mode
    if (selectedMode === GameMode.PVE) setOpponentName("CPU");
    if (selectedMode === GameMode.PVP) setOpponentName("PLAYER 2");
    // ONLINE name is set in startMatchmaking logic

    // Important: User interaction usually starts here, ensure Audio Context is active
    soundManager.resumeContext();

    resetRound(false); // Reset everything including score
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
      let type: 'melee' | 'ranged' | 'heavy' = 'melee';

      if (f1.state === FighterState.ULTIMATE) {
          damage = 25; // Reduced from 35
          type = 'heavy';
      }
      
      f2.takeDamage(damage, type);
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
        // Face towards enemy
        cpu.facing = cpuForward as 'right' | 'left'; 
        return;
    } else {
        cpu.block(false);
    }
    
    // AI Projectile
    if (dist > 300 && Math.random() < 0.02) {
        cpu.triggerSkill(); // No return, internally queued
    }

    if (![FighterState.HURT, FighterState.BLOCK, FighterState.SKILL].includes(cpu.state)) {
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
    
    if (Math.random() < 0.01 && cpu.isGrounded && ![FighterState.HURT, FighterState.BLOCK, FighterState.SKILL].includes(cpu.state)) {
      cpu.attemptJump();
    }
  };

  // Wrapped in useCallback to prevent closure staleness if passed down, 
  // but main loop calls it directly.
  const handleRoundEnd = useCallback((winningPlayer: 'p1' | 'p2' | 'draw') => {
      if (isRoundProcessing.current) return;
      isRoundProcessing.current = true;

      // Stop timer
      if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
      }

      const p1Won = winningPlayer === 'p1';
      const p2Won = winningPlayer === 'p2';
      
      const winnerName = p1Won ? username : (p2Won ? opponentName : 'DRAW');
      setRoundResult(winnerName);

      const nextP1Wins = gameLogicRef.current.p1Wins + (p1Won ? 1 : 0);
      const nextP2Wins = gameLogicRef.current.p2Wins + (p2Won ? 1 : 0);

      // Delay for Victory Animation
      setTimeout(() => {
          setRoundResult(null);

          // Update Score
          if (p1Won) setP1Wins(prev => prev + 1);
          if (p2Won) setP2Wins(prev => prev + 1);

          // Check Match Over
          if (nextP1Wins >= WINS_NEEDED) {
              endMatch(username);
          } else if (nextP2Wins >= WINS_NEEDED) {
              endMatch(opponentName);
          } else {
              // Next Round
              setCurrentRound(prev => prev + 1);
              resetRound(true);
          }
      }, 2000);
  }, [username, opponentName]); 

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
      if ((mode === GameMode.PVP || mode === GameMode.PVE || mode === GameMode.ONLINE) && roundTimer > 0 && !winner && !roundResult) {
          timerIntervalRef.current = window.setInterval(() => {
              setRoundTimer(prev => {
                  if (prev <= 1) {
                      // Time Over Logic
                      if (fightersRef.current) {
                          const { p1, p2 } = fightersRef.current;
                          // "When time ends, the side with less health automatically fails"
                          // i.e. The side with MORE health WINS
                          if (p1.health > p2.health) handleRoundEnd('p1');
                          else if (p2.health > p1.health) handleRoundEnd('p2');
                          else handleRoundEnd('draw'); 
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
  }, [mode, roundTimer, winner, handleRoundEnd, roundResult]); 

  // Touch Controls Handlers
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
      
      // Clamp visual
      const scale = Math.min(1, maxDist / (dist || 1));
      setJoystickVisual({ x: dx * scale, y: dy * scale });

      // Update Keys
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
      if (isPress) keysPressed.current.add(key);
      else keysPressed.current.delete(key);
  };

  // --- GAME LOOP ---
  useEffect(() => {
    // Only run loop when playing
    if (mode === GameMode.MENU || mode === 'LOADING') return;

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    let animationFrameId: number;
    let lastTime = 0;

    const loop = (timestamp: number) => {
      animationFrameId = requestAnimationFrame(loop);

      if (!lastTime) lastTime = timestamp;
      const deltaTime = timestamp - lastTime;
      
      // Dynamic Frame Interval based on Settings
      const currentFPS = settingsRef.current.targetFPS;
      const frameInterval = 1000 / currentFPS;

      // Frame limiting
      if (deltaTime >= frameInterval) {
        lastTime = timestamp - (deltaTime % frameInterval);

        if (!fightersRef.current) return;
        
        // Prevent updates if game over (visual freeze or simple ignore)
        if (gameLogicRef.current.mode === GameMode.GAMEOVER) {
            // Optionally continue drawing but stop logic
            // For now, continue drawing so we see the final state
        }

        const { p1, p2 } = fightersRef.current;
        const debug = settingsRef.current.debugMode;

        // --- Logic Updates ---
        const lockedStates = [FighterState.HURT, FighterState.DEAD, FighterState.SKILL, FighterState.ULTIMATE];

        // P1 Input
        if (!lockedStates.includes(p1.state) && gameLogicRef.current.mode !== GameMode.GAMEOVER && !roundResult) {
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
        if (mode === GameMode.PVP && gameLogicRef.current.mode !== GameMode.GAMEOVER && !roundResult) {
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
        } else if (gameLogicRef.current.mode !== GameMode.GAMEOVER && !roundResult) {
          handleAI(p2, p1);
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

        for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
          const p = projectilesRef.current[i];
          p.x += p.velocity.x;
          p.y += p.velocity.y;
          
          if (p.type === 'beam') {
              const maxLife = 600;
              const life = Date.now() - p.createdAt;
              if (life > maxLife) {
                  projectilesRef.current.splice(i, 1);
                  continue;
              }

              const opponent = p.ownerId === p1.characterId ? p2 : p1;
              const alreadyHit = p.hitTargets?.includes(opponent.characterId);
              
              if (!alreadyHit) {
                  if (
                      p.x + p.width/2 > opponent.position.x &&
                      p.x - p.width/2 < opponent.position.x + opponent.width &&
                      p.y + p.height/2 > opponent.position.y &&
                      p.y - p.height/2 < opponent.position.y + opponent.height
                  ) {
                      if (opponent.state !== FighterState.DEAD && opponent.state !== FighterState.DODGE) {
                          opponent.takeDamage(p.damage, 'heavy');
                          p.hitTargets = p.hitTargets ? [...p.hitTargets, opponent.characterId] : [opponent.characterId];
                          const knockDir = p.facing;
                          opponent.velocity.x = knockDir * 15; 
                          opponent.velocity.y = -5;
                      }
                  }
              }
              continue;
          }

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
                  opponent.takeDamage(p.damage, 'ranged');
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

        // Drawing
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
        
        p1.draw(ctx, debug);
        p2.draw(ctx, debug);

        for (const p of projectilesRef.current) {
          if (p.type === 'beam') {
              const life = Date.now() - p.createdAt;
              const maxLife = 600;
              const opacity = Math.max(0, 1 - (life / maxLife));
              
              ctx.save();
              ctx.globalAlpha = opacity;
              ctx.translate(p.x, p.y);
              ctx.shadowBlur = 30;
              ctx.shadowColor = p.color;
              ctx.fillStyle = p.color;
              ctx.fillRect(-p.width/2, -p.height/2, p.width, p.height);
              ctx.shadowBlur = 10;
              ctx.shadowColor = '#ffffff';
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(-p.width/2, -p.height/4, p.width, p.height/2);
              ctx.restore();
          } else if (p.type === 'clone') {
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

        // --- OPTIMIZED UI UPDATES ---
        // Only trigger React render if values changed significantly
        if (Math.abs(p1.health - lastUIState.current.p1Health) > 0.1) {
            setP1Health(p1.health);
            lastUIState.current.p1Health = p1.health;
        }
        if (Math.abs(p2.health - lastUIState.current.p2Health) > 0.1) {
            setP2Health(p2.health);
            lastUIState.current.p2Health = p2.health;
        }
        if (Math.abs(p1.energy - lastUIState.current.p1Energy) > 1) {
             setP1Energy(p1.energy);
             lastUIState.current.p1Energy = p1.energy;
        }
        if (Math.abs(p2.energy - lastUIState.current.p2Energy) > 1) {
             setP2Energy(p2.energy);
             lastUIState.current.p2Energy = p2.energy;
        }

        // Win Logic Check (Immediate)
        if ((p1.health <= 0 || p2.health <= 0) && gameLogicRef.current.mode !== GameMode.GAMEOVER) {
            if (p1.health <= 0) handleRoundEnd('p2');
            else handleRoundEnd('p1');
        }
      }
    };
    
    animationFrameId = requestAnimationFrame(loop);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keysPressed.current.add(key);
      if (!fightersRef.current) return;
      const { p1, p2 } = fightersRef.current;
      
      // Inputs
      if (gameLogicRef.current.mode !== GameMode.GAMEOVER && !roundResult) {
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
  }, [mode, handleRoundEnd, roundResult]); // Added roundResult

  // Helper for Round Dots
  const renderRoundDots = (wins: number) => {
      return (
          <div className="flex gap-2">
              {[...Array(WINS_NEEDED)].map((_, i) => (
                  <div key={i} className={`w-5 h-5 md:w-6 md:h-6 flex items-center justify-center border-2 border-white/50 transform skew-x-[-10deg] ${i < wins ? 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]' : 'bg-black/60'}`}>
                      {i < wins && <span className="text-black font-black text-[10px] md:text-xs skew-x-[10deg]">V</span>}
                  </div>
              ))}
          </div>
      );
  };

  // Helper for Touch Buttons
  const TouchButton = ({ code, color, label, size = 'md' }: { code: string, color: string, label: string, size?: 'sm'|'md'|'lg' }) => {
      const sizes = { sm: 'w-12 h-12 text-xs', md: 'w-16 h-16 text-sm', lg: 'w-20 h-20 text-lg' };
      return (
          <div 
            className={`${sizes[size]} rounded-full border-4 border-black/50 ${color} flex items-center justify-center font-bold text-white shadow-[0_4px_0_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-none select-none`}
            onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleBtnTouch(code, true); if(fightersRef.current) { if(code === P1_KEYS.JUMP) fightersRef.current.p1.attemptJump(); if(code === P1_KEYS.ATTACK) fightersRef.current.p1.attack(); if(code === P1_KEYS.ULT) fightersRef.current.p1.ultimate(); if(code === P1_KEYS.DODGE) fightersRef.current.p1.dodge(); if(code === P1_KEYS.TELEPORT) fightersRef.current.p1.teleport(); if(code === P1_KEYS.SKILL_RANGED) fightersRef.current.p1.triggerSkill(); }}}
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleBtnTouch(code, false); }}
          >
              {label}
          </div>
      );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white overflow-hidden relative">
      
      {/* Mobile Orientation Overlay */}
      {isMobile && !isLandscape && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center text-center p-8">
              <div className="text-6xl mb-8 animate-bounce">📱↻</div>
              <h2 className="text-2xl font-bold text-yellow-400 mb-4">ROTATE DEVICE</h2>
              <p className="text-gray-400">PLEASE USE LANDSCAPE MODE FOR THE BEST EXPERIENCE</p>
          </div>
      )}

      {/* LOADING SCREEN */}
      {mode === 'LOADING' && (
          <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 animate-in fade-in duration-300">
              <h1 className="text-4xl md:text-6xl font-black text-blue-500 italic tracking-tighter mb-8 drop-shadow-[0_4px_0_rgba(255,255,255,0.2)]">PIXEL BRAWL</h1>
              
              <div className="w-64 md:w-96 h-4 bg-gray-800 border-2 border-gray-600 p-1 relative">
                  <div 
                    className="h-full bg-yellow-400 transition-all duration-200"
                    style={{ width: `${loadingProgress}%` }}
                  ></div>
              </div>
              
              <div className="mt-4 font-mono text-xs text-gray-400 animate-pulse">
                  LOADING ASSETS... {loadingProgress}%
              </div>
          </div>
      )}

      {/* Login Modal */}
      {showLoginModal && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 animate-in fade-in duration-300">
              <form onSubmit={handleLogin} className="pixel-border bg-gray-900 p-8 flex flex-col gap-4 w-96">
                  <h2 className="text-xl text-yellow-400 font-bold text-center mb-2">IDENTIFICATION</h2>
                  <div className="text-[10px] text-gray-500 text-center mb-2">REQUIRED FOR ONLINE PLAY</div>
                  <input 
                    type="text" 
                    maxLength={10}
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="ENTER USERNAME"
                    className="bg-black border-2 border-gray-600 p-4 text-white font-mono text-center focus:border-blue-500 outline-none uppercase"
                    autoFocus
                  />
                  <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white p-4 pixel-border mt-2 font-bold tracking-widest">CONFIRM</button>
                  <button type="button" onClick={() => setShowLoginModal(false)} className="text-gray-500 text-xs hover:text-white mt-2">CANCEL</button>
              </form>
          </div>
      )}

      {/* Matchmaking Overlay */}
      {isSearching && (
          <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-50">
              <div className="text-4xl text-blue-400 animate-pulse mb-4 tracking-tighter italic">SEARCHING FOR OPPONENT...</div>
              <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                  <div className="h-full bg-blue-500 animate-[width_2s_ease-in-out_infinite] w-1/3"></div>
              </div>
              <div className="text-gray-500 mt-4 text-xs font-mono">ESTIMATED WAIT: 0:02</div>
          </div>
      )}

      {mode === GameMode.MENU && (
        <div className="text-center z-10 flex flex-col gap-8 animate-in fade-in duration-700 w-full max-w-4xl px-4">
          <h1 className="text-4xl md:text-7xl font-bold mb-4 tracking-tighter text-blue-500 italic drop-shadow-[0_8px_0_rgba(0,0,0,1)]">PIXEL BRAWL</h1>
          
          <div className="flex flex-col md:flex-row justify-between items-center md:items-start w-full md:px-12 gap-8">
             {/* Left Column: Stats */}
             <div className="flex flex-col gap-2 text-center md:text-left w-full md:w-1/4">
                 <div className="text-xs text-gray-500 font-bold">SERVER STATUS</div>
                 <div className="text-green-400 text-sm flex items-center justify-center md:justify-start gap-2">
                     <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                     ONLINE
                 </div>
                 <div className="text-xs text-gray-600 mt-1">PLAYERS: 12,403</div>
             </div>

             {/* Center Column: Actions */}
             <div className="flex flex-col gap-6 items-center flex-1 w-full">
                {isLoggedIn ? (
                    <div className="text-xl text-yellow-400 mb-2 animate-bounce border-b-2 border-yellow-400 pb-1">WELCOME, {username}</div>
                ) : (
                    <button onClick={() => setShowLoginModal(true)} className="text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1 mb-2 transition-colors">
                        [ LOGIN TO PROFILE ]
                    </button>
                )}

                <div className="flex flex-col gap-2 w-full items-center">
                    <div className="text-[10px] text-blue-400 font-bold tracking-widest mb-1">ONLINE MODE</div>
                    <button onClick={startMatchmaking} className="pixel-border bg-gradient-to-r from-blue-700 to-purple-700 hover:from-blue-600 hover:to-purple-600 px-8 py-5 text-xl transition-all w-full md:w-80 relative overflow-hidden group shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                        <span className="relative z-10 font-black italic tracking-wider">RANKED MATCH</span>
                        <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12"></div>
                    </button>
                </div>
                
                <div className="flex flex-col gap-2 w-full items-center mt-4">
                    <div className="text-[10px] text-gray-500 font-bold tracking-widest mb-1">LOCAL MODES</div>
                    <div className="flex gap-4">
                        <button onClick={() => initGame(GameMode.PVE)} className="pixel-border bg-gray-800 hover:bg-gray-700 px-6 py-4 text-sm transition-all w-36 border border-gray-600">VS CPU</button>
                        <button onClick={() => initGame(GameMode.PVP)} className="pixel-border bg-gray-800 hover:bg-gray-700 px-6 py-4 text-sm transition-all w-36 border border-gray-600">LOCAL PVP</button>
                    </div>
                </div>

                <button 
                    onClick={handleReloadAssets}
                    className="mt-4 text-[10px] text-gray-600 hover:text-red-400 transition-colors border-b border-gray-800 hover:border-red-400 pb-0.5 tracking-widest uppercase"
                >
                    ↻ Reload Assets
                </button>
             </div>

             {/* Right Column: Version */}
             <div className="hidden md:flex flex-col gap-2 text-right w-1/4">
                <div className="text-xs text-gray-500 font-bold">VERSION</div>
                <div className="text-gray-400 text-sm">v1.2.0 TURBO</div>
             </div>
          </div>
          
          {!isMobile && (
              <div className="mt-8 text-[10px] text-gray-500 leading-relaxed uppercase space-y-2 opacity-80 text-left bg-gray-900/50 p-4 border border-gray-800 mx-auto max-w-2xl">
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
          )}
        </div>
      )}
      {(mode === GameMode.PVP || mode === GameMode.PVE || mode === GameMode.ONLINE || mode === GameMode.GAMEOVER) && (
        <div className="relative w-full h-full">
          {/* Debug & FPS Settings Button */}
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-2 items-center pointer-events-auto">
             <button
                onClick={() => setDebugMode(!debugMode)}
                className="px-2 py-1 bg-black/40 border border-white/20 text-[10px] text-white/50 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
             >
                DEBUG MODE: {debugMode ? "ON" : "OFF"}
             </button>
             
             {debugMode && (
                <div className="flex gap-2">
                    <button onClick={() => setTargetFPS(30)} className={`px-2 py-1 text-[10px] border ${targetFPS === 30 ? 'bg-white text-black' : 'bg-black/40 text-white/50'}`}>30</button>
                    <button onClick={() => setTargetFPS(60)} className={`px-2 py-1 text-[10px] border ${targetFPS === 60 ? 'bg-white text-black' : 'bg-black/40 text-white/50'}`}>60</button>
                    <button onClick={() => setTargetFPS(90)} className={`px-2 py-1 text-[10px] border ${targetFPS === 90 ? 'bg-white text-black' : 'bg-black/40 text-white/50'}`}>90</button>
                    <button onClick={() => setTargetFPS(120)} className={`px-2 py-1 text-[10px] border ${targetFPS === 120 ? 'bg-white text-black font-bold' : 'bg-black/40 text-white/50'}`}>120</button>
                </div>
             )}
          </div>

          {/* Mobile HUD Overrides */}
          <div className={`absolute top-4 left-0 right-0 flex justify-between px-4 md:px-10 z-20 pointer-events-none items-start ${isMobile ? 'scale-90 origin-top' : ''}`}>
            {/* P1 HUD */}
            <div className="w-[40%] flex flex-col gap-1">
              <div className="text-xs flex justify-between items-end">
                  <span className="text-blue-400 font-bold text-sm md:text-lg drop-shadow-[2px_2px_0_rgba(0,0,0,1)] truncate max-w-[100px] md:max-w-none">{username}</span>
                  {renderRoundDots(p1Wins)}
              </div>
              <div className="h-4 md:h-6 w-full bg-gray-900 border-2 border-white relative skew-x-[-15deg] shadow-lg">
                <div className="h-full bg-yellow-500 transition-all duration-75" style={{ width: `${p1Health}%` }} />
              </div>
              {/* Energy Bar */}
              <div className="h-2 w-[80%] bg-gray-800 border border-gray-600 mt-1 skew-x-[-15deg] relative">
                  <div className="h-full bg-blue-500 transition-all duration-75" style={{ width: `${(Math.min(MAX_ENERGY, p1Energy) / MAX_ENERGY) * 100}%` }} />
                  <div className="absolute left-1/3 top-0 bottom-0 w-[1px] bg-black/50 z-10"></div>
                  <div className="absolute left-2/3 top-0 bottom-0 w-[1px] bg-black/50 z-10"></div>
              </div>
            </div>

            {/* Timer */}
            <div className="flex flex-col items-center justify-start -mt-2">
              <div className="text-3xl md:text-5xl font-black text-white drop-shadow-[4px_4px_0_rgba(0,0,0,1)] bg-gray-800 border-2 border-white px-2 md:px-4 py-1 md:py-2 rounded-lg">{roundTimer}</div>
              <div className="text-[10px] md:text-xs text-gray-400 mt-1 font-bold">ROUND {currentRound}</div>
            </div>

            {/* P2 HUD */}
            <div className="w-[40%] text-right flex flex-col gap-1 items-end">
              <div className="text-xs flex justify-between items-end w-full flex-row-reverse">
                  <span className="text-red-400 font-bold text-sm md:text-lg drop-shadow-[2px_2px_0_rgba(0,0,0,1)] truncate max-w-[100px] md:max-w-none">{opponentName}</span>
                  {renderRoundDots(p2Wins)}
              </div>
              <div className="h-4 md:h-6 w-full bg-gray-900 border-2 border-white relative skew-x-[15deg] flex justify-end shadow-lg">
                <div className="h-full bg-yellow-500 transition-all duration-75" style={{ width: `${p2Health}%` }} />
              </div>
               {/* Energy Bar */}
               <div className="h-2 w-[80%] bg-gray-800 border border-gray-600 mt-1 skew-x-[15deg] flex justify-end relative">
                  <div className="h-full bg-red-500 transition-all duration-75" style={{ width: `${(Math.min(MAX_ENERGY, p2Energy) / MAX_ENERGY) * 100}%` }} />
                   <div className="absolute right-1/3 top-0 bottom-0 w-[1px] bg-black/50 z-10"></div>
                   <div className="absolute right-2/3 top-0 bottom-0 w-[1px] bg-black/50 z-10"></div>
              </div>
            </div>
          </div>

          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="border-0 md:border-8 border-white/10 rounded-none md:rounded-lg shadow-2xl w-full h-full object-contain" />
          
          {/* MOBILE CONTROLS */}
          {isMobile && isLandscape && (mode === GameMode.PVP || mode === GameMode.PVE || mode === GameMode.ONLINE) && (
              <div className="absolute inset-0 z-50 pointer-events-none select-none">
                  {/* Left: Joystick */}
                  <div className="absolute bottom-8 left-12 md:bottom-12 md:left-20 pointer-events-auto">
                      <div 
                        className="w-32 h-32 bg-white/10 rounded-full border-2 border-white/30 relative flex items-center justify-center backdrop-blur-sm"
                        onTouchStart={handleJoystickStart}
                        onTouchMove={handleJoystickMove}
                        onTouchEnd={handleJoystickEnd}
                        onTouchCancel={handleJoystickEnd}
                      >
                          <div 
                            className="w-12 h-12 bg-white/50 rounded-full shadow-[0_4px_0_rgba(0,0,0,0.5)]" 
                            style={{ 
                                transform: `translate(${joystickVisual.x}px, ${joystickVisual.y}px)`,
                                transition: joystickRef.current.active ? 'none' : 'transform 0.1s'
                            }}
                          ></div>
                          {/* D-Pad Indicators */}
                          <div className="absolute top-2 text-white/30 text-xs font-bold">▲</div>
                          <div className="absolute bottom-2 text-white/30 text-xs font-bold">▼</div>
                          <div className="absolute left-2 text-white/30 text-xs font-bold">◀</div>
                          <div className="absolute right-2 text-white/30 text-xs font-bold">▶</div>
                      </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="absolute bottom-8 right-12 md:bottom-12 md:right-20 pointer-events-auto flex flex-col items-end gap-2">
                      <div className="flex gap-4 items-end">
                           <div className="flex flex-col gap-4">
                                <TouchButton code={P1_KEYS.ULT} color="bg-purple-600" label="ULT" size="sm" />
                                <TouchButton code={P1_KEYS.SKILL_RANGED} color="bg-blue-600" label="SKILL" size="sm" />
                           </div>
                           <div className="flex flex-col gap-4 -mt-10">
                                <TouchButton code={P1_KEYS.TELEPORT} color="bg-yellow-600" label="TELE" size="sm" />
                                <TouchButton code={P1_KEYS.ATTACK} color="bg-red-600" label="ATK" size="lg" />
                           </div>
                           <div className="flex flex-col gap-4">
                                <TouchButton code={P1_KEYS.JUMP} color="bg-green-600" label="JUMP" size="md" />
                                <TouchButton code={P1_KEYS.DODGE} color="bg-gray-600" label="DODGE" size="sm" />
                           </div>
                      </div>
                  </div>
              </div>
          )}

          {showRoundMessage && !winner && (
              <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                  <h1 className="text-4xl md:text-8xl font-black text-white drop-shadow-[0_10px_0_rgba(0,0,0,1)] animate-pulse tracking-tighter italic">ROUND {currentRound}</h1>
              </div>
          )}

          {roundResult && !winner && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-40 pointer-events-none animate-in zoom-in duration-300">
                  <h1 className="text-4xl md:text-8xl font-black text-yellow-400 drop-shadow-[0_8px_0_rgba(180,83,9,1)] tracking-tighter italic stroke-black">{roundResult}</h1>
                  <h2 className="text-2xl md:text-4xl text-white font-bold mt-2 drop-shadow-md">WINS ROUND</h2>
              </div>
          )}

          {mode === GameMode.GAMEOVER && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-30 animate-in fade-in duration-500">
              <h2 className="text-4xl md:text-7xl font-black text-yellow-400 mb-4 uppercase tracking-widest skew-x-[-10deg] drop-shadow-[0_4px_0_#b45309] text-center">{winner} WINS!</h2>
              {geminiQuote && <div className="max-w-xl text-center mb-10 text-white text-sm md:text-xl font-mono italic px-8">"{geminiQuote}"</div>}
              <button onClick={() => setMode(GameMode.MENU)} className="pixel-border bg-white text-black px-12 py-6 text-xl font-bold tracking-widest hover:scale-105 transition-transform hover:bg-gray-200">RETURN TO MENU</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
