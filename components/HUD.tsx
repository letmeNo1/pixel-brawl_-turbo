
import React from 'react';
import { MAX_ENERGY } from '../constants';

interface PlayerStats {
  name: string;
  health: number;
  energy: number;
  wins: number;
}

interface HUDProps {
  p1: PlayerStats;
  p2: PlayerStats;
  timer: number;
  round: number;
  isMobile: boolean;
}

export const HUD: React.FC<HUDProps> = ({ p1, p2, timer, round, isMobile }) => {
  const renderRoundDots = (wins: number) => (
    <div className="flex gap-1">
      <div className={`w-3 h-3 rounded-full border border-white ${wins >= 1 ? 'bg-yellow-400' : 'bg-gray-800'}`}></div>
      <div className={`w-3 h-3 rounded-full border border-white ${wins >= 2 ? 'bg-yellow-400' : 'bg-gray-800'}`}></div>
    </div>
  );

  return (
    <div className={`absolute top-4 left-0 right-0 flex justify-between px-4 md:px-10 z-20 pointer-events-none items-start ${isMobile ? 'scale-90 origin-top' : ''}`}>
      {/* Player 1 HUD */}
      <div className="w-[40%] flex flex-col gap-1">
        <div className="text-xs flex justify-between items-end">
            <span className="text-blue-400 font-bold text-sm md:text-lg drop-shadow-[2px_2px_0_rgba(0,0,0,1)] truncate max-w-[100px] md:max-w-none">{p1.name}</span>
            {renderRoundDots(p1.wins)}
        </div>
        <div className="h-4 md:h-6 w-full bg-gray-900 border-2 border-white relative skew-x-[-15deg] shadow-lg">
          <div className="h-full bg-yellow-500 transition-all duration-75" style={{ width: `${p1.health}%` }} />
        </div>
        <div className="h-2 w-[80%] bg-gray-800 border border-gray-600 mt-1 skew-x-[-15deg] relative">
            <div className="h-full bg-blue-500 transition-all duration-75" style={{ width: `${(Math.min(MAX_ENERGY, p1.energy) / MAX_ENERGY) * 100}%` }} />
            <div className="absolute left-1/3 top-0 bottom-0 w-[1px] bg-black/50 z-10"></div>
            <div className="absolute left-2/3 top-0 bottom-0 w-[1px] bg-black/50 z-10"></div>
        </div>
      </div>

      {/* Timer */}
      <div className="flex flex-col items-center justify-start -mt-2">
        <div className="text-3xl md:text-5xl font-black text-white drop-shadow-[4px_4px_0_rgba(0,0,0,1)] bg-gray-800 border-2 border-white px-2 md:px-4 py-1 md:py-2 rounded-lg">{timer}</div>
        <div className="text-[10px] md:text-xs text-gray-400 mt-1 font-bold">ROUND {round}</div>
      </div>

      {/* Player 2 HUD */}
      <div className="w-[40%] text-right flex flex-col gap-1 items-end">
        <div className="text-xs flex justify-between items-end w-full flex-row-reverse">
            <span className="text-red-400 font-bold text-sm md:text-lg drop-shadow-[2px_2px_0_rgba(0,0,0,1)] truncate max-w-[100px] md:max-w-none">{p2.name}</span>
            {renderRoundDots(p2.wins)}
        </div>
        <div className="h-4 md:h-6 w-full bg-gray-900 border-2 border-white relative skew-x-[15deg] flex justify-end shadow-lg">
          <div className="h-full bg-yellow-500 transition-all duration-75" style={{ width: `${p2.health}%` }} />
        </div>
         <div className="h-2 w-[80%] bg-gray-800 border border-gray-600 mt-1 skew-x-[15deg] flex justify-end relative">
            <div className="h-full bg-red-500 transition-all duration-75" style={{ width: `${(Math.min(MAX_ENERGY, p2.energy) / MAX_ENERGY) * 100}%` }} />
             <div className="absolute right-1/3 top-0 bottom-0 w-[1px] bg-black/50 z-10"></div>
             <div className="absolute right-2/3 top-0 bottom-0 w-[1px] bg-black/50 z-10"></div>
        </div>
      </div>
    </div>
  );
};
