import React, { useState } from 'react';
import { Sparkles, X, User, ChevronUp, ChevronDown, Plus, GripVertical } from 'lucide-react';
import { RoomAccessSlot, StoreAvatar, AvatarPoseConfig } from '../types';

interface RoomAccessBarProps {
  slots: RoomAccessSlot[];
  onUpdateSlots: (newSlots: RoomAccessSlot[]) => void;
  onSlotClick?: (slot: RoomAccessSlot) => void;
  activeAvatarId?: string;
  activePoseId?: string;
  isInsideRoom?: boolean;
  onOpenManageDrawer?: () => void;
  onShowToast?: (msg: string) => void;
}

export const RoomAccessBar: React.FC<RoomAccessBarProps> = ({
  slots,
  onUpdateSlots,
  onSlotClick,
  activeAvatarId,
  activePoseId,
  isInsideRoom = false,
  onOpenManageDrawer,
  onShowToast,
}) => {
  const [draggedSlotIndex, setDraggedSlotIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Pad or ensure 8 slots
  const fullSlots: Array<RoomAccessSlot | null> = Array.from({ length: 8 }, (_, idx) => {
    return slots.find((s) => s.slotIndex === idx) || null;
  });

  const handleDragOver = (e: React.DragEvent, slotIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (dragOverIndex !== slotIdx) {
      setDragOverIndex(slotIdx);
    }
  };

  const handleDragLeave = (slotIdx: number) => {
    if (dragOverIndex === slotIdx) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    // 1. Check if dragging from another slot (re-ordering)
    if (draggedSlotIndex !== null) {
      if (draggedSlotIndex === targetIndex) return;
      const newSlots = [...slots];
      const sourceSlot = newSlots.find((s) => s.slotIndex === draggedSlotIndex);
      const destSlot = newSlots.find((s) => s.slotIndex === targetIndex);

      if (sourceSlot) {
        sourceSlot.slotIndex = targetIndex;
      }
      if (destSlot) {
        destSlot.slotIndex = draggedSlotIndex;
      }

      onUpdateSlots(newSlots);
      setDraggedSlotIndex(null);
      if (onShowToast) onShowToast(`Slot ${draggedSlotIndex + 1} movido para Slot ${targetIndex + 1}!`);
      return;
    }

    // 2. Check if dropping an Avatar or Pose from lists
    try {
      const rawData = e.dataTransfer.getData('application/json');
      if (!rawData) return;
      const payload = JSON.parse(rawData);

      if (payload.type === 'avatar' && payload.avatar) {
        const av: StoreAvatar = payload.avatar;
        const newSlotItem: RoomAccessSlot = {
          id: `access-av-${av.id}-${Date.now()}`,
          slotIndex: targetIndex,
          type: 'avatar',
          itemId: av.id,
          name: av.name,
          thumbnailUrl: av.thumb || '',
          badge: 'AVATAR',
          avatarData: av,
        };

        const filtered = slots.filter((s) => s.slotIndex !== targetIndex);
        const updated = [...filtered, newSlotItem];
        onUpdateSlots(updated);
        if (onShowToast) {
          onShowToast(`✨ Avatar "${av.name}" adicionado ao Slot ${targetIndex + 1} de Acesso das Rooms!`);
        }
      } else if (payload.type === 'pose' && payload.pose) {
        const pose: AvatarPoseConfig = payload.pose;
        const newSlotItem: RoomAccessSlot = {
          id: `access-pose-${pose.id}-${Date.now()}`,
          slotIndex: targetIndex,
          type: 'pose',
          itemId: pose.id,
          name: pose.name,
          thumbnailUrl: pose.thumbnailUrl || '',
          badge: 'POSE',
          poseData: pose,
        };

        const filtered = slots.filter((s) => s.slotIndex !== targetIndex);
        const updated = [...filtered, newSlotItem];
        onUpdateSlots(updated);
        if (onShowToast) {
          onShowToast(`✨ Pose "${pose.name}" adicionada ao Slot ${targetIndex + 1} de Acesso das Rooms!`);
        }
      }
    } catch (err) {
      console.warn('Error handling drop on room access bar:', err);
    }
  };

  const handleRemoveSlot = (e: React.MouseEvent, slotIdx: number) => {
    e.stopPropagation();
    const updated = slots.filter((s) => s.slotIndex !== slotIdx);
    onUpdateSlots(updated);
    if (onShowToast) onShowToast(`Slot ${slotIdx + 1} liberado.`);
  };

  return (
    <div
      className={`z-30 transition-all select-none ${
        isInsideRoom
          ? 'absolute bottom-4 left-1/2 -translate-x-1/2 max-w-[96vw]'
          : 'relative w-full border-t border-[#262833]/90 bg-[#0d0e12]/95 backdrop-blur-md px-6 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.6)]'
      }`}
    >
      {/* Header Info Bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-[#ffd700]/20 border border-[#ffd700]/50 flex items-center justify-center text-[#ffd700]">
            <Sparkles className="w-3 h-3" />
          </div>
          <span className="text-xs font-serif font-bold text-white tracking-wide">
            Inventário de Acesso das Rooms
          </span>
          <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">
            (Arraste Avatares ou Poses aqui para acesso rápido nas salas 3D)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {slots.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Deseja limpar todos os slots de acesso das rooms?')) {
                  onUpdateSlots([]);
                  if (onShowToast) onShowToast('Inventário de acesso das rooms limpo.');
                }
              }}
              className="text-[10px] font-mono text-zinc-400 hover:text-red-400 px-2 py-0.5 rounded bg-zinc-900/60 border border-white/5 cursor-pointer transition-colors"
            >
              Limpar Todos
            </button>
          )}

          {isInsideRoom && onOpenManageDrawer && (
            <button
              type="button"
              onClick={onOpenManageDrawer}
              className="text-[10px] font-bold text-black bg-[#ffd700] hover:brightness-110 px-2.5 py-1 rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-md"
            >
              <Plus className="w-3 h-3" />
              <span>Gerenciar</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
            title={isCollapsed ? 'Expandir barra' : 'Recolher barra'}
          >
            {isCollapsed ? <ChevronUp className="w-3.5 h-3.5 text-[#ffd700]" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin scrollbar-thumb-zinc-800">
          {fullSlots.map((slot, index) => {
            const isDragOver = dragOverIndex === index;
            const isAvatar = slot?.type === 'avatar';
            const isActive =
              (isAvatar && slot?.itemId === activeAvatarId) ||
              (!isAvatar && slot?.itemId === activePoseId);

            return (
              <div
                key={index}
                id={`room-access-slot-${index}`}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={() => handleDragLeave(index)}
                onDrop={(e) => handleDrop(e, index)}
                draggable={Boolean(slot)}
                onDragStart={(e) => {
                  if (slot) {
                    setDraggedSlotIndex(index);
                    e.dataTransfer.setData('text/plain', `slot-${index}`);
                  }
                }}
                onDragEnd={() => setDraggedSlotIndex(null)}
                onClick={() => {
                  if (slot && onSlotClick) {
                    onSlotClick(slot);
                  }
                }}
                className={`relative flex-shrink-0 w-20 md:w-24 h-24 rounded-xl border transition-all duration-200 flex flex-col items-center justify-between p-1.5 cursor-pointer group ${
                  isDragOver
                    ? 'border-[#ffd700] bg-[#ffd700]/20 ring-2 ring-[#ffd700] scale-105 shadow-[0_0_20px_rgba(255,215,0,0.4)]'
                    : slot
                    ? isActive
                      ? 'bg-[#181a24] border-[#ffd700] ring-1 ring-[#ffd700]/70 shadow-[0_0_14px_rgba(255,215,0,0.3)]'
                      : 'bg-[#121319] border-white/10 hover:border-[#ffd700]/60 hover:bg-[#161822]'
                    : 'bg-[#0f1015]/80 border-dashed border-zinc-700/60 hover:border-[#ffd700]/50 hover:bg-[#151620]'
                }`}
              >
                {/* Slot index badge */}
                <div className="absolute top-1 left-1 z-10 w-4 h-4 rounded-md bg-black/80 border border-white/10 text-[9px] font-mono font-bold text-zinc-300 flex items-center justify-center">
                  {index + 1}
                </div>

                {/* Remove button if filled */}
                {slot && (
                  <button
                    type="button"
                    onClick={(e) => handleRemoveSlot(e, index)}
                    className="absolute top-1 right-1 z-10 w-4 h-4 rounded-full bg-black/70 hover:bg-red-950 text-zinc-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    title="Remover deste slot"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}

                {slot ? (
                  <>
                    {/* Item Thumbnail */}
                    <div className="relative w-full h-11 rounded-lg overflow-hidden bg-black/40 mt-3 flex items-center justify-center">
                      {slot.thumbnailUrl ? (
                        <img
                          src={slot.thumbnailUrl}
                          alt={slot.name}
                          className="w-full h-full object-cover filter contrast-105 group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="w-5 h-5 text-zinc-500" />
                      )}

                      {/* Type Badge (Avatar or Pose) */}
                      <div
                        className={`absolute bottom-0 inset-x-0 text-center py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider ${
                          isAvatar ? 'bg-cyan-950/90 text-cyan-300' : 'bg-amber-950/90 text-[#ffd700]'
                        }`}
                      >
                        {slot.badge || (isAvatar ? 'AVATAR' : 'POSE')}
                      </div>
                    </div>

                    {/* Name */}
                    <span className="text-[10px] font-medium text-zinc-200 truncate w-full text-center mt-1 leading-tight group-hover:text-[#ffd700]">
                      {slot.name}
                    </span>

                    {/* Action pill / indicator */}
                    <div className="w-full text-center">
                      <span
                        className={`text-[8px] font-mono px-1 rounded ${
                          isActive
                            ? 'bg-[#ffd700] text-black font-bold'
                            : 'text-zinc-500 group-hover:text-zinc-300'
                        }`}
                      >
                        {isInsideRoom ? (isActive ? '● Ativo' : `Atalho ${index + 1}`) : 'Pronto'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center p-1">
                    <span className="text-zinc-600 group-hover:text-[#ffd700] text-xs font-bold mb-0.5">
                      +
                    </span>
                    <span className="text-[8px] text-zinc-500 group-hover:text-zinc-300 leading-tight">
                      Solte Avatar ou Pose
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
