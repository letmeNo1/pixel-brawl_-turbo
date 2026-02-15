
import React from 'react';
import { P1_KEYS } from '../constants';

interface TouchControlsProps {
  onJoystickStart: (e: React.TouchEvent) => void;
  onJoystickMove: (e: React.TouchEvent) => void;
  onJoystickEnd: () => void;
  joystickVisual: { x: number; y: number };
  joystickActive: boolean;
  onBtnTouch: (key: string, isPressed: boolean) => void;
}

const TouchButton = ({ code, keyLabel, color, label, size = 'md', onTouch }: { code: string, keyLabel: string, color: string, label: string, size?: 'sm'|'md'|'lg'|'xl', onTouch: (k: string, p: boolean) => void }) => {
  const sizeClasses = { 
      sm: 'w-12 h-12 text-[8px]', 
      md: 'w-14 h-14 text-[10px]', 
      lg: 'w-16 h-16 text-xs',
      xl: 'w-20 h-20 text-sm'
  };
  
  const handleStart = (e: React.TouchEvent) => {
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(10);
      onTouch(code, true);
  };

  const handleEnd = (e: React.TouchEvent) => {
      e.preventDefault();
      onTouch(code, false);
  };
  
  return (
      <div 
        className={`${sizeClasses[size]} rounded-xl border-b-4 border-r-4 border-white/20 active:border-b-0 active:border-r-0 active:translate-y-1 active:translate-x-1 ${color} bg-opacity-80 backdrop-blur-sm flex items-center justify-center font-bold text-white shadow-lg transition-all select-none touch-none`}
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
      >
          <div className="flex flex-col items-center leading-tight pointer-events-none">
              <span className="drop-shadow-md">{label}</span>
              <span className="text-[8px] opacity-50 font-mono tracking-tighter">[{keyLabel}]</span>
          </div>
      </div>
  );
};

export const TouchControls: React.FC<TouchControlsProps> = ({
  onJoystickStart,
  onJoystickMove,
  onJoystickEnd,
  joystickVisual,
  joystickActive,
  onBtnTouch
}) => {
  return (
    <div className="absolute inset-0 z-50 pointer-events-none select-none overflow-hidden">
        {/* Left Joystick Area */}
        <div className="absolute bottom-8 left-8 w-56 h-56 pointer-events-auto flex items-end justify-start">
            <div 
              className="w-40 h-40 bg-gray-900/60 rounded-full border-4 border-gray-600 relative flex items-center justify-center backdrop-blur-md shadow-2xl"
              onTouchStart={onJoystickStart}
              onTouchMove={onJoystickMove}
              onTouchEnd={onJoystickEnd}
              onTouchCancel={onJoystickEnd}
            >
                {/* D-Pad Visual Guide */}
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                     <div className="absolute top-2 left-1/2 -translate-x-1/2 text-white text-2xl font-bold">W</div>
                     <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white text-2xl font-bold">S</div>
                     <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white text-2xl font-bold">A</div>
                     <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white text-2xl font-bold">D</div>
                </div>

                {/* Stick Puck */}
                <div 
                  className={`w-16 h-16 rounded-full shadow-2xl border-2 border-gray-400 ${joystickActive ? 'bg-blue-600 scale-95' : 'bg-gray-700'}`} 
                  style={{ 
                      transform: `translate(${joystickVisual.x}px, ${joystickVisual.y}px)`,
                      transition: joystickActive ? 'none' : 'transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                  }}
                >
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-white/20 to-black/20"></div>
                </div>
            </div>
        </div>

        {/* Right Button Cluster - Ergonomic Arc Layout */}
        <div className="absolute bottom-4 right-4 w-72 h-72 pointer-events-auto">
             <div className="relative w-full h-full">
                 
                 {/* Main Attack (J) - Primary Action - Red */}
                 <div className="absolute bottom-16 right-24">
                    <TouchButton code={P1_KEYS.ATTACK} keyLabel="J" color="bg-red-600" label="ATK" size="xl" onTouch={onBtnTouch} />
                 </div>

                 {/* Jump (K) - Secondary Action - Green */}
                 <div className="absolute bottom-2 right-2">
                    <TouchButton code={P1_KEYS.JUMP} keyLabel="K" color="bg-green-600" label="JUMP" size="lg" onTouch={onBtnTouch} />
                 </div>

                 {/* Teleport (L) - Mobility - Yellow */}
                 <div className="absolute bottom-8 right-48">
                    <TouchButton code={P1_KEYS.TELEPORT} keyLabel="L" color="bg-yellow-600" label="TELE" size="md" onTouch={onBtnTouch} />
                 </div>

                 {/* Skill (I) - Special - Blue */}
                 <div className="absolute bottom-40 right-16">
                    <TouchButton code={P1_KEYS.SKILL_RANGED} keyLabel="I" color="bg-blue-600" label="SKILL" size="md" onTouch={onBtnTouch} />
                 </div>

                 {/* Ult (O) - Ultimate - Purple */}
                 <div className="absolute bottom-36 right-0">
                    <TouchButton code={P1_KEYS.ULT} keyLabel="O" color="bg-purple-600" label="ULT" size="sm" onTouch={onBtnTouch} />
                 </div>
                 
                 {/* Dodge (Space) - Defensive - Gray */}
                 <div className="absolute bottom-0 right-32">
                    <TouchButton code={P1_KEYS.DODGE} keyLabel="SPC" color="bg-gray-600" label="DODGE" size="sm" onTouch={onBtnTouch} />
                 </div>
             </div>
        </div>
    </div>
  );
};
