import React, { useRef, useState } from 'react';
import {
  GizmoMode,
  AvatarTransform,
} from '../types';
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  RotateCw,
  Plus,
  Minus,
  Minimize2,
  Maximize2,
  ChevronUp,
  ChevronDown,
  Crosshair,
} from 'lucide-react';

interface GizmoWidgetProps {
  mode: GizmoMode;
  onCycleMode: () => void;
  transform: AvatarTransform;
  onChangeTransform: (newTransform: AvatarTransform) => void;
  onSetMode?: (mode: GizmoMode) => void;
  spotRadius?: number;
}

export const GizmoWidget: React.FC<GizmoWidgetProps> = ({
  mode,
  onCycleMode,
  transform,
  onChangeTransform,
  onSetMode,
  spotRadius = 0.45,
}) => {
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // Map legacy names if passed
  const effectiveMode =
    mode === 'scale' ? 'escalar' : mode === 'angle' ? 'rodar' : mode === 'sizeY' ? 'elevar' : mode;

  // Normalized Mode configs matching Creator Mode
  // mover = Esmeralda/Ciano, escalar = Amarelo Dourado, rodar = Roxo, elevar = Azul Celeste
  const modeConfigs: Record<
    string,
    {
      label: string;
      colorName: string;
      hex: string;
      ringColor: string;
      glowColor: string;
      centerColor: string;
      secondaryColor: string;
      desc: string;
      displayVal: string;
    }
  > = {
    mover: {
      label: 'Mover',
      colorName: 'esmeralda',
      hex: '#10b981',
      ringColor: 'rgba(16, 185, 129, 0.75)',
      glowColor: 'rgba(16, 185, 129, 0.45)',
      centerColor: '#a7f3d0',
      secondaryColor: '#059669',
      desc: 'Mover · clique nas setas ou arraste',
      displayVal: `X:${(transform.positionOffset?.[0] || 0).toFixed(2)} Z:${(transform.positionOffset?.[2] || 0).toFixed(2)}`,
    },
    escalar: {
      label: 'Escala',
      colorName: 'amarelo',
      hex: '#eab308',
      ringColor: 'rgba(234, 179, 8, 0.75)',
      glowColor: 'rgba(234, 179, 8, 0.45)',
      centerColor: '#fef08a',
      secondaryColor: '#f59e0b',
      desc: 'Escala · clique + / - ou arraste',
      displayVal: `${Math.round(transform.scale * 100)}%`,
    },
    rodar: {
      label: 'Rotação',
      colorName: 'roxo',
      hex: '#a855f7',
      ringColor: 'rgba(168, 85, 247, 0.75)',
      glowColor: 'rgba(168, 85, 247, 0.45)',
      centerColor: '#e9d5ff',
      secondaryColor: '#9333ea',
      desc: 'Rotação · gire ou clique nas setas',
      displayVal: `${Math.round(transform.angle)}°`,
    },
    elevar: {
      label: 'Elevar (Y)',
      colorName: 'ciano',
      hex: '#06b6d4',
      ringColor: 'rgba(6, 182, 212, 0.75)',
      glowColor: 'rgba(6, 182, 212, 0.45)',
      centerColor: '#a5f3fc',
      secondaryColor: '#0891b2',
      desc: 'Elevar (Y) · clique no centro p/ trocar',
      displayVal: `${Math.round(transform.sizeY * 100)}%`,
    },
  };

  const currentConfig = modeConfigs[effectiveMode] || modeConfigs['mover'];

  // Current distance from spot center
  const curX = transform.positionOffset?.[0] || 0;
  const curY = transform.positionOffset?.[1] || 0;
  const curZ = transform.positionOffset?.[2] || 0;
  const curDistance = Math.hypot(curX, curZ);
  const isAtSpotLimit = curDistance >= spotRadius * 0.96;

  // Strict spot radius clamp helper
  const clampToSpotRadius = (x: number, z: number, r: number = spotRadius): [number, number] => {
    const dist = Math.hypot(x, z);
    if (dist <= r || dist === 0) {
      return [parseFloat(x.toFixed(3)), parseFloat(z.toFixed(3))];
    }
    const factor = r / dist;
    return [
      parseFloat((x * factor).toFixed(3)),
      parseFloat((z * factor).toFixed(3)),
    ];
  };

  // Fine-tuning nudge handlers for mobile and desktop clicks
  const STEP_SIZE = 0.04; // 4cm per click

  const handleNudge = (deltaX: number, deltaZ: number) => {
    const [clampedX, clampedZ] = clampToSpotRadius(curX + deltaX, curZ + deltaZ, spotRadius);
    onChangeTransform({
      ...transform,
      positionOffset: [clampedX, curY, clampedZ],
    });
  };

  const handleResetPosition = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChangeTransform({
      ...transform,
      positionOffset: [0, 0, 0],
    });
  };

  const handleNudgeRotate = (deltaDeg: number) => {
    const nextAngle = (transform.angle + deltaDeg + 360) % 360;
    onChangeTransform({ ...transform, angle: Math.round(nextAngle) });
  };

  const handleNudgeScale = (deltaScale: number) => {
    const nextScale = Math.min(2.5, Math.max(0.4, transform.scale + deltaScale));
    onChangeTransform({ ...transform, scale: parseFloat(nextScale.toFixed(2)) });
  };

  // Drag on 2D circular gizmo to adjust parameters
  const handleMouseDown = (e: React.MouseEvent) => {
    // If clicking on a control button, don't drag
    if ((e.target as HTMLElement).closest('button')) return;

    isDraggingRef.current = true;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = moveEvent.clientX - dragStartPosRef.current.x;
      const deltaY = dragStartPosRef.current.y - moveEvent.clientY;
      const movement = deltaX + deltaY;

      if (effectiveMode === 'mover') {
        const rawNewX = curX + deltaX * 0.005;
        const rawNewZ = curZ - deltaY * 0.005;
        const [clampedX, clampedZ] = clampToSpotRadius(rawNewX, rawNewZ, spotRadius);
        onChangeTransform({
          ...transform,
          positionOffset: [clampedX, curY, clampedZ],
        });
      } else if (effectiveMode === 'escalar') {
        const nextScale = Math.min(2.5, Math.max(0.4, transform.scale + movement * 0.004));
        onChangeTransform({ ...transform, scale: parseFloat(nextScale.toFixed(2)) });
      } else if (effectiveMode === 'rodar') {
        const nextAngle = (transform.angle + movement * 0.8 + 360) % 360;
        onChangeTransform({ ...transform, angle: Math.round(nextAngle) });
      } else if (effectiveMode === 'elevar') {
        const nextSizeY = Math.min(2.0, Math.max(0.5, transform.sizeY + movement * 0.004));
        onChangeTransform({ ...transform, sizeY: parseFloat(nextSizeY.toFixed(2)) });
      }

      dragStartPosRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Touch drag for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    dragStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isDraggingRef.current = true;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (!isDraggingRef.current || moveEvent.touches.length !== 1) return;
      const t = moveEvent.touches[0];
      const deltaX = t.clientX - dragStartPosRef.current.x;
      const deltaY = dragStartPosRef.current.y - t.clientY;

      if (effectiveMode === 'mover') {
        const rawNewX = curX + deltaX * 0.005;
        const rawNewZ = curZ - deltaY * 0.005;
        const [clampedX, clampedZ] = clampToSpotRadius(rawNewX, rawNewZ, spotRadius);
        onChangeTransform({
          ...transform,
          positionOffset: [clampedX, curY, clampedZ],
        });
      }
      dragStartPosRef.current = { x: t.clientX, y: t.clientY };
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

  // Compact minimized view for mobile
  if (isMinimized) {
    return (
      <div className="select-none pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121317]/95 hover:bg-[#1c1e24] border border-[#10b981]/50 text-white text-xs font-semibold shadow-2xl backdrop-blur-md cursor-pointer transition-all hover:scale-105 active:scale-95"
          title="Expandir Gizmo de controle do avatar"
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentConfig.hex }} />
          <span>Gizmo ({currentConfig.label})</span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        </button>
      </div>
    );
  }

  // 2D Puck indicator position inside the circle (-1 to +1 normalized to circle radius)
  const normX = spotRadius > 0 ? (curX / spotRadius) * 28 : 0;
  const normZ = spotRadius > 0 ? (curZ / spotRadius) * 28 : 0;

  return (
    <div className="flex flex-col items-start gap-1 select-none pointer-events-auto">
      {/* Top Header: Mode Pills + Minimize */}
      <div className="flex items-center justify-between w-full max-w-[160px] bg-[#121317]/90 px-1 py-1 rounded-xl border border-white/10 shadow-lg text-[10px] backdrop-blur-md">
        <div className="flex items-center gap-1">
          {(['mover', 'escalar', 'rodar'] as const).map((m) => {
            const isActive = effectiveMode === m;
            const conf = modeConfigs[m];
            return (
              <button
                key={m}
                type="button"
                onClick={() => (onSetMode ? onSetMode(m) : onCycleMode())}
                className={`px-1.5 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                  isActive ? 'text-black shadow-md' : 'text-zinc-400 hover:text-white'
                }`}
                style={{ backgroundColor: isActive ? conf.hex : undefined }}
              >
                {conf.label}
              </button>
            );
          })}
        </div>

        {/* Minimize Button to keep mobile screen clean */}
        <button
          type="button"
          onClick={() => setIsMinimized(true)}
          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Minimizar Gizmo"
        >
          <ChevronUp className="w-3 h-3" />
        </button>
      </div>

      {/* Main Gizmo Container */}
      <div
        id="gizmo-container"
        className="relative w-40 h-40 bg-[#16171a]/95 backdrop-blur-md rounded-2xl border border-white/10 p-2 shadow-2xl flex flex-col items-center justify-center cursor-grab active:cursor-grabbing group overflow-hidden"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        title="Arraste para ajuste contínuo ou use as setas para ajuste fino sem sair do spot"
      >
        {/* Glow backdrop */}
        <div
          className="absolute inset-0 transition-colors duration-500 pointer-events-none opacity-25 blur-xl"
          style={{ backgroundColor: currentConfig.glowColor }}
        />

        {/* Gyroscope SVG background */}
        <svg className="w-32 h-32 pointer-events-none opacity-40 absolute" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="38"
            fill="none"
            stroke={currentConfig.hex}
            strokeWidth="1.5"
            strokeDasharray="4 2"
          />
          <circle
            cx="50"
            cy="50"
            r="20"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />
        </svg>

        {/* MOVER MODE: Integrated 4 Directional Arrows / D-Pad directly ON the Green Gizmo */}
        {effectiveMode === 'mover' && (
          <div
            className="relative w-32 h-32 flex items-center justify-center select-none"
            onClick={(e) => {
              // Tap anywhere on the green disc to nudge towards click point
              const target = e.currentTarget.getBoundingClientRect();
              const clickRelX = (e.clientX - (target.left + target.width / 2)) / (target.width / 2);
              const clickRelY = (e.clientY - (target.top + target.height / 2)) / (target.height / 2);
              // Nudge by 0.04m in click direction
              if (Math.hypot(clickRelX, clickRelY) > 0.2) {
                handleNudge(clickRelX * STEP_SIZE, clickRelY * STEP_SIZE);
              }
            }}
          >
            {/* Spot Perimeter Disc (Green Gizmo Base) */}
            <div
              className={`w-28 h-28 rounded-full border-2 transition-all flex items-center justify-center relative shadow-inner ${
                isAtSpotLimit
                  ? 'border-amber-400/80 bg-amber-500/15 shadow-[0_0_15px_rgba(245,158,11,0.35)]'
                  : 'border-[#10b981] bg-[#10b981]/10 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
              }`}
            >
              {/* Internal Concentric Guide Rings */}
              <div className="w-20 h-20 rounded-full border border-dashed border-[#10b981]/40 pointer-events-none" />
              <div className="w-10 h-10 rounded-full border border-[#10b981]/25 pointer-events-none absolute" />

              {/* Dynamic Avatar Offset Indicator Puck (Green Gizmo Puck) */}
              <div
                className="w-5 h-5 rounded-full bg-[#10b981] border-2 border-white shadow-[0_0_10px_#10b981] absolute transition-transform duration-75 flex items-center justify-center pointer-events-none z-10"
                style={{
                  transform: `translate(${normX}px, ${normZ}px)`,
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              </div>
            </div>

            {/* North Arrow (Avançar -Z): Placed directly on top rim of green gizmo */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNudge(0, -STEP_SIZE);
              }}
              className="absolute top-0.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-[#10b981]/30 hover:bg-[#10b981] active:bg-[#059669] border border-[#10b981] text-emerald-100 hover:text-white flex items-center justify-center shadow-lg transition-all cursor-pointer z-20 active:scale-90"
              title="Ajuste fino: Avançar (-Z) 4cm dentro do raio do spot"
            >
              <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            {/* South Arrow (Recuar +Z): Placed directly on bottom rim of green gizmo */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNudge(0, STEP_SIZE);
              }}
              className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-[#10b981]/30 hover:bg-[#10b981] active:bg-[#059669] border border-[#10b981] text-emerald-100 hover:text-white flex items-center justify-center shadow-lg transition-all cursor-pointer z-20 active:scale-90"
              title="Ajuste fino: Recuar (+Z) 4cm dentro do raio do spot"
            >
              <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            {/* West Arrow (Esquerda -X): Placed directly on left rim of green gizmo */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNudge(-STEP_SIZE, 0);
              }}
              className="absolute left-0.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#10b981]/30 hover:bg-[#10b981] active:bg-[#059669] border border-[#10b981] text-emerald-100 hover:text-white flex items-center justify-center shadow-lg transition-all cursor-pointer z-20 active:scale-90"
              title="Ajuste fino: Esquerda (-X) 4cm dentro do raio do spot"
            >
              <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            {/* East Arrow (Direita +X): Placed directly on right rim of green gizmo */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNudge(STEP_SIZE, 0);
              }}
              className="absolute right-0.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#10b981]/30 hover:bg-[#10b981] active:bg-[#059669] border border-[#10b981] text-emerald-100 hover:text-white flex items-center justify-center shadow-lg transition-all cursor-pointer z-20 active:scale-90"
              title="Ajuste fino: Direita (+X) 4cm dentro do raio do spot"
            >
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            {/* Center Reset / Mode Switch Button */}
            <button
              id="gizmo-center-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCycleMode();
              }}
              onDoubleClick={handleResetPosition}
              className="absolute z-20 w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-90 shadow-md cursor-pointer bg-[#047857]/80 hover:bg-[#10b981] border border-white/80"
              title="Clique para alternar Modo. Clique duplo centraliza no spot."
            >
              <Crosshair className="w-3 h-3 text-white" />
            </button>
          </div>
        )}

        {/* ROTATE MODE: Left / Right Rotation Buttons */}
        {effectiveMode === 'rodar' && (
          <div className="relative w-28 h-28 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNudgeRotate(-15);
              }}
              className="w-8 h-8 rounded-xl bg-purple-500/20 hover:bg-purple-500/40 active:bg-purple-500 border border-purple-400/60 text-purple-300 hover:text-white flex items-center justify-center shadow-md transition-all cursor-pointer active:scale-95"
              title="Girar 15° anti-horário"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Center Mode Switch Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCycleMode();
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center shadow-md cursor-pointer bg-[#a855f7] border border-white/80 hover:scale-110 active:scale-90 transition-transform"
              title="Clique para alternar Modo"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-white" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNudgeRotate(15);
              }}
              className="w-8 h-8 rounded-xl bg-purple-500/20 hover:bg-purple-500/40 active:bg-purple-500 border border-purple-400/60 text-purple-300 hover:text-white flex items-center justify-center shadow-md transition-all cursor-pointer active:scale-95"
              title="Girar 15° horário"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* SCALE MODE: Plus / Minus Scale Buttons */}
        {effectiveMode === 'escalar' && (
          <div className="relative w-28 h-28 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNudgeScale(-0.05);
              }}
              className="w-8 h-8 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/40 active:bg-yellow-500 border border-yellow-400/60 text-yellow-300 hover:text-white flex items-center justify-center shadow-md transition-all cursor-pointer active:scale-95"
              title="Reduzir escala em 5%"
            >
              <Minus className="w-4 h-4" />
            </button>

            {/* Center Mode Switch Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCycleMode();
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center shadow-md cursor-pointer bg-[#eab308] border border-white/80 hover:scale-110 active:scale-90 transition-transform"
              title="Clique para alternar Modo"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-white" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNudgeScale(0.05);
              }}
              className="w-8 h-8 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/40 active:bg-yellow-500 border border-yellow-400/60 text-yellow-300 hover:text-white flex items-center justify-center shadow-md transition-all cursor-pointer active:scale-95"
              title="Aumentar escala em 5%"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Bottom stats and radius limit warning */}
        <div className="absolute bottom-1 inset-x-2 flex items-center justify-between text-[9px] pointer-events-none font-mono">
          <span className="text-zinc-500 uppercase">{currentConfig.label}</span>
          {effectiveMode === 'mover' && isAtSpotLimit ? (
            <span className="text-red-400 font-bold uppercase tracking-wider text-[8px] animate-pulse">
              ● Raio Máximo
            </span>
          ) : (
            <span className="font-semibold" style={{ color: currentConfig.hex }}>
              {currentConfig.displayVal}
            </span>
          )}
        </div>
      </div>

      {/* Caption & Reset Button */}
      <div className="flex items-center justify-between w-full max-w-[160px] px-1 text-[10px] text-zinc-400 select-none">
        <span className="truncate">Raio spot: {spotRadius}m</span>
        {effectiveMode === 'mover' && (curX !== 0 || curZ !== 0) && (
          <button
            type="button"
            onClick={handleResetPosition}
            className="text-[#10b981] hover:underline cursor-pointer text-[9px] font-semibold"
          >
            Centralizar
          </button>
        )}
      </div>
    </div>
  );
};
