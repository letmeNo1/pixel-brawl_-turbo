
import React, { useEffect, useState } from 'react';
import { GameMode } from '../types';
import { leaderboardService, LeaderboardEntry } from '../services/leaderboard';
import { authService, UserStats } from '../services/auth';

interface MenuProps {
  onStartGame: (mode: GameMode) => void;
  onLoginClick: () => void;
  isLoggedIn: boolean;
  username: string;
  isMobile: boolean;
}

export const Menu: React.FC<MenuProps> = ({ onStartGame, onLoginClick, isLoggedIn, username, isMobile }) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLB, setLoadingLB] = useState(true);
  const [userStats, setUserStats] = useState<UserStats | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
        try {
            // Fetch top 5 for the menu display
            const data = await leaderboardService.getTopPlayers();
            setLeaderboard(data.slice(0, 5));
        } catch (e) {
            console.error("Failed to load leaderboard", e);
        } finally {
            setLoadingLB(false);
        }
    };
    fetchLeaderboard();
  }, []);

  useEffect(() => {
      if (isLoggedIn && username) {
          authService.getProfile(username).then(stats => setUserStats(stats));
      } else {
          setUserStats(null);
      }
  }, [isLoggedIn, username]);

  const calculateWinRate = (wins: number, matches: number) => {
      if (matches === 0) return "0%";
      return Math.round((wins / matches) * 100) + "%";
  };

  const toggleFullScreen = () => {
      const doc = document.documentElement as any;
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
          if (doc.requestFullscreen) {
              doc.requestFullscreen();
          } else if (doc.webkitRequestFullscreen) {
              doc.webkitRequestFullscreen();
          }
      } else {
          if (document.exitFullscreen) {
              document.exitFullscreen();
          } else if ((document as any).webkitExitFullscreen) {
              (document as any).webkitExitFullscreen();
          }
      }
  };

  return (
    <div className="text-center z-10 flex flex-col gap-4 md:gap-8 animate-in fade-in duration-700 w-full max-w-4xl px-4 h-full max-h-screen overflow-y-auto py-8 touch-pan-y relative">
      {/* Fullscreen Toggle Button */}
      <button 
        onClick={toggleFullScreen}
        className="absolute top-2 right-2 md:top-4 md:right-4 z-50 bg-gray-900/80 border-2 border-gray-600 text-gray-300 hover:text-white hover:border-white px-2 py-2 text-[10px] md:text-xs font-mono transition-colors pixel-border"
      >
        [⛶] SCREEN
      </button>

      <h1 className="text-3xl md:text-7xl font-bold mb-2 md:mb-4 tracking-tighter text-blue-500 italic drop-shadow-[0_8px_0_rgba(0,0,0,1)] flex-shrink-0">PIXEL BRAWL</h1>
      
      <div className="flex flex-col md:flex-row justify-between items-center md:items-start w-full md:px-12 gap-8 flex-shrink-0">
         {/* LEFT COLUMN: SERVER INFO */}
         <div className="flex flex-col gap-2 text-center md:text-left w-full md:w-1/4">
             <div className="text-xs text-gray-500 font-bold">SERVER STATUS</div>
             <div className="text-green-400 text-sm flex items-center justify-center md:justify-start gap-2">
                 <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                 ONLINE
             </div>
             <div className="text-xs text-gray-600 mt-1">PLAYERS: 12,403</div>
         </div>

         {/* CENTER COLUMN: PROFILE & PLAY */}
         <div className="flex flex-col gap-6 items-center flex-1 w-full">
            {isLoggedIn && userStats ? (
                <div className="w-full max-w-xs pixel-border bg-gray-900/90 p-4 mb-2 relative group">
                    <div className="absolute top-0 left-0 w-2 h-2 bg-yellow-400"></div>
                    <div className="absolute top-0 right-0 w-2 h-2 bg-yellow-400"></div>
                    <div className="absolute bottom-0 left-0 w-2 h-2 bg-yellow-400"></div>
                    <div className="absolute bottom-0 right-0 w-2 h-2 bg-yellow-400"></div>
                    
                    <div className="text-xs text-gray-400 font-bold mb-2 tracking-widest border-b border-gray-700 pb-1">FIGHTER CARD</div>
                    <div className="text-xl text-yellow-400 font-bold mb-3">{username}</div>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                        <div className="flex flex-col gap-1 items-start">
                            <span className="text-gray-500">SCORE</span>
                            <span className="text-white text-lg">{userStats.score}</span>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                            <span className="text-gray-500">WIN RATE</span>
                            <span className={`text-lg ${parseInt(calculateWinRate(userStats.wins, userStats.matches)) > 50 ? 'text-green-400' : 'text-red-400'}`}>
                                {calculateWinRate(userStats.wins, userStats.matches)}
                            </span>
                        </div>
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] text-gray-500">
                        <span>MATCHES: {userStats.matches}</span>
                        <span>WINS: {userStats.wins}</span>
                    </div>
                </div>
            ) : (
                <button onClick={onLoginClick} className="text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1 mb-2 transition-colors">
                    [ LOGIN TO PROFILE ]
                </button>
            )}

            <div className="flex flex-col gap-2 w-full items-center">
                <div className="text-[10px] text-blue-400 font-bold tracking-widest mb-1">ONLINE MODE</div>
                <button onClick={() => onStartGame(GameMode.ONLINE)} className="pixel-border bg-gradient-to-r from-blue-700 to-purple-700 hover:from-blue-600 hover:to-purple-600 px-8 py-5 text-xl transition-all w-full md:w-80 relative overflow-hidden group shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                    <span className="relative z-10 font-black italic tracking-wider">RANKED MATCH</span>
                    <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12"></div>
                </button>
            </div>
            
            <div className="flex flex-col gap-2 w-full items-center mt-4">
                <div className="text-[10px] text-gray-500 font-bold tracking-widest mb-1">LOCAL MODES</div>
                <div className="flex gap-4">
                    <button onClick={() => onStartGame(GameMode.PVE)} className="pixel-border bg-gray-800 hover:bg-gray-700 px-6 py-4 text-sm transition-all w-36 border border-gray-600">VS CPU</button>
                    <button onClick={() => onStartGame(GameMode.PVP)} className="pixel-border bg-gray-800 hover:bg-gray-700 px-6 py-4 text-sm transition-all w-36 border border-gray-600">LOCAL PVP</button>
                </div>
            </div>
         </div>

         {/* RIGHT COLUMN: LEADERBOARD */}
         <div className="flex flex-col gap-4 w-full md:w-1/4 items-center md:items-end pb-8">
            <div className="w-full pixel-border bg-gray-900/80 p-4 min-h-[180px]">
                 <div className="text-xs text-yellow-400 font-bold mb-3 text-center border-b-2 border-gray-700 pb-2 tracking-widest flex justify-between">
                     <span>RANK</span>
                     <span>RATE</span>
                 </div>
                 
                 {loadingLB ? (
                     <div className="flex flex-col items-center justify-center h-24 gap-2 text-gray-500">
                         <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                         <div className="text-[10px]">LOADING...</div>
                     </div>
                 ) : (
                     <div className="flex flex-col gap-2">
                         {leaderboard.map((player, idx) => (
                             <div key={idx} className="flex justify-between items-center text-[10px] font-mono group hover:bg-white/5 p-1 transition-colors cursor-default">
                                 <div className="flex gap-2 items-center">
                                     <span className={`${player.rank === 1 ? 'text-yellow-400' : player.rank === 2 ? 'text-gray-300' : player.rank === 3 ? 'text-orange-400' : 'text-gray-600'} font-bold w-4`}>#{player.rank}</span>
                                     <div className="flex flex-col text-left">
                                         <span className="text-gray-300 group-hover:text-white transition-colors">{player.name}</span>
                                         <span className="text-[8px] text-gray-600">{player.score.toLocaleString()} PTS</span>
                                     </div>
                                 </div>
                                 <span className="text-blue-500 font-bold">{calculateWinRate(player.wins, player.matches)}</span>
                             </div>
                         ))}
                     </div>
                 )}
            </div>
            
            <div className="flex flex-col gap-1 text-center md:text-right mt-2 opacity-50 hover:opacity-100 transition-opacity">
               <div className="text-[10px] text-gray-500 font-bold">VERSION</div>
               <div className="text-gray-400 text-xs">v1.3.1 ONLINE</div>
            </div>
         </div>
      </div>
      
      {!isMobile && (
          <div className="mt-8 text-[10px] text-gray-500 leading-relaxed uppercase space-y-2 opacity-80 text-left bg-gray-900/50 p-4 border border-gray-800 mx-auto max-w-2xl flex-shrink-0">
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
  );
};
