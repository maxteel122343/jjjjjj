import React from 'react';
import {
  Box,
  Upload,
  Plus,
  Eye,
  EyeOff,
  User,
  Sliders,
  CheckCircle2,
  MapPin,
  Lock,
  Unlock,
  LogOut,
  Gamepad2,
  Layers,
  Download,
  Save,
} from 'lucide-react';
import { RoomEditorState, CreatorUser } from '../types';

interface CreatorHeaderProps {
  rooms: RoomEditorState[];
  activeRoomId: string;
  onSelectRoom: (id: string) => void;
  onAddNewRoom: () => void;
  onOpenBoundaryModal: () => void;
  onPublishRoom: () => void;
  onOpenPublicationsModal?: () => void;
  onOpenProjectModal?: (tab?: 'export' | 'import') => void;
  onPlaytestRoom?: () => void;
  onOpenAuthModal: () => void;
  user: CreatorUser | null;
  onLogout?: () => void;
  isAvatarMode: boolean;
  onToggleAvatarMode: () => void;
  showBoundaryGhost: boolean;
  onToggleBoundaryGhost: () => void;
  showSpots: boolean;
  onToggleShowSpots: () => void;
  lockSpots: boolean;
  onToggleLockSpots: () => void;
  onExitEditor?: () => void;
}

export const CreatorHeader: React.FC<CreatorHeaderProps> = ({
  rooms,
  activeRoomId,
  onSelectRoom,
  onAddNewRoom,
  onOpenBoundaryModal,
  onPublishRoom,
  onOpenPublicationsModal,
  onOpenProjectModal,
  onPlaytestRoom,
  onOpenAuthModal,
  user,
  onLogout,
  isAvatarMode,
  onToggleAvatarMode,
  showBoundaryGhost,
  onToggleBoundaryGhost,
  showSpots,
  onToggleShowSpots,
  lockSpots,
  onToggleLockSpots,
  onExitEditor,
}) => {
  const activeRoom = rooms.find((r) => r.id === activeRoomId) || rooms[0];

  return (
    <header className="w-full bg-[#10151e] border-b border-[#d4af37]/35 text-[#e8d5b5] z-30 select-none font-sans shadow-md">
      <div className="min-h-[52px] px-3 md:px-4 py-2 flex items-center justify-between gap-2">
      {/* Top row: exit, editor identity, and global controls */}
      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        {/* Sair do Editor Button (Always visible on the left bar so user NEVER gets pushed off screen!) */}
        {onExitEditor && (
          <button
            type="button"
            onClick={onExitEditor}
            className="px-3 py-1.5 rounded-lg border-2 border-amber-400 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-black font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 flex-shrink-0"
            title="Sair do modo editor e voltar para a tela de rooms / Lobby"
          >
            <LogOut className="w-4 h-4 text-black stroke-[3]" />
            <span className="font-extrabold uppercase tracking-wide">Sair do Editor</span>
          </button>
        )}

        {/* Brand */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <Box className="w-4 h-4 text-[#ffd700] stroke-[2]" />
          <h1 className="text-sm md:text-base font-semibold tracking-wide text-white whitespace-nowrap">
            3D Social Lounge
          </h1>
        </div>

        <div className="h-4 w-[1px] bg-[#d4af37]/40 hidden md:block flex-shrink-0" />

      </div>

      {/* Right side: Controls with horizontal scroll safety */}
      <div className="flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar py-0.5 min-w-0">
        {/* Toggle MODO AVATAR */}
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-[#d4af37]/80 hidden sm:inline" />
          <span className="text-[11px] font-medium text-[#d4af37] hidden md:inline">
            Toggle Avatar
          </span>
          <button
            type="button"
            onClick={onToggleAvatarMode}
            className={`relative inline-flex h-4.5 w-9 items-center rounded-full transition-colors cursor-pointer p-0.5 border ${
              isAvatarMode
                ? 'bg-[#d4af37]/40 border-[#d4af37]'
                : 'bg-[#20222a] border-[#424552]'
            }`}
            title={isAvatarMode ? 'Avatar ON (teleporta ao clicar nos spots)' : 'Avatar OFF (modo edição)'}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-[#ffd700] transition-transform ${
                isAvatarMode ? 'translate-x-4.5' : 'translate-x-0 bg-[#8a8e9e]'
              }`}
            />
          </button>
          <span className="text-[11px] font-semibold text-[#e8d5b5]">
            {isAvatarMode ? '[Avatar ON]' : '[Avatar OFF]'}
          </span>
        </div>

        {/* Ícone OLHO: liga/desliga ghost do Limite jogável */}
        <button
          type="button"
          onClick={onToggleBoundaryGhost}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors cursor-pointer border ${
            showBoundaryGhost
              ? 'border-[#d4af37] text-[#ffd700] bg-[#d4af37]/10'
              : 'border-transparent text-[#d4af37]/60 hover:text-[#d4af37]'
          }`}
          title="Mostrar/Ocultar ghost do limite jogável"
        >
          {showBoundaryGhost ? (
            <>
              <Eye className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>ON</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3.5 h-3.5 text-[#d4af37]/70" />
              <span>OFF</span>
            </>
          )}
        </button>

        {/* Toggle SPOTS VISÍVEIS / INVISÍVEIS (para focar 100% nos objetos 3D) */}
        <button
          type="button"
          onClick={onToggleShowSpots}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors cursor-pointer border ${
            showSpots
              ? 'border-[#d4af37]/60 text-[#ffd700] bg-[#d4af37]/10'
              : 'border-red-500/40 text-red-400 bg-red-950/20'
          }`}
          title={showSpots ? 'Ocultar spots da cena para focar só nos objetos 3D' : 'Mostrar spots na cena 3D'}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Spots:</span>
          <span>{showSpots ? 'Visíveis' : 'Ocultos'}</span>
        </button>

        {/* Toggle TRAVAR CONTROLE DE SPOTS (desativa controle para cliques selecionarem apenas objetos 3D) */}
        <button
          type="button"
          onClick={onToggleLockSpots}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors cursor-pointer border ${
            lockSpots
              ? 'border-[#ffd700] text-[#ffd700] bg-[#d4af37]/20 shadow-[0_0_8px_rgba(212,175,55,0.3)]'
              : 'border-[#d4af37]/30 text-[#d4af37]/70 hover:text-[#d4af37]'
          }`}
          title={lockSpots ? 'Controle de spots desativado: cliques afetam apenas objetos 3D' : 'Spots interativos (clique para selecionar/mover)'}
        >
          {lockSpots ? <Lock className="w-3.5 h-3.5 text-[#ffd700]" /> : <Unlock className="w-3.5 h-3.5" />}
          <span className="hidden lg:inline">{lockSpots ? 'Spots Travados' : 'Spots Livres'}</span>
        </button>

        {/* Botão DEFINIR LIMITE matching user screenshot */}
        <button
          type="button"
          onClick={onOpenBoundaryModal}
          className="px-2.5 py-1 rounded border border-[#d4af37]/50 hover:border-[#d4af37] bg-black/40 text-xs font-medium text-[#e8d5b5] hover:text-[#ffd700] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <Sliders className="w-3 h-3 text-[#d4af37]" />
          <span>Definir Limite</span>
        </button>

        {/* User Profile Badge (Supabase auth trigger) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="px-2.5 py-1 rounded border border-[#d4af37]/30 hover:border-[#d4af37] bg-black/40 text-xs font-medium text-[#e8d5b5] transition-all flex items-center gap-1.5 cursor-pointer"
            title="Gerenciar Conta / Supabase"
          >
            <span className="text-xs">👤</span>
            <span className="hidden sm:inline">{user?.displayName || 'Luzenne'}</span>
          </button>

          {user && !user.isGuest && onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="p-1 rounded border border-red-500/40 hover:border-red-400 bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-white transition-all cursor-pointer"
              title="Sair da Conta (Logout)"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Botão TESTAR ROOM INTERATIVA (modo teste sem publicar na vitrine) */}
        {onPlaytestRoom && (
          <button
            type="button"
            onClick={onPlaytestRoom}
            className="px-3 py-1 rounded border border-emerald-500/70 hover:border-emerald-400 bg-emerald-950/50 hover:bg-emerald-900/70 text-xs font-semibold text-emerald-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.25)]"
            title="Testar a room interativamente em tempo real sem publicar na vitrine"
          >
            <Gamepad2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">Testar Room</span>
            <span className="sm:hidden">Testar</span>
          </button>
        )}

      </div>
      </div>

      {/* Room selector row */}
      <div className="min-h-10 px-3 md:px-4 py-1.5 border-t border-white/5 bg-black/20 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {rooms.map((room, idx) => {
            const isActive = room.id === activeRoomId;
            const defaultName = ['Lobby Principal', 'Sala de Reuniões', 'Chill Lounge'][idx];
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => onSelectRoom(room.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer border ${
                  isActive
                    ? 'border-[#ffd700] bg-[#d4af37]/15 text-[#ffd700] shadow-sm'
                    : 'border-white/10 bg-[#151b25] text-[#cbd5e1] hover:border-[#d4af37]/60 hover:text-[#ffd700]'
                }`}
              >
                {defaultName || room.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onAddNewRoom}
            className="w-8 h-8 text-sm font-bold rounded-md border border-white/10 hover:border-[#ffd700]/70 bg-[#151b25] text-[#ffd700] hover:bg-[#d4af37]/15 transition-all cursor-pointer flex items-center justify-center"
            title="Criar nova sala"
            aria-label="Criar nova sala"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {onOpenProjectModal && (
            <>
              <button
                type="button"
                onClick={() => onOpenProjectModal('export')}
                className="px-3 py-1.5 rounded-md border border-[#d4af37]/60 hover:border-[#ffd700] bg-[#171d28] text-xs font-semibold text-[#ffd700] hover:bg-[#d4af37]/15 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Salvar projeto em arquivo"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenProjectModal('import')}
                className="px-3 py-1.5 rounded-md border border-white/10 hover:border-[#d4af37]/60 bg-[#151b25] text-xs font-medium text-[#e8d5b5] hover:text-[#ffd700] transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Restaurar projeto de um arquivo salvo"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Restaurar</span>
              </button>
            </>
          )}
          {onOpenPublicationsModal && (
            <button
              type="button"
              onClick={onOpenPublicationsModal}
              className="px-3 py-1.5 rounded-md border border-white/10 hover:border-[#d4af37]/60 bg-[#151b25] text-xs font-medium text-[#e8d5b5] hover:text-[#ffd700] transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Ver e gerenciar suas publicações"
            >
              <Layers className="w-3.5 h-3.5 text-[#ffd700]" />
              <span>Minhas Publicações</span>
            </button>
          )}
          <button
            type="button"
            onClick={onPublishRoom}
            className="px-3 py-1.5 rounded-md border border-violet-400/50 bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Publicar sala na vitrine"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Publicar na vitrine</span>
          </button>
        </div>
        <div className="ml-auto hidden md:flex items-center gap-1.5 text-xs text-emerald-300 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{activeRoom.name}</span>
        </div>
      </div>
    </header>
  );
};
