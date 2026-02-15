
import React, { useEffect, useState, useRef } from 'react';
import { GameMode } from './types';
import { Menu } from './components/Menu';
import { Game } from './components/Game';
import { LoginModal } from './components/LoginModal';
import { LoadingScreen } from './components/LoadingScreen';
import { matchmakingService } from './services/matchmaking';
import { soundManager } from './SoundManager';
import { SPRITE_MAPPINGS } from './FighterRenderer';

const App: React.FC = () => {
  const [mode, setMode] = useState<GameMode>(GameMode.MENU);
  
  // Loading State
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Auth & Matchmaking State
  const [username, setUsername] = useState<string>("PLAYER 1");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [opponentName, setOpponentName] = useState<string>("CPU");
  const isSearchingRef = useRef(false);

  // Mobile State
  const [isMobile, setIsMobile] = useState(false);
  const [isLandscape, setIsLandscape] = useState(true);

  // Asset Versioning
  const [assetVersion] = useState<number>(Date.now());

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

  // Asset Preloading
  useEffect(() => {
    const preloadAssets = async () => {
      const CHARACTERS = ['user1', 'user2']; // Characters to load
      const imagesToLoad: string[] = [];

      // Generate Image List
      CHARACTERS.forEach(char => {
          Object.entries(SPRITE_MAPPINGS).forEach(([state, count]) => {
              if (count > 1) {
                  for(let i=1; i<=count; i++) {
                      imagesToLoad.push(`/assets/characters/${char}/${state}${i}.png?v=${assetVersion}`);
                  }
              } else {
                  imagesToLoad.push(`/assets/characters/${char}/${state}.png?v=${assetVersion}`);
              }
          });
      });

      let loadedCount = 0;
      const totalItems = imagesToLoad.length + 1; // +1 for Sound Init

      const updateProgress = () => {
          loadedCount++;
          setLoadingProgress(Math.min(100, Math.floor((loadedCount / totalItems) * 100)));
      };

      try {
          // 1. Load Sounds
          await soundManager.loadAll();
          updateProgress();

          // 2. Load Images (Parallel)
          const imagePromises = imagesToLoad.map(src => {
              return new Promise<void>((resolve) => {
                  const img = new Image();
                  img.src = src;
                  img.onload = () => { updateProgress(); resolve(); };
                  img.onerror = () => { 
                      console.warn(`Failed to preload: ${src}`); 
                      updateProgress(); 
                      resolve(); 
                  };
              });
          });

          await Promise.all(imagePromises);
          
          // Small delay to show 100%
          setTimeout(() => {
            setIsLoading(false);
          }, 500);

      } catch (e) {
          console.error("Asset loading failed", e);
          setIsLoading(false); // Force entry on error
      }
    };

    preloadAssets();
  }, [assetVersion]);

  const handleLogin = (name: string) => {
    setUsername(name);
    setIsLoggedIn(true);
    setShowLoginModal(false);
  };

  const handleStartGame = (selectedMode: GameMode) => {
    if (selectedMode === GameMode.ONLINE) {
         if (!isLoggedIn) {
             setShowLoginModal(true);
             return;
         }
         startMatchmaking();
    } else {
        setOpponentName(selectedMode === GameMode.PVP ? "PLAYER 2" : "CPU");
        setMode(selectedMode);
    }
  };

  const startMatchmaking = async () => {
    setIsSearching(true);
    isSearchingRef.current = true;
    
    try {
        const match = await matchmakingService.joinQueue(username);
        
        if (isSearchingRef.current) {
            setOpponentName(match.opponentName);
            setIsSearching(false);
            isSearchingRef.current = false;
            setMode(GameMode.ONLINE);
        }
    } catch (e) {
        console.error("Matchmaking failed", e);
        setIsSearching(false);
        isSearchingRef.current = false;
    }
  };

  const cancelMatchmaking = async () => {
      isSearchingRef.current = false;
      setIsSearching(false);
      await matchmakingService.cancelQueue(username);
  };

  if (isLoading) {
      return <LoadingScreen progress={loadingProgress} />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white overflow-hidden relative">
      
      {isMobile && !isLandscape && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center text-center p-8">
              <div className="text-6xl mb-8 animate-bounce">📱↻</div>
              <h2 className="text-2xl font-bold text-yellow-400 mb-4">ROTATE DEVICE</h2>
              <p className="text-gray-400">PLEASE USE LANDSCAPE MODE FOR THE BEST EXPERIENCE</p>
          </div>
      )}

      {showLoginModal && (
          <LoginModal 
            onLogin={handleLogin}
            onCancel={() => setShowLoginModal(false)}
          />
      )}

      {isSearching && (
          <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-50 animate-in fade-in duration-300">
              <div className="w-full max-w-lg border-2 border-gray-700 bg-gray-900/80 p-8 text-center relative pixel-border">
                  <h2 className="text-2xl text-blue-400 mb-6 font-bold tracking-widest border-b border-gray-700 pb-4">WAITING ROOM</h2>
                  
                  <div className="flex justify-center items-center gap-8 mb-8">
                      <div className="flex flex-col items-center">
                          <div className="w-16 h-16 bg-blue-600 mb-2 border-2 border-white"></div>
                          <span className="text-sm font-bold">{username}</span>
                          <span className="text-[10px] text-green-400">READY</span>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center">
                          <div className="text-xs text-gray-500 mb-1">VS</div>
                          <div className="flex gap-1 animate-pulse">
                              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                              <div className="w-2 h-2 bg-gray-500 rounded-full delay-75"></div>
                              <div className="w-2 h-2 bg-gray-500 rounded-full delay-150"></div>
                          </div>
                      </div>

                      <div className="flex flex-col items-center opacity-50">
                          <div className="w-16 h-16 bg-gray-800 mb-2 border-2 border-dashed border-gray-600 flex items-center justify-center text-2xl">?</div>
                          <span className="text-sm font-bold text-gray-500">SEARCHING</span>
                      </div>
                  </div>

                  <div className="text-xs text-gray-400 font-mono mb-6">
                      FINDING OPPONENT... <span className="animate-pulse">[{Math.floor(Math.random() * 50)}ms]</span>
                  </div>

                  <button 
                    onClick={cancelMatchmaking}
                    className="border border-red-500 text-red-500 hover:bg-red-500 hover:text-white px-6 py-3 text-sm font-bold transition-colors w-full"
                  >
                      CANCEL QUEUE
                  </button>
              </div>
          </div>
      )}

      {mode === GameMode.MENU ? (
          <Menu 
            onStartGame={handleStartGame}
            onLoginClick={() => setShowLoginModal(true)}
            isLoggedIn={isLoggedIn}
            username={username}
            isMobile={isMobile}
          />
      ) : (
          <Game 
            mode={mode}
            username={username}
            opponentName={opponentName}
            onBackToMenu={() => setMode(GameMode.MENU)}
            isMobile={isMobile}
            isLandscape={isLandscape}
          />
      )}
    </div>
  );
};

export default App;
