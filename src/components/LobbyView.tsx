import React from 'react';
import {
  Users,
  Gift,
  Mail,
  ShoppingBag,
  MessageSquare,
  Bell,
  Menu,
  Sparkles,
  UploadCloud,
  Box,
  User,
  Shirt,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Lock,
} from 'lucide-react';
import { RoomData, CreatorUser } from '../types';

interface LobbyViewProps {
  rooms: RoomData[];
  selectedRoomIndex: number;
  onSelectRoomIndex: (index: number) => void;
  onEnterRoom: (room: RoomData) => void;
  onOpenUpload: () => void;
  onOpenShop: () => void;
  onOpenFriends: () => void;
  onOpenEditor?: () => void;
  user?: CreatorUser | null;
  onOpenAuthModal?: () => void;
  onOpenCustomization?: () => void;
  onLogout?: () => void;
  onBuyRoom?: (room: RoomData) => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  rooms,
  selectedRoomIndex,
  onSelectRoomIndex,
  onEnterRoom,
  onOpenUpload,
  onOpenShop,
  onOpenFriends,
  onOpenEditor,
  user,
  onOpenAuthModal,
  onOpenCustomization,
  onLogout,
  onBuyRoom,
}) => {
  const safeRooms = rooms.length > 0 ? rooms : [
    {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'SALÃO ESCARLATE',
      title: 'Room A • Salão Escarlate',
      badge: '👑',
      occupation: '1/8',
      description: 'Salão clássico luxuoso.',
      thumb: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
    } as RoomData,
  ];

  const safeIndex = ((selectedRoomIndex % safeRooms.length) + safeRooms.length) % safeRooms.length;
  const activeRoom = safeRooms[safeIndex];

  const portalSlots = [
    { index: (safeIndex - 1 + safeRooms.length) % safeRooms.length, pos: 'left' },
    { index: safeIndex, pos: 'center' },
    { index: (safeIndex + 1) % safeRooms.length, pos: 'right' },
  ];

  const handlePrev = () => {
    onSelectRoomIndex((safeIndex - 1 + safeRooms.length) % safeRooms.length);
  };

  const handleNext = () => {
    onSelectRoomIndex((safeIndex + 1) % safeRooms.length);
  };

  return (
    <div
      id="lobby-hall"
      className="relative w-screen h-screen overflow-hidden bg-[#090a0d] text-amber-50 select-none flex flex-col justify-between"
      style={{
        backgroundImage: `
          radial-gradient(ellipse 60% 40% at 50% 30%, rgba(255, 215, 0, 0.08) 0%, rgba(10, 11, 15, 0.95) 75%),
          radial-gradient(ellipse 80% 50% at 50% 90%, rgba(25, 27, 34, 0.9) 0%, rgba(7, 8, 10, 1) 100%)
        `,
      }}
    >
      {/* Dark Architectural Hall Ceiling & Pillars Backdrop */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-0 left-1/4 w-32 h-96 bg-gradient-to-b from-amber-100/10 via-amber-200/5 to-transparent blur-2xl transform -rotate-12" />
        <div className="absolute top-0 right-1/4 w-32 h-96 bg-gradient-to-b from-amber-100/10 via-amber-200/5 to-transparent blur-2xl transform rotate-12" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-full bg-gradient-to-b from-amber-200/15 via-transparent to-amber-500/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-48 border-b border-amber-900/20 bg-gradient-to-b from-black/80 to-transparent" />
      </div>

      {/* TOP HUD: Perfil do usuário e moedas */}
      <header className="relative z-30 flex items-center justify-between px-4 sm:px-8 pt-4 sm:pt-6 pointer-events-auto">
        <div
          onClick={onOpenAuthModal}
          className="flex items-center gap-3 cursor-pointer group"
          title="Minha Conta / Login / Cadastrar"
        >
          <div className="relative">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-zinc-900 ring-2 ring-[#ffd700] ring-offset-2 ring-offset-black overflow-hidden shadow-[0_0_15px_rgba(255,215,0,0.3)] group-hover:ring-amber-300 transition-all">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                alt="Avatar"
                className="w-full h-full object-cover filter contrast-125 brightness-90 group-hover:scale-105 transition-transform"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#ffd700] border-2 border-black" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="text-sm sm:text-base font-bold text-zinc-100 tracking-wide group-hover:text-[#ffd700] transition-colors truncate max-w-[140px] sm:max-w-none">
                {user && !user.isGuest ? user.displayName : 'Luzenne'}
              </span>
              <span className="text-[10px] sm:text-xs text-amber-400 font-semibold">
                Nv. 12
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-20 sm:w-28 h-1.5 rounded-full bg-black/60 border border-amber-900/40 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 to-[#ffd700]"
                  style={{ width: '35%' }}
                />
              </div>
              <span className="text-[9px] sm:text-[10px] text-zinc-400 font-mono">
                420 / 1200
              </span>
            </div>
          </div>
        </div>

        {/* Currency & Menu HUD */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Gold Coin */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-black/40 border border-amber-500/20 backdrop-blur-md">
            <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-amber-400 flex items-center justify-center text-[9px] sm:text-[10px] text-black font-black shadow-[0_0_8px_#f59e0b]">
              ●
            </div>
            <span className="text-xs font-bold text-amber-200">2.450</span>
          </div>

          {/* Diamond Gem */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-purple-500/20 backdrop-blur-md">
            <div className="w-3.5 h-3.5 rotate-45 bg-purple-400 shadow-[0_0_8px_#c084fc]" />
            <span className="text-xs font-bold text-purple-200">180</span>
          </div>

          {/* Botão Modo Criador */}
          {onOpenEditor && (
            <button
              type="button"
              onClick={onOpenEditor}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#d4af37]/20 border border-[#d4af37] text-xs font-bold text-[#ffd700] hover:bg-[#d4af37] hover:text-black transition-all cursor-pointer shadow-md"
              title="Abrir Modo Criador / Editor 3D"
            >
              <Box className="w-4 h-4" />
              <span className="hidden md:inline">Modo Criador</span>
            </button>
          )}

          {/* Menu / Auth */}
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-black/40 border border-amber-500/30 flex items-center justify-center text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
            title="Conta & Configurações"
          >
            <User className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>

      {/* CENTER 3D PORTAL HALL */}
      <main className="relative flex-1 flex flex-col items-center justify-center px-2 sm:px-4 py-2">
        {/* Quick Action Banner: LOJA & PERSONALIZAR AVATAR */}
        <div className="z-20 mb-2 flex items-center gap-3">
          <button
            id="lobby-customization-btn"
            type="button"
            onClick={() => {
              if (onOpenCustomization) onOpenCustomization();
              else if (onOpenShop) onOpenShop();
            }}
            className="flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl bg-black/80 hover:bg-[#d4af37] text-[#ffd700] hover:text-black border-2 border-[#ffd700] text-[11px] sm:text-xs font-black tracking-wider uppercase transition-all shadow-[0_0_25px_rgba(255,215,0,0.35)] cursor-pointer active:scale-95"
            title="Abrir Loja de Roupas e Personalizar Avatar"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Personalizar Avatar & Loja</span>
          </button>
        </div>

        {/* 3D Perspective Portals Container */}
        <div className="relative w-full max-w-5xl flex items-center justify-center gap-2 sm:gap-4 md:gap-8 perspective-[1200px] z-10 pt-1">
          {/* Seta Esquerda para navegação rápida (especialmente útil no mobile) */}
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Sala Anterior"
            className="absolute left-1 sm:left-4 z-30 p-2 sm:p-3 rounded-full bg-black/70 hover:bg-black/90 border border-amber-500/40 text-[#ffd700] hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-lg"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {portalSlots.map((slot) => {
            const room = safeRooms[slot.index];
            if (!room) return null;

            const isCenter = slot.pos === 'center';
            const isLeft = slot.pos === 'left';
            const isRight = slot.pos === 'right';
            const isPrivate = Boolean(room.isPrivate || room.visibility === 'private');

            return (
              <div
                key={`${room.id}-${slot.pos}`}
                onClick={() => onSelectRoomIndex(slot.index)}
                className={`relative transition-all duration-500 ease-out cursor-pointer group ${
                  isCenter
                    ? 'w-64 sm:w-72 md:w-80 z-20 scale-100 sm:scale-105 filter drop-shadow-[0_15px_35px_rgba(255,215,0,0.25)]'
                    : 'hidden sm:block w-48 sm:w-60 md:w-64 opacity-60 hover:opacity-100 scale-90 sm:scale-95 z-10'
                }`}
                style={{
                  transform: isLeft
                    ? 'rotateY(16deg) translateZ(-40px)'
                    : isRight
                    ? 'rotateY(-16deg) translateZ(-40px)'
                    : 'rotateY(0deg) translateZ(20px)',
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* 3D Moulding Frame: FILETE VERMELHO PARA CÓPIAS PRIVADAS, DOURADO PARA PÚBLICAS */}
                <div
                  className={`relative rounded-xl p-2 sm:p-2.5 transition-all duration-300 ${
                    isPrivate
                      ? isCenter
                        ? 'bg-gradient-to-b from-red-600 via-rose-500 to-red-800 shadow-[0_0_35px_rgba(239,68,68,0.75)] ring-2 ring-red-400 border-2 border-red-500'
                        : 'bg-[#321212] hover:bg-[#461818] border-2 border-red-600/80 shadow-[0_0_20px_rgba(239,68,68,0.4)] ring-1 ring-red-500/50'
                      : isCenter
                      ? 'bg-gradient-to-b from-[#b8860b] via-[#ffd700] to-[#8b6508] shadow-[0_0_30px_rgba(255,215,0,0.4)] ring-2 ring-amber-300/80'
                      : 'bg-[#2b251d] hover:bg-[#3d3429] border border-amber-900/50 shadow-2xl'
                  }`}
                >
                  {/* Inside Frame Bevel */}
                  <div className="bg-[#121316] rounded-lg overflow-hidden border border-black/80 flex flex-col">
                    {/* Frame Header Bar */}
                    <div
                      className={`px-3 py-2 border-b flex items-center justify-between text-center ${
                        isPrivate ? 'bg-[#220c0c] border-red-800/60' : 'bg-[#1a1714] border-amber-900/40'
                      }`}
                    >
                      <div
                        className={`flex items-center gap-1.5 text-xs font-serif font-bold tracking-wider truncate ${
                          isPrivate ? 'text-rose-200' : 'text-amber-200'
                        }`}
                      >
                        <span className={isPrivate ? 'text-red-400' : 'text-amber-400'}>
                          {isPrivate ? '🔒' : room.badge || '👑'}
                        </span>
                        <span className="truncate">{room.name}</span>
                      </div>
                      <span
                        className={`text-[10px] sm:text-[11px] font-mono font-semibold ml-2 ${
                          isPrivate ? 'text-red-400' : 'text-amber-400/90'
                        }`}
                      >
                        {room.occupation || '1/8'}
                      </span>
                    </div>

                    {/* Room 3D Perspective Preview Viewport */}
                    <div className="relative h-60 sm:h-64 md:h-72 w-full overflow-hidden bg-black">
                      <img
                        src={room.thumb || room.coverUrl}
                        alt={room.name}
                        className="w-full h-full object-cover filter brightness-90 group-hover:scale-105 transition-transform duration-700"
                        referrerPolicy="no-referrer"
                      />

                      {/* Warm volumetric lighting vignette */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                      {/* TAG FILETE VERMELHO: CÓPIA PRIVADA */}
                      {isPrivate ? (
                        <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-red-600 border border-red-300 text-white text-[9px] font-black uppercase tracking-wider shadow-[0_0_12px_rgba(239,68,68,0.8)] flex items-center gap-1">
                          <Lock className="w-3 h-3 text-white" />
                          <span>SALA PRIVADA</span>
                        </div>
                      ) : (
                        <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-[#ffd700] text-black text-[9px] font-extrabold uppercase tracking-wider shadow-lg flex items-center gap-1">
                          <span>✨</span>
                          <span>Criada no Editor</span>
                        </div>
                      )}

                      {/* Filete vermelho sutil no topo interno */}
                      {isPrivate && (
                        <div className="absolute inset-0 ring-1 ring-inset ring-red-500/60 pointer-events-none" />
                      )}

                      {/* Subtle golden shimmer on highlighted center portal */}
                      {isCenter && !isPrivate && (
                        <div className="absolute inset-0 ring-1 ring-inset ring-[#ffd700]/40 pointer-events-none" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Reflection on polished floor below each frame */}
                <div
                  className="w-full h-12 sm:h-16 mt-1 rounded opacity-25 filter blur-sm overflow-hidden transform scale-y-[-1] pointer-events-none"
                  style={{
                    maskImage: 'linear-gradient(to bottom, black, transparent)',
                    WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
                  }}
                >
                  <img
                    src={room.thumb || room.coverUrl}
                    alt="reflection"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            );
          })}

          {/* Seta Direita para navegação */}
          <button
            type="button"
            onClick={handleNext}
            aria-label="Próxima Sala"
            className="absolute right-1 sm:right-4 z-30 p-2 sm:p-3 rounded-full bg-black/70 hover:bg-black/90 border border-amber-500/40 text-[#ffd700] hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-lg"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Counter indicador no mobile */}
        <div className="text-[10px] text-zinc-400 font-mono mt-1">
          Sala {safeIndex + 1} de {safeRooms.length}
          {activeRoom?.isPrivate ? ' • (Cópia Privada)' : ' • (Pública)'}
        </div>

        {/* ACTIONS CONTAINER: PROMINENT "ENTRAR" BUTTON + COMPRA SE ABERTA */}
        <div className="relative z-20 mt-3 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">
            {/* Botão Entrar Principal */}
            <button
              id="enter-highlighted-room-btn"
              type="button"
              onClick={() => onEnterRoom(activeRoom)}
              className={`group relative px-8 sm:px-10 py-2.5 sm:py-3 rounded-lg border-2 text-base sm:text-lg font-serif font-bold tracking-widest transition-all transform hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2 sm:gap-3 ${
                activeRoom?.isPrivate
                  ? 'bg-gradient-to-b from-[#2a1212] via-[#1a0808] to-[#0d0404] border-red-500 text-rose-300 shadow-[0_0_25px_rgba(239,68,68,0.55)] hover:shadow-[0_0_40px_rgba(239,68,68,0.8)] hover:text-white'
                  : 'bg-gradient-to-b from-[#2a2214] via-[#1a150c] to-[#0d0a06] border-[#ffd700] text-amber-300 shadow-[0_0_25px_rgba(255,215,0,0.45)] hover:shadow-[0_0_40px_rgba(255,215,0,0.7)] hover:text-white'
              }`}
            >
              {/* Corner Ornamental Accents */}
              <span className={`w-1.5 h-1.5 absolute -top-1 -left-1 rotate-45 ${activeRoom?.isPrivate ? 'bg-red-500' : 'bg-[#ffd700]'}`} />
              <span className={`w-1.5 h-1.5 absolute -top-1 -right-1 rotate-45 ${activeRoom?.isPrivate ? 'bg-red-500' : 'bg-[#ffd700]'}`} />
              <span className={`w-1.5 h-1.5 absolute -bottom-1 -left-1 rotate-45 ${activeRoom?.isPrivate ? 'bg-red-500' : 'bg-[#ffd700]'}`} />
              <span className={`w-1.5 h-1.5 absolute -bottom-1 -right-1 rotate-45 ${activeRoom?.isPrivate ? 'bg-red-500' : 'bg-[#ffd700]'}`} />

              <span className="relative z-10">ENTRAR</span>
              <Sparkles className={`w-4 h-4 group-hover:rotate-12 transition-transform ${activeRoom?.isPrivate ? 'text-red-400' : 'text-[#ffd700]'}`} />
            </button>

            {/* Se for sala pública de outro criador, opção de comprar cópia privada diretamente */}
            {!activeRoom?.isPrivate && onBuyRoom && (
              <button
                type="button"
                onClick={() => onBuyRoom(activeRoom)}
                className="px-3.5 py-2.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/70 text-red-200 text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Comprar cópia privada desta sala (Card só na sua vitrine, filete vermelho)"
              >
                <Lock className="w-3.5 h-3.5 text-red-400" />
                <span className="hidden sm:inline">Comprar Cópia Privada</span>
                <span className="sm:hidden">Comprar</span>
              </button>
            )}
          </div>
        </div>

        {/* Foreground Standing Player Silhouette seen from behind */}
        <div className="relative z-10 -mt-6 sm:-mt-8 pointer-events-none flex flex-col items-center">
          <div className="relative w-16 sm:w-20 h-32 sm:h-40 flex flex-col items-center">
            <div className="w-8 sm:w-9 h-9 sm:h-10 bg-[#121316] rounded-t-full shadow-lg border-t border-amber-900/30" />
            <div className="w-14 sm:w-16 h-16 sm:h-20 bg-[#16171b] rounded-t-xl -mt-2 shadow-2xl flex flex-col items-center">
              <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-full border-t border-white/5 mt-1" />
            </div>
            <div className="flex gap-1.5 sm:gap-2 w-10 sm:w-12 h-12 sm:h-16 -mt-1">
              <div className="w-3.5 sm:w-4 h-full bg-[#111215] rounded-b-sm" />
              <div className="w-3.5 sm:w-4 h-full bg-[#111215] rounded-b-sm" />
            </div>
          </div>
          <div className="w-24 sm:w-28 h-5 sm:h-6 bg-black/80 rounded-full blur-md -mt-3" />
        </div>
      </main>

      {/* BOTTOM HUD */}
      <footer className="relative z-30 flex items-end justify-between px-4 sm:px-8 pb-4 sm:pb-6 pointer-events-auto">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Amigos */}
          <button
            id="nav-amigos-btn"
            type="button"
            onClick={onOpenFriends}
            className="flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-black/60 hover:bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 text-amber-400 transition-all cursor-pointer group"
          >
            <Users className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[8px] sm:text-[9px] font-bold tracking-wider mt-0.5 sm:mt-1 text-amber-200">
              AMIGOS
            </span>
          </button>

          {/* Loja */}
          <button
            id="nav-loja-btn"
            type="button"
            onClick={onOpenShop}
            className="flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-black/60 hover:bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 text-amber-400 transition-all cursor-pointer group"
            title="Abrir Loja de Avatares e Itens"
          >
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[8px] sm:text-[9px] font-bold tracking-wider mt-0.5 sm:mt-1 text-amber-200">
              LOJA
            </span>
          </button>

          {/* Visual / Inventário */}
          {onOpenCustomization && (
            <button
              id="nav-personalizar-btn"
              type="button"
              onClick={onOpenCustomization}
              className="flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/40 hover:border-[#ffd700] text-[#ffd700] transition-all cursor-pointer group"
              title="Personalização do Usuário (Inventário e Poses)"
            >
              <Shirt className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
              <span className="text-[8px] sm:text-[9px] font-bold tracking-wider mt-0.5 sm:mt-1 text-[#ffd700]">
                VISUAL
              </span>
            </button>
          )}

          {/* Upload 3D */}
          <button
            id="nav-upload-glb-btn"
            type="button"
            onClick={onOpenUpload}
            className="flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-b from-[#d4af37]/30 to-[#ffd700]/10 hover:from-[#d4af37]/50 hover:to-[#ffd700]/30 border-2 border-[#ffd700] text-[#ffd700] shadow-[0_0_15px_rgba(255,215,0,0.3)] transition-all cursor-pointer group"
            title="Upload GLB direto para o bucket models com UUID"
          >
            <UploadCloud className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform text-[#ffd700]" />
            <span className="text-[8px] sm:text-[9px] font-black tracking-wider mt-0.5 sm:mt-1 text-[#ffd700]">
              UPLOAD
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Chat */}
          <button
            type="button"
            className="flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-black/60 hover:bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 text-amber-400 transition-all cursor-pointer group"
          >
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[8px] sm:text-[9px] font-bold tracking-wider mt-0.5 sm:mt-1 text-amber-200">
              CHAT
            </span>
          </button>
        </div>
      </footer>
    </div>
  );
};
