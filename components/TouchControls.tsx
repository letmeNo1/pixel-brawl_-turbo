
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

const TouchButton = ({ code, color, label, size = 'md', onTouch }: { code: string, color: string, label: string, size?: 'sm'|'md'|'lg', onTouch: (k: string, p: boolean) => void }) => {
  const sizes = { sm: 'w-12 h-12 text-xs', md: 'w-16 h-16 text-sm', lg: 'w-20 h-20 text-lg' };
  return (
      <div 
        className={`${sizes[size]} rounded-full border-4 border-black/50 ${color} flex items-center justify-center font-bold text-white shadow-[0_4px_0_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-none select-none`}
        onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); onTouch(code, true); }}
        onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onTouch(code, false); }}
      >
          {label}
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
    <div className="absolute inset-0 z-50 pointer-events-none">
        <div className="absolute bottom-10 left-10 pointer-events-auto">
            <div 
              className="w-32 h-32 bg-white/10 rounded-full border-2 border-white/30 relative flex items-center justify-center backdrop-blur-sm"
              onTouchStart={onJoystickStart}
              onTouchMove={onJoystickMove}
              onTouchEnd={onJoystickEnd}
              onTouchCancel={onJoystickEnd}
            >
                <div 
                  className="w-12 h-12 bg-white/50 rounded-full shadow-[0_4px_0_rgba(0,0,0,0.5)]" 
                  style={{ 
                      transform: `translate(${joystickVisual.x}px, ${joystickVisual.y}px)`,
                      transition: joystickActive ? 'none' : 'transform 0.1s'
                  }}
                ></div>
                <div className="absolute top-2 text-white/30 text-xs font-bold">▲</div>
                <div className="absolute bottom-2 text-white/30 text-xs font-bold">▼</div>
                <div className="absolute left-2 text-white/30 text-xs font-bold">◀</div>
                <div className="absolute right-2 text-white/30 text-xs font-bold">▶</div>
            </div>
        </div>

        <div className="absolute bottom-8 right-8 pointer-events-auto flex flex-col items-end gap-2">
            <div className="flex gap-4 items-end pr-4">
                 <div className="flex flex-col gap-4">
                      <TouchButton code={P1_KEYS.ULT} color="bg-purple-600" label="ULT" size="sm" onTouch={onBtnTouch} />
                      <TouchButton code={P1_KEYS.SKILL_RANGED} color="bg-blue-600" label="SKILL" size="sm" onTouch={onBtnTouch} />
                 </div>
                 <div className="flex flex-col gap-4 -mt-10">
                      <TouchButton code={P1_KEYS.TELEPORT} color="bg-yellow-600" label="TELE" size="sm" onTouch={onBtnTouch} />
                      <TouchButton code={P1_KEYS.ATTACK} color="bg-red-600" label="ATK" size="lg" onTouch={onBtnTouch} />
                 </div>
                 <div className="flex flex-col gap-4">
                      <TouchButton code={P1_KEYS.JUMP} color="bg-green-600" label="JUMP" size="md" onTouch={onBtnTouch} />
                      <TouchButton code={P1_KEYS.DODGE} color="bg-gray-600" label="DODGE" size="sm" onTouch={onBtnTouch} />
                 </div>
            </div>
        </div>
    </div>
  );
};
