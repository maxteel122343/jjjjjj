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
}) => {
  const activeRoom = rooms[selectedRoomIndex] || rooms[1];

  // We want to show 3 portals in perspective matching Reference 2:
  // Left: index 0, Center (highlighted): index 1, Right: index 2.
  // If the user uploads a new room, it can also be viewed by cycling or selecting!

  const portalSlots = [
    { index: (selectedRoomIndex - 1 + rooms.length) % rooms.length, pos: 'left' },
    { index: selectedRoomIndex, pos: 'center' },
    { index: (selectedRoomIndex + 1) % rooms.length, pos: 'right' },
  ];

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
        {/* Overhead Spotlights Beams */}
        <div className="absolute top-0 left-1/4 w-32 h-96 bg-gradient-to-b from-amber-100/10 via-amber-200/5 to-transparent blur-2xl transform -rotate-12" />
        <div className="absolute top-0 right-1/4 w-32 h-96 bg-gradient-to-b from-amber-100/10 via-amber-200/5 to-transparent blur-2xl transform rotate-12" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-full bg-gradient-to-b from-amber-200/15 via-transparent to-amber-500/10 blur-3xl" />

        {/* Ambient Dark Classical Room Pillars */}
        <div className="absolute inset-x-0 top-0 h-48 border-b border-amber-900/20 bg-gradient-to-b from-black/80 to-transparent" />
      </div>

      {/* TOP HUD matching Reference 2:
          Profile (Luzenne, Nv. 12, Level Bar) on left | Gold Coins, Gems, Login, Modo Criador on right */}
      <header className="relative z-30 flex items-center justify-between px-8 pt-6 pointer-events-auto">
        {/* Profile Card - clickable to open Auth/Profile */}
        <div
          onClick={onOpenAuthModal}
          className="flex items-center gap-3 cursor-pointer group"
          title="Minha Conta / Login / Cadastrar"
        >
          {/* Avatar with Gold Ring */}
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-zinc-900 ring-2 ring-[#ffd700] ring-offset-2 ring-offset-black overflow-hidden shadow-[0_0_15px_rgba(255,215,0,0.3)] group-hover:ring-amber-300 transition-all">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                alt="Luzenne"
                className="w-full h-full object-cover filter contrast-125 brightness-90 group-hover:scale-105 transition-transform"
                referrerPolicy="no-referrer"
              />
            </div>
            {/* Ambient status indicator */}
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#ffd700] border-2 border-black" />
          </div>

          {/* Name, Level and Progress Bar */}
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-zinc-100 tracking-wide group-hover:text-[#ffd700] transition-colors">
                {user && !user.isGuest ? user.displayName : 'Luzenne'}
              </span>
              <span className="text-xs text-amber-400 font-semibold">
                Nv. 12
              </span>
            </div>
            {/* Gold Progress Bar matching Reference 2 */}
            <div className="flex items-center gap-2 mt-1">
              <div className="w-28 h-1.5 rounded-full bg-black/60 border border-amber-900/40 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 to-[#ffd700]"
                  style={{ width: '35%' }}
                />
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">
                420 / 1200
              </span>
            </div>
          </div>
        </div>

        {/* Currency & Menu HUD with Login / Cadastro & Loja */}
        <div className="flex items-center gap-3">
          {/* Gold Coin */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-amber-500/20 backdrop-blur-md">
            <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-[10px] text-black font-black shadow-[0_0_8px_#f59e0b]">
              ●
            </div>
            <span className="text-xs font-bold text-amber-200">2.450</span>
          </div>

          {/* Diamond Gem */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-purple-500/20 backdrop-blur-md">
            <div className="w-3.5 h-3.5 rotate-45 bg-purple-400 shadow-[0_0_8px_#c084fc]" />
            <span className="text-xs font-bold text-purple-200">180</span>
          </div>

          {/* BOTÃO LOJA & PERSONALIZAR AVATAR (DESTAQUE NO TOPO DA VITRINE) */}
          <button
            id="lobby-customization-btn"
            type="button"
            onClick={() => {
              if (onOpenCustomization) onOpenCustomization();
              else if (onOpenShop) onOpenShop();
            }}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#ffd700] hover:from-[#e5bd38] hover:to-[#ffe033] text-black text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(255,215,0,0.45)] transition-all cursor-pointer active:scale-95 border border-[#ffd700]"
            title="Abrir Loja de Roupas, Avatares e Poses (Personalização 3D)"
          >
            <ShoppingBag className="w-4 h-4 text-black stroke-[2.5]" />
            <span className="font-extrabold tracking-wide">LOJA & PERSONALIZAR</span>
          </button>

          {/* LOGIN / CADASTRO ICON BUTTON: "inserri icone d elogin / cadstro na vitrine do usuario" */}
          {onOpenAuthModal && (
            <div className="flex items-center gap-1.5">
              <button
                id="lobby-auth-btn"
                type="button"
                onClick={onOpenAuthModal}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold backdrop-blur-md transition-all cursor-pointer shadow-lg active:scale-95 ${
                  user && !user.isGuest
                    ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900/60'
                    : 'bg-black/70 hover:bg-[#d4af37]/20 border-[#ffd700]/70 text-[#ffd700] shadow-[0_0_12px_rgba(255,215,0,0.2)]'
                }`}
                title={
                  user && !user.isGuest
                    ? `Conectado como ${user.displayName} (${user.email}) - Clique para ver perfil`
                    : 'Fazer Login ou Criar Cadastro'
                }
              >
                <div className="w-5 h-5 rounded-full border border-[#d4af37] flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-[#ffd700]" />
                </div>
                <span className="hidden sm:inline">{user && !user.isGuest ? user.displayName : 'Login / Cadastro'}</span>
              </button>

              {user && !user.isGuest && onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="p-1.5 rounded-xl border border-red-500/40 hover:border-red-400 bg-red-950/50 hover:bg-red-900/70 text-red-300 hover:text-white transition-all cursor-pointer shadow-md"
                  title="Sair da Conta (Logout)"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Botão Abrir Modo Criador */}
          {onOpenEditor && (
            <button
              type="button"
              onClick={onOpenEditor}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#d4af37]/20 border border-[#d4af37] text-xs font-bold text-[#ffd700] hover:bg-[#d4af37] hover:text-black transition-all cursor-pointer shadow-md"
              title="Abrir Modo Criador / Editor 3D"
            >
              <Box className="w-4 h-4" />
              <span className="hidden md:inline">Modo Criador</span>
            </button>
          )}

          {/* Top Menu Icon */}
          <button
            type="button"
            className="w-10 h-10 rounded-xl bg-black/40 border border-amber-500/30 flex items-center justify-center text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* CENTER 3D PORTAL HALL
          Player standing in foreground looking at the 3 framed portals */}
      <main className="relative flex-1 flex flex-col items-center justify-center px-4">
        {/* Quick Action Banner: LOJA & PERSONALIZAR AVATAR */}
        <div className="z-20 mb-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (onOpenCustomization) onOpenCustomization();
              else if (onOpenShop) onOpenShop();
            }}
            className="flex items-center gap-2.5 px-5 py-2 rounded-xl bg-black/80 hover:bg-[#d4af37] text-[#ffd700] hover:text-black border-2 border-[#ffd700] text-xs font-black tracking-wider uppercase transition-all shadow-[0_0_25px_rgba(255,215,0,0.35)] cursor-pointer active:scale-95"
            title="Abrir Loja de Roupas e Personalizar Avatar"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Personalizar Avatar & Loja de Roupas</span>
          </button>
        </div>

        {/* 3D Perspective Portals Container */}
        <div className="relative w-full max-w-5xl flex items-center justify-center gap-4 md:gap-8 perspective-[1200px] z-10 pt-2">
          {portalSlots.map((slot, i) => {
            const room = rooms[slot.index];
            const isCenter = slot.pos === 'center';
            const isLeft = slot.pos === 'left';
            const isRight = slot.pos === 'right';

            return (
              <div
                key={`${room.id}-${slot.pos}`}
                onClick={() => onSelectRoomIndex(slot.index)}
                className={`relative transition-all duration-500 ease-out cursor-pointer group ${
                  isCenter
                    ? 'w-72 md:w-80 z-20 scale-105 filter drop-shadow-[0_15px_35px_rgba(255,215,0,0.25)]'
                    : 'w-60 md:w-64 opacity-75 hover:opacity-100 scale-95 z-10'
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
                {/* 3D Ornate Moulding Frame */}
                <div
                  className={`relative rounded-lg p-2.5 transition-all duration-300 ${
                    isCenter
                      ? 'bg-gradient-to-b from-[#b8860b] via-[#ffd700] to-[#8b6508] shadow-[0_0_30px_rgba(255,215,0,0.4)] ring-2 ring-amber-300/80'
                      : 'bg-[#2b251d] hover:bg-[#3d3429] border border-amber-900/50 shadow-2xl'
                  }`}
                >
                  {/* Inside Frame Bevel */}
                  <div className="bg-[#121316] rounded overflow-hidden border border-black/80 flex flex-col">
                    {/* Frame Header Bar */}
                    <div className="px-3 py-2 bg-[#1a1714] border-b border-amber-900/40 flex items-center justify-between text-center">
                      <div className="flex items-center gap-1.5 text-xs font-serif font-bold tracking-wider text-amber-200 truncate">
                        <span className="text-amber-400">{room.badge || '👑'}</span>
                        <span>{room.name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-amber-400/90 font-semibold ml-2">
                        {room.occupation}
                      </span>
                    </div>

                    {/* Room 3D Perspective Preview Viewport */}
                    <div className="relative h-64 md:h-72 w-full overflow-hidden bg-black">
                      <img
                        src={room.thumb}
                        alt={room.name}
                        className="w-full h-full object-cover filter brightness-90 group-hover:scale-105 transition-transform duration-700"
                        referrerPolicy="no-referrer"
                      />

                      {/* Warm volumetric lighting vignette */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                      {/* Tag badge for rooms created/published in editor */}
                      {room.isFromEditor && (
                        <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-[#ffd700] text-black text-[9px] font-extrabold uppercase tracking-wider shadow-lg flex items-center gap-1">
                          <span>✨</span>
                          <span>Criada no Editor</span>
                        </div>
                      )}

                      {/* Subtle golden shimmer on highlighted center portal */}
                      {isCenter && (
                        <div className="absolute inset-0 ring-1 ring-inset ring-[#ffd700]/40 pointer-events-none" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Reflection on polished floor below each frame */}
                <div
                  className="w-full h-16 mt-1 rounded opacity-25 filter blur-sm overflow-hidden transform scale-y-[-1] pointer-events-none mask-image-gradient"
                  style={{
                    maskImage: 'linear-gradient(to bottom, black, transparent)',
                    WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
                  }}
                >
                  <img
                    src={room.thumb}
                    alt="reflection"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* PROMINENT "ENTRAR" BUTTON matching Reference 2
            Positioned right below the highlighted center portal */}
        <div className="relative z-20 mt-4 flex flex-col items-center">
          <button
            id="enter-highlighted-room-btn"
            type="button"
            onClick={() => onEnterRoom(activeRoom)}
            className="group relative px-10 py-3 rounded-lg bg-gradient-to-b from-[#2a2214] via-[#1a150c] to-[#0d0a06] border-2 border-[#ffd700] text-amber-300 font-serif font-bold text-lg tracking-widest shadow-[0_0_25px_rgba(255,215,0,0.45)] hover:shadow-[0_0_40px_rgba(255,215,0,0.7)] hover:text-white transition-all transform hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-3"
          >
            {/* Corner Ornamental Accents */}
            <span className="w-1.5 h-1.5 absolute -top-1 -left-1 bg-[#ffd700] rotate-45" />
            <span className="w-1.5 h-1.5 absolute -top-1 -right-1 bg-[#ffd700] rotate-45" />
            <span className="w-1.5 h-1.5 absolute -bottom-1 -left-1 bg-[#ffd700] rotate-45" />
            <span className="w-1.5 h-1.5 absolute -bottom-1 -right-1 bg-[#ffd700] rotate-45" />

            <span className="relative z-10">ENTRAR</span>
            <Sparkles className="w-4 h-4 text-[#ffd700] group-hover:rotate-12 transition-transform" />
          </button>
        </div>

        {/* Foreground Standing Player Silhouette seen from behind
            "O jogador está em pé olhando 3 portais-moldura 3D das salas" (Reference 2) */}
        <div className="relative z-10 -mt-8 pointer-events-none flex flex-col items-center">
          <div className="relative w-20 h-40 flex flex-col items-center">
            {/* Hooded head back silhouette */}
            <div className="w-9 h-10 bg-[#121316] rounded-t-full shadow-lg border-t border-amber-900/30" />
            {/* Hoodie shoulders & back */}
            <div className="w-16 h-20 bg-[#16171b] rounded-t-xl -mt-2 shadow-2xl flex flex-col items-center">
              <div className="w-10 h-10 rounded-full border-t border-white/5 mt-1" />
            </div>
            {/* Legs & shoes */}
            <div className="flex gap-2 w-12 h-16 -mt-1">
              <div className="w-4 h-full bg-[#111215] rounded-b-sm" />
              <div className="w-4 h-full bg-[#111215] rounded-b-sm" />
            </div>
          </div>

          {/* Player shadow and reflection on floor */}
          <div className="w-28 h-6 bg-black/80 rounded-full blur-md -mt-3" />
        </div>
      </main>

      {/* BOTTOM HUD matching Reference 2:
          Left: AMIGOS, EVENTOS, MENSAGENS, LOJA, plus UPLOAD 3D
          Right: CHAT, AVISOS */}
      <footer className="relative z-30 flex items-end justify-between px-8 pb-6 pointer-events-auto">
        {/* Left Shortcuts */}
        <div className="flex items-center gap-3">
          {/* Amigos */}
          <button
            id="nav-amigos-btn"
            type="button"
            onClick={onOpenFriends}
            className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-black/60 hover:bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 text-amber-400 transition-all cursor-pointer group"
          >
            <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-bold tracking-wider mt-1 text-amber-200">
              AMIGOS
            </span>
          </button>

          {/* Eventos */}
          <button
            type="button"
            className="relative flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-black/60 hover:bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 text-amber-400 transition-all cursor-pointer group"
          >
            <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
            <Gift className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-bold tracking-wider mt-1 text-amber-200">
              EVENTOS
            </span>
          </button>

          {/* Mensagens */}
          <button
            type="button"
            className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-black/60 hover:bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 text-amber-400 transition-all cursor-pointer group"
          >
            <Mail className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-bold tracking-wider mt-1 text-amber-200">
              MENSAGENS
            </span>
          </button>

          {/* Loja */}
          <button
            id="nav-loja-btn"
            type="button"
            onClick={onOpenShop}
            className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-black/60 hover:bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 text-amber-400 transition-all cursor-pointer group"
            title="Abrir Loja de Avatares e Itens"
          >
            <ShoppingBag className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-bold tracking-wider mt-1 text-amber-200">
              LOJA
            </span>
          </button>

          {/* Personalização / Inventário de Itens */}
          {onOpenCustomization && (
            <button
              id="nav-personalizar-btn"
              type="button"
              onClick={onOpenCustomization}
              className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/40 hover:border-[#ffd700] text-[#ffd700] transition-all cursor-pointer group"
              title="Personalização do Usuário (Inventário e Poses)"
            >
              <Shirt className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-bold tracking-wider mt-1 text-[#ffd700]">
                VISUAL
              </span>
            </button>
          )}

          {/* Upload 3D - Direct entry to 3D pipeline required in prompt! */}
          <button
            id="nav-upload-3d-btn"
            type="button"
            onClick={onOpenUpload}
            className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-t from-amber-950/70 to-black/80 hover:from-amber-900/80 border border-[#ffd700]/60 hover:border-[#ffd700] text-[#ffd700] transition-all cursor-pointer group shadow-[0_0_15px_rgba(255,215,0,0.2)]"
            title="Upload de Arquivo 3D (GLB/GLTF)"
          >
            <UploadCloud className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-bold tracking-wider mt-1 text-amber-300">
              UPLOAD 3D
            </span>
          </button>
        </div>

        {/* Right Shortcuts */}
        <div className="flex items-center gap-3">
          {/* Chat */}
          <button
            type="button"
            className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-black/60 hover:bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 text-amber-400 transition-all cursor-pointer group"
          >
            <MessageSquare className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-bold tracking-wider mt-1 text-amber-200">
              CHAT
            </span>
          </button>

          {/* Avisos */}
          <button
            type="button"
            className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-black/60 hover:bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 text-amber-400 transition-all cursor-pointer group"
          >
            <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-bold tracking-wider mt-1 text-amber-200">
              AVISOS
            </span>
          </button>
        </div>
      </footer>
    </div>
  );
};
