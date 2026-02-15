
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

const TouchButton = ({ 
    code, 
    keyLabel, 
    color, 
    label, 
    size = 'md', 
    onTouch,
    positionClass
}: { 
    code: string, 
    keyLabel: string, 
    color: string, 
    label: string, 
    size?: 'sm'|'md'|'lg'|'xl', 
    onTouch: (k: string, p: boolean) => void,
    positionClass: string
}) => {
  const sizeClasses = { 
      sm: 'w-12 h-12 text-[9px]', 
      md: 'w-16 h-16 text-[10px]', 
      lg: 'w-20 h-20 text-xs',
      xl: 'w-24 h-24 text-sm'
  };
  
  const handleStart = (e: React.TouchEvent) => {
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(15);
      onTouch(code, true);
  };

  const handleEnd = (e: React.TouchEvent) => {
      e.preventDefault();
      onTouch(code, false);
  };
  
  return (
      <div 
        className={`absolute ${positionClass} ${sizeClasses[size]} rounded-full border-4 border-black/30 ${color} shadow-[0_4px_0_rgba(0,0,0,0.5)] active:shadow-none active:translate-y-[4px] active:brightness-110 flex items-center justify-center font-bold text-white transition-all select-none touch-none z-50`}
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd} // Important for when finger slides off
      >
          <div className="flex flex-col items-center leading-none pointer-events-none drop-shadow-md">
              <span className="font-black tracking-wide">{label}</span>
              <span className="text-[8px] opacity-70 font-mono mt-0.5">[{keyLabel}]</span>
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
    <div className="absolute inset-0 z-40 pointer-events-none select-none overflow-hidden touch-none">
        {/* Left Joystick Area */}
        <div className="absolute bottom-12 left-12 w-48 h-48 pointer-events-auto">
            {/* Base */}
            <div 
              className="w-full h-full bg-black/40 rounded-full border-4 border-white/20 relative flex items-center justify-center backdrop-blur-sm shadow-2xl"
              onTouchStart={onJoystickStart}
              onTouchMove={onJoystickMove}
              onTouchEnd={onJoystickEnd}
              onTouchCancel={onJoystickEnd}
            >
                {/* D-Pad Arrows Visual */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/30 text-2xl font-black">▲</div>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-2xl font-black">▼</div>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-2xl font-black">◀</div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 text-2xl font-black">▶</div>

                {/* Stick Cap */}
                <div 
                  className={`w-20 h-20 rounded-full shadow-[0_5px_0_rgba(0,0,0,0.5)] border-4 border-black/20 ${joystickActive ? 'bg-blue-500 translate-y-1 shadow-none' : 'bg-blue-600'} transition-transform duration-75`}
                  style={{ 
                      transform: `translate(${joystickVisual.x}px, ${joystickVisual.y}px) ${joystickActive ? 'scale(0.95)' : ''}`,
                  }}
                >
                    <div className="w-full h-full rounded-full bg-gradient-to-t from-black/20 to-white/20"></div>
                </div>
            </div>
        </div>

        {/* Right Button Cluster - Arcade Layout */}
        <div className="absolute bottom-6 right-6 w-80 h-64 pointer-events-auto">
             
             {/* Primary Actions (Thumb Natural Resting Position) */}
             
             {/* ATTACK (J) - The big red button */}
             <TouchButton 
                code={P1_KEYS.ATTACK} 
                keyLabel="J" 
                color="bg-red-600" 
                label="ATK" 
                size="xl" 
                onTouch={onBtnTouch} 
                positionClass="bottom-12 right-24"
             />

             {/* JUMP (K) - The green button next to attack */}
             <TouchButton 
                code={P1_KEYS.JUMP} 
                keyLabel="K" 
                color="bg-green-600" 
                label="JUMP" 
                size="lg" 
                onTouch={onBtnTouch} 
                positionClass="bottom-2 right-2"
             />

             {/* Secondary Actions */}

             {/* SKILL (I) - Blue button above attack */}
             <TouchButton 
                code={P1_KEYS.SKILL_RANGED} 
                keyLabel="I" 
                color="bg-blue-600" 
                label="SKILL" 
                size="md" 
                onTouch={onBtnTouch} 
                positionClass="bottom-40 right-20"
             />

             {/* TELEPORT (L) - Yellow button left of attack */}
             <TouchButton 
                code={P1_KEYS.TELEPORT} 
                keyLabel="L" 
                color="bg-yellow-500" 
                label="TELE" 
                size="md" 
                onTouch={onBtnTouch} 
                positionClass="bottom-4 right-48"
             />

             {/* Specials */}

             {/* ULTIMATE (O) - Purple button top right (harder to hit accidentally) */}
             <TouchButton 
                code={P1_KEYS.ULT} 
                keyLabel="O" 
                color="bg-purple-600" 
                label="ULT" 
                size="sm" 
                onTouch={onBtnTouch} 
                positionClass="bottom-44 right-2"
             />
             
             {/* DODGE (Space) - Gray button bottom left of cluster */}
             <TouchButton 
                code={P1_KEYS.DODGE} 
                keyLabel="SPC" 
                color="bg-gray-500" 
                label="DODGE" 
                size="sm" 
                onTouch={onBtnTouch} 
                positionClass="bottom-0 right-32"
             />
        </div>
    </div>
  );
};
