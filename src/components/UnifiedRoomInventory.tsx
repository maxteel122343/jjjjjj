import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Plus,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Columns2,
  Rows2,
  Check,
  Zap,
  User,
  SlidersHorizontal,
  Flame,
} from 'lucide-react';
import { RoomAccessSlot, StoreAvatar, AvatarPose, AvatarPoseConfig } from '../types';

interface UnifiedRoomInventoryProps {
  slots: RoomAccessSlot[];
  onUpdateSlots: (newSlots: RoomAccessSlot[]) => void;
  onSlotClick?: (slot: RoomAccessSlot) => void;
  poses: AvatarPose[];
  selectedPoseId?: string;
  onSelectPose: (pose: AvatarPose) => void;
  storeAvatars?: StoreAvatar[];
  activeUserAvatar?: StoreAvatar | null;
  onSelectAvatar?: (avatar: StoreAvatar) => void;
  activeAvatarId?: string;
  activePoseId?: string;
  onShowToast?: (msg: string) => void;
}

export const UnifiedRoomInventory: React.FC<UnifiedRoomInventoryProps> = ({
  slots,
  onUpdateSlots,
  onSlotClick,
  poses = [],
  selectedPoseId,
  onSelectPose,
  storeAvatars = [],
  activeUserAvatar,
  onSelectAvatar,
  activeAvatarId,
  activePoseId,
  onShowToast,
}) => {
  // Orientation: horizontal (bottom bar) or vertical (side dock)
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('3d_social_room_inventory_orientation');
      if (saved === 'vertical' || saved === 'horizontal') return saved;
    }
    return 'horizontal';
  });

  const handleToggleOrientation = () => {
    const next = orientation === 'horizontal' ? 'vertical' : 'horizontal';
    setOrientation(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('3d_social_room_inventory_orientation', next);
    }
  };

  // Active Tab inside unified inventory: 'atalhos' | 'poses' | 'avatars'
  const [activeTab, setActiveTab] = useState<'atalhos' | 'poses' | 'avatars'>('atalhos');
  // Collapsed state to keep screen clean on mobile
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Drag and drop states for hotbar slots
  const [draggedSlotIndex, setDraggedSlotIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Pad 8 slots for quick access
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

    // 1. Re-ordering existing slots
    if (draggedSlotIndex !== null) {
      if (draggedSlotIndex === targetIndex) return;
      const newSlots = [...slots];
      const sourceSlot = newSlots.find((s) => s.slotIndex === draggedSlotIndex);
      const destSlot = newSlots.find((s) => s.slotIndex === targetIndex);

      if (sourceSlot) sourceSlot.slotIndex = targetIndex;
      if (destSlot) destSlot.slotIndex = draggedSlotIndex;

      onUpdateSlots(newSlots);
      setDraggedSlotIndex(null);
      if (onShowToast) onShowToast(`Slot ${draggedSlotIndex + 1} movido para Slot ${targetIndex + 1}!`);
      return;
    }

    // 2. Dropping an Avatar or Pose
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
        onUpdateSlots([...filtered, newSlotItem]);
        if (onShowToast) onShowToast(`Avatar "${av.name}" adicionado ao Slot ${targetIndex + 1}!`);
      } else if (payload.type === 'pose' && payload.pose) {
        const pose: AvatarPose = payload.pose;
        const newSlotItem: RoomAccessSlot = {
          id: `access-pose-${pose.id}-${Date.now()}`,
          slotIndex: targetIndex,
          type: 'pose',
          itemId: pose.id,
          name: pose.name,
          thumbnailUrl: pose.thumbnailUrl || '',
          badge: 'POSE',
        };
        const filtered = slots.filter((s) => s.slotIndex !== targetIndex);
        onUpdateSlots([...filtered, newSlotItem]);
        if (onShowToast) onShowToast(`Pose "${pose.name}" adicionada ao Slot ${targetIndex + 1}!`);
      }
    } catch {}
  };

  const handleRemoveSlot = (e: React.MouseEvent, targetIndex: number) => {
    e.stopPropagation();
    const updated = slots.filter((s) => s.slotIndex !== targetIndex);
    onUpdateSlots(updated);
    if (onShowToast) onShowToast(`Slot ${targetIndex + 1} esvaziado.`);
  };

  const handleAssignToFirstEmptySlot = (type: 'avatar' | 'pose', item: any) => {
    let emptyIdx = -1;
    for (let i = 0; i < 8; i++) {
      if (!slots.some((s) => s.slotIndex === i)) {
        emptyIdx = i;
        break;
      }
    }
    if (emptyIdx === -1) {
      if (onShowToast) onShowToast('Todos os 8 slots de acesso rápido estão cheios!');
      return;
    }

    if (type === 'avatar') {
      const newSlot: RoomAccessSlot = {
        id: `access-av-${item.id}-${Date.now()}`,
        slotIndex: emptyIdx,
        type: 'avatar',
        itemId: item.id,
        name: item.name,
        thumbnailUrl: item.thumb || '',
        badge: 'AVATAR',
        avatarData: item,
      };
      onUpdateSlots([...slots, newSlot]);
      if (onShowToast) onShowToast(`Avatar "${item.name}" adicionado ao Slot ${emptyIdx + 1}!`);
    } else {
      const newSlot: RoomAccessSlot = {
        id: `access-pose-${item.id}-${Date.now()}`,
        slotIndex: emptyIdx,
        type: 'pose',
        itemId: item.id,
        name: item.name,
        thumbnailUrl: item.thumbnailUrl || '',
        badge: 'POSE',
      };
      onUpdateSlots([...slots, newSlot]);
      if (onShowToast) onShowToast(`Pose "${item.name}" adicionada ao Slot ${emptyIdx + 1}!`);
    }
  };

  // Minimized Floating Pill Mode
  if (isCollapsed) {
    return (
      <div
        className={`fixed z-30 select-none ${
          orientation === 'horizontal'
            ? 'bottom-3 left-1/2 -translate-x-1/2'
            : 'top-20 left-4'
        }`}
      >
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#121318]/95 hover:bg-[#1a1c24] border border-[#ffd700]/70 text-[#ffd700] text-xs font-bold shadow-2xl backdrop-blur-md cursor-pointer transition-all hover:scale-105 active:scale-95"
          title="Clique para abrir o inventário da room"
        >
          <Sparkles className="w-4 h-4 text-[#ffd700]" />
          <span>Inventário da Room</span>
          <span className="text-[10px] text-black bg-[#ffd700] px-1.5 py-0.5 rounded-full font-mono">
            {slots.length}/8
          </span>
          <ChevronUp className="w-3.5 h-3.5 text-[#ffd700]" />
        </button>
      </div>
    );
  }

  // Base Container Classes depending on Orientation (Horizontal at bottom center or Vertical at bottom left)
  const containerClasses =
    orientation === 'horizontal'
      ? 'fixed bottom-2 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-30 max-w-full sm:max-w-3xl md:max-w-4xl bg-[#121319]/95 backdrop-blur-xl border border-[#ffd700]/40 rounded-2xl p-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.85)] flex flex-col gap-2'
      : 'fixed bottom-4 left-3 z-30 w-64 sm:w-72 max-h-[52vh] bg-[#121319]/95 backdrop-blur-xl border border-[#ffd700]/40 rounded-2xl p-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.85)] flex flex-col gap-2 overflow-hidden';

  return (
    <div id="unified-room-inventory" className={containerClasses}>
      {/* Top Controls Header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-[#ffd700]/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-[#ffd700]" />
          </div>
          <span className="text-xs font-serif font-bold text-white tracking-wide truncate">
            Inventário
          </span>

          {/* Subtabs inside single inventory */}
          <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/10 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('atalhos')}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                activeTab === 'atalhos'
                  ? 'bg-[#ffd700] text-black shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Atalhos ({slots.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('poses')}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                activeTab === 'poses'
                  ? 'bg-[#ffd700] text-black shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Poses ({poses.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('avatars')}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                activeTab === 'avatars'
                  ? 'bg-[#ffd700] text-black shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Avatares ({storeAvatars.length})
            </button>
          </div>
        </div>

        {/* Action Controls: Orientation toggle (Horizontal/Vertical) + Collapse */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Toggle Horizontal / Vertical Icon Button */}
          <button
            id="toggle-inventory-orientation-btn"
            type="button"
            onClick={handleToggleOrientation}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#1e2029] hover:bg-[#282a36] text-white text-xs font-bold transition-all border border-[#ffd700]/50 hover:border-[#ffd700] shadow-md cursor-pointer active:scale-95"
            title={
              orientation === 'horizontal'
                ? 'Alternar para modo VERTICAL (dock lateral)'
                : 'Alternar para modo HORIZONTAL (barra inferior)'
            }
          >
            {orientation === 'horizontal' ? (
              <>
                <Columns2 className="w-3.5 h-3.5 text-[#ffd700]" />
                <span className="text-[11px] text-[#ffd700] hidden sm:inline">Vertical</span>
              </>
            ) : (
              <>
                <Rows2 className="w-3.5 h-3.5 text-[#ffd700]" />
                <span className="text-[11px] text-[#ffd700] hidden sm:inline">Horizontal</span>
              </>
            )}
          </button>

          {/* Collapse Button */}
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Recolher inventário"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* CONTENT TAB 1: ATALHOS (SLOTS 1-8) */}
      {activeTab === 'atalhos' && (
        <div
          className={`${
            orientation === 'horizontal'
              ? 'flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin scrollbar-thumb-zinc-700'
              : 'grid grid-cols-2 gap-2 overflow-y-auto max-h-[60vh] pr-1 scrollbar-thin scrollbar-thumb-zinc-700'
          }`}
        >
          {fullSlots.map((slot, index) => {
            const isDragOver = dragOverIndex === index;
            const isAvatar = slot?.type === 'avatar';
            const isActive =
              (isAvatar && slot?.itemId === activeAvatarId) ||
              (!isAvatar && slot?.itemId === (selectedPoseId || activePoseId));

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
                className={`relative flex-shrink-0 ${
                  orientation === 'horizontal' ? 'w-20 sm:w-24 h-22 sm:h-24' : 'w-full h-22'
                } rounded-xl border transition-all duration-150 flex flex-col items-center justify-between p-1.5 cursor-pointer group ${
                  isDragOver
                    ? 'border-[#ffd700] bg-[#ffd700]/20 ring-2 ring-[#ffd700] scale-105 shadow-[0_0_15px_rgba(255,215,0,0.4)]'
                    : slot
                    ? isActive
                      ? 'bg-[#181a24] border-[#ffd700] ring-1 ring-[#ffd700]/70 shadow-[0_0_12px_rgba(255,215,0,0.3)]'
                      : 'bg-[#121319] border-white/10 hover:border-[#ffd700]/60 hover:bg-[#161822]'
                    : 'bg-[#0f1015]/80 border-dashed border-zinc-700/60 hover:border-[#ffd700]/50 hover:bg-[#151620]'
                }`}
              >
                {/* Slot index number badge */}
                <div className="absolute top-1 left-1 z-10 w-4 h-4 rounded-md bg-black/80 border border-white/10 text-[9px] font-mono font-bold text-zinc-300 flex items-center justify-center">
                  {index + 1}
                </div>

                {/* Remove button */}
                {slot && (
                  <button
                    type="button"
                    onClick={(e) => handleRemoveSlot(e, index)}
                    className="absolute top-1 right-1 z-10 w-4 h-4 rounded-full bg-black/70 hover:bg-red-950 text-zinc-400 hover:text-red-300 opacity-80 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    title="Remover deste slot"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}

                {slot ? (
                  <>
                    <div className="relative w-full h-10 sm:h-11 rounded-lg overflow-hidden bg-black/40 mt-2.5 flex items-center justify-center">
                      {slot.thumbnailUrl ? (
                        <img
                          src={slot.thumbnailUrl}
                          alt={slot.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="w-5 h-5 text-zinc-500" />
                      )}
                      <div
                        className={`absolute bottom-0 inset-x-0 text-[8px] font-mono font-bold text-center uppercase py-0.5 ${
                          isAvatar ? 'bg-cyan-950/80 text-cyan-300' : 'bg-amber-950/80 text-amber-300'
                        }`}
                      >
                        {slot.badge}
                      </div>
                    </div>

                    <div className="w-full text-center mt-1">
                      <p className="text-[10px] font-bold text-zinc-200 truncate leading-tight">
                        {slot.name}
                      </p>
                      {isActive && (
                        <span className="text-[8px] font-bold text-[#ffd700] uppercase tracking-wider">
                          ● Ativo
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-1">
                    <Plus className="w-4 h-4 text-zinc-600 group-hover:text-[#ffd700] transition-colors" />
                    <span className="text-[8px] text-zinc-500 mt-1 leading-tight">
                      Slot Vazio
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CONTENT TAB 2: POSES CATALOG */}
      {activeTab === 'poses' && (
        <div
          className={`${
            orientation === 'horizontal'
              ? 'flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 max-h-36 scrollbar-thin scrollbar-thumb-zinc-700'
              : 'grid grid-cols-2 gap-2 overflow-y-auto max-h-[60vh] pr-1 scrollbar-thin scrollbar-thumb-zinc-700'
          }`}
        >
          {poses.map((pose) => {
            const isSelected = pose.id === selectedPoseId;
            const poseThumb =
              pose.thumbnailUrl ||
              activeUserAvatar?.thumb ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';

            return (
              <div
                key={pose.id}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/json', JSON.stringify({ type: 'pose', pose }));
                }}
                onClick={() => onSelectPose(pose)}
                className={`relative flex-shrink-0 ${
                  orientation === 'horizontal' ? 'w-24 h-28' : 'w-full h-28'
                } rounded-xl border p-1.5 flex flex-col justify-between cursor-pointer group transition-all ${
                  isSelected
                    ? 'border-[#ffd700] bg-[#ffd700]/15 shadow-[0_0_12px_rgba(255,215,0,0.3)] ring-1 ring-[#ffd700]'
                    : 'border-white/10 bg-[#14151c] hover:border-[#ffd700]/50 hover:bg-[#1a1b24]'
                }`}
              >
                <div className="relative w-full h-16 rounded-lg overflow-hidden bg-black/40">
                  <img
                    src={poseThumb}
                    alt={pose.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#ffd700] text-black flex items-center justify-center font-bold text-[9px]">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAssignToFirstEmptySlot('pose', pose);
                    }}
                    className="absolute bottom-1 right-1 p-0.5 rounded bg-black/80 hover:bg-[#ffd700] hover:text-black text-zinc-300 text-[8px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Adicionar ao Atalho 1-8"
                  >
                    +Atalho
                  </button>
                </div>
                <div className="text-center mt-1">
                  <p className="text-[10px] font-bold text-zinc-200 truncate">{pose.name}</p>
                  <span className="text-[8px] font-mono text-amber-400">POSE</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CONTENT TAB 3: AVATARES CATALOG */}
      {activeTab === 'avatars' && (
        <div
          className={`${
            orientation === 'horizontal'
              ? 'flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 max-h-36 scrollbar-thin scrollbar-thumb-zinc-700'
              : 'grid grid-cols-2 gap-2 overflow-y-auto max-h-[60vh] pr-1 scrollbar-thin scrollbar-thumb-zinc-700'
          }`}
        >
          {storeAvatars.length === 0 ? (
            <div className="w-full py-6 text-center text-zinc-500 text-xs">
              Nenhum avatar encontrado. Crie ou publique avatares no menu Customização.
            </div>
          ) : (
            storeAvatars.map((av) => {
              const isEquipped = activeUserAvatar?.id === av.id || av.id === activeAvatarId;
              return (
                <div
                  key={av.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'avatar', avatar: av }));
                  }}
                  onClick={() => onSelectAvatar && onSelectAvatar(av)}
                  className={`relative flex-shrink-0 ${
                    orientation === 'horizontal' ? 'w-24 h-28' : 'w-full h-28'
                  } rounded-xl border p-1.5 flex flex-col justify-between cursor-pointer group transition-all ${
                    isEquipped
                      ? 'border-emerald-400 bg-emerald-500/15 shadow-[0_0_12px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400'
                      : 'border-white/10 bg-[#14151c] hover:border-emerald-400/50 hover:bg-[#1a1b24]'
                  }`}
                >
                  <div className="relative w-full h-16 rounded-lg overflow-hidden bg-black/40">
                    <img
                      src={av.thumb}
                      alt={av.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                    {isEquipped && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-400 text-black flex items-center justify-center font-bold text-[9px]">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAssignToFirstEmptySlot('avatar', av);
                      }}
                      className="absolute bottom-1 right-1 p-0.5 rounded bg-black/80 hover:bg-[#ffd700] hover:text-black text-zinc-300 text-[8px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Adicionar ao Atalho 1-8"
                    >
                      +Atalho
                    </button>
                  </div>
                  <div className="text-center mt-1">
                    <p className="text-[10px] font-bold text-zinc-200 truncate">{av.name}</p>
                    <span className="text-[8px] font-mono text-cyan-400">AVATAR</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Footer hint */}
      <div className="flex items-center justify-between text-[9px] text-zinc-400 px-1 border-t border-white/5 pt-1">
        <span>Arraste ou clique para trocar. Teclas 1 a 8 ativam os atalhos.</span>
        {activeTab === 'atalhos' && slots.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Deseja limpar todos os slots de atalho?')) {
                onUpdateSlots([]);
              }
            }}
            className="text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
          >
            Limpar Atalhos
          </button>
        )}
      </div>
    </div>
  );
};
