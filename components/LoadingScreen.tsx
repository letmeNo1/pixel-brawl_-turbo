
import React from 'react';

interface LoadingScreenProps {
  progress: number;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress }) => {
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[100] font-['Press_Start_2P']">
      <h1 className="text-4xl md:text-6xl text-yellow-400 mb-12 animate-pulse tracking-widest italic">LOADING...</h1>
      
      <div className="w-64 md:w-96 h-8 border-4 border-white p-1 relative">
        <div 
          className="h-full bg-blue-600 transition-all duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <div className="mt-4 text-gray-500 text-xs font-mono">
        INITIALIZING ASSETS [{progress}%]
      </div>

      <div className="absolute bottom-8 text-[10px] text-gray-700">
        PIXEL BRAWL TURBO
      </div>
    </div>
  );
};
