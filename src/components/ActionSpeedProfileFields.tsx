import React from 'react';
import { Trash2 } from 'lucide-react';
import { ActionSpeedKeyframe } from '../types';

interface ActionSpeedProfileFieldsProps {
  value: ActionSpeedKeyframe[];
  baseSpeed: number;
  onChange: (value: ActionSpeedKeyframe[]) => void;
}

export const ActionSpeedProfileFields: React.FC<ActionSpeedProfileFieldsProps> = ({
  value,
  baseSpeed,
  onChange,
}) => {
  const updateKeyframe = (
    index: number,
    field: keyof ActionSpeedKeyframe,
    nextValue: string
  ) => {
    const parsedValue = Number(nextValue);
    if (!Number.isFinite(parsedValue)) return;
    const updated = value.map((keyframe, keyframeIndex) =>
      keyframeIndex === index ? { ...keyframe, [field]: parsedValue } : keyframe
    );
    onChange(updated.sort((a, b) => a.timeSeconds - b.timeSeconds));
  };

  const addKeyframe = () => {
    if (value.length >= 5) return;
    const lastKeyframe = value[value.length - 1];
    onChange([
      ...value,
      {
        timeSeconds: (lastKeyframe?.timeSeconds || 0) + 1,
        speed: lastKeyframe?.speed || baseSpeed,
      },
    ]);
  };

  return (
    <details className="rounded border border-cyan-500/25 bg-black/30 p-2">
      <summary className="cursor-pointer text-[10px] font-semibold text-cyan-200">
        Aumento gradual de velocidade ({value.length}/5)
      </summary>
      <p className="mt-1 text-[9px] leading-relaxed text-zinc-400">
        Defina a velocidade em diferentes tempos; a transição entre pontos é gradual.
      </p>
      {value.map((keyframe, index) => (
        <div key={`${index}-${keyframe.timeSeconds}`} className="mt-1.5 grid grid-cols-[1fr_1fr_auto] items-end gap-1.5">
          <label className="text-[9px] text-zinc-400">
            Tempo (s)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={keyframe.timeSeconds}
              onChange={(event) => updateKeyframe(index, 'timeSeconds', event.target.value)}
              className="mt-0.5 w-full rounded border border-zinc-600 bg-black/70 px-1.5 py-1 text-[10px] text-white"
            />
          </label>
          <label className="text-[9px] text-zinc-400">
            Velocidade (x)
            <input
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              value={keyframe.speed}
              onChange={(event) => updateKeyframe(index, 'speed', event.target.value)}
              className="mt-0.5 w-full rounded border border-zinc-600 bg-black/70 px-1.5 py-1 text-[10px] text-white"
            />
          </label>
          <button
            type="button"
            onClick={() => onChange(value.filter((_, keyframeIndex) => keyframeIndex !== index))}
            aria-label={`Remover ponto de velocidade ${index + 1}`}
            className="mb-0.5 rounded p-1 text-red-300 hover:bg-red-950/50"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      {value.length < 5 && (
        <button
          type="button"
          onClick={addKeyframe}
          className="mt-1.5 rounded bg-cyan-950/60 px-2 py-1 text-[9px] font-semibold text-cyan-200 hover:bg-cyan-900/70"
        >
          + Adicionar ponto ({value.length}/5)
        </button>
      )}
    </details>
  );
};
