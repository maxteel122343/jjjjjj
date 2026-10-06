import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Radio,
  Music,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  RadioTower,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import { AudioPlaylistItem } from '../types';

interface RoomAudioPlayerProps {
  radioUrl?: string;
  playlist?: AudioPlaylistItem[];
  roomName?: string;
  isCreator?: boolean;
  onUpdateAudioConfig?: (config: { radioUrl?: string; playlist?: AudioPlaylistItem[]; audioEnabled?: boolean }) => void;
}

const DEFAULT_RADIO = 'https://music.poprockenlinea.com/listen/poprock/radio.mp3';

export const RoomAudioPlayer: React.FC<RoomAudioPlayerProps> = ({
  radioUrl: propRadioUrl,
  playlist: propPlaylist = [],
  roomName = 'Sala 3D',
  isCreator = true,
  onUpdateAudioConfig,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.65);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activeSourceType, setActiveSourceType] = useState<'radio' | 'playlist'>('radio');
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [radioStreamUrl, setRadioStreamUrl] = useState<string>(() => {
    return propRadioUrl || DEFAULT_RADIO;
  });
  const [playlist, setPlaylist] = useState<AudioPlaylistItem[]>(() => {
    if (propPlaylist && propPlaylist.length > 0) return propPlaylist;
    return [
      {
        id: 'track-poprock-radio',
        title: 'Pop Rock En Línea (Ao Vivo)',
        url: DEFAULT_RADIO,
        artist: 'Web Rádio Internacional',
        isRadio: true,
      },
    ];
  });
  const [newRadioInput, setNewRadioInput] = useState<string>(propRadioUrl || DEFAULT_RADIO);
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync prop changes
  useEffect(() => {
    if (propRadioUrl) {
      setRadioStreamUrl(propRadioUrl);
      setNewRadioInput(propRadioUrl);
    }
  }, [propRadioUrl]);

  useEffect(() => {
    if (propPlaylist && propPlaylist.length > 0) {
      setPlaylist(propPlaylist);
    }
  }, [propPlaylist]);

  // Determine current audio source
  const currentUrl = activeSourceType === 'radio'
    ? radioStreamUrl
    : playlist[currentTrackIndex]?.url || radioStreamUrl;

  const currentTitle = activeSourceType === 'radio'
    ? '📻 Rádio Pop/Rock ao Vivo'
    : playlist[currentTrackIndex]?.title || 'Música da Sala';

  const currentArtist = activeSourceType === 'radio'
    ? 'Transmissão Contínua'
    : playlist[currentTrackIndex]?.artist || roomName;

  // Sync audio element volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    setAudioError(null);

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('[Audio Player] Playback error or autoplay blocked:', err);
        setAudioError('Clique para reproduzir (bloqueio do navegador)');
        setIsPlaying(false);
      });
    }
  };

  // Switch to next track in playlist
  const handleNextTrack = () => {
    if (playlist.length === 0) return;
    setActiveSourceType('playlist');
    setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }, 100);
  };

  // Switch to previous track
  const handlePrevTrack = () => {
    if (playlist.length === 0) return;
    setActiveSourceType('playlist');
    setCurrentTrackIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }, 100);
  };

  // Add custom radio link
  const handleApplyRadio = () => {
    if (!newRadioInput.trim()) return;
    const cleanUrl = newRadioInput.trim();
    setRadioStreamUrl(cleanUrl);
    setActiveSourceType('radio');
    if (onUpdateAudioConfig) {
      onUpdateAudioConfig({ radioUrl: cleanUrl, playlist });
    }
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }, 150);
  };

  // Upload local MP3 file
  const handleUploadMp3 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    const fileName = file.name.replace(/\.[^/.]+$/, '');
    const newTrack: AudioPlaylistItem = {
      id: `local-mp3-${Date.now()}`,
      title: fileName,
      url: fileUrl,
      artist: 'Upload Local',
      isRadio: false,
    };

    const updated = [...playlist, newTrack];
    setPlaylist(updated);
    setActiveSourceType('playlist');
    setCurrentTrackIndex(updated.length - 1);

    if (onUpdateAudioConfig) {
      onUpdateAudioConfig({ radioUrl: radioStreamUrl, playlist: updated });
    }

    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }, 150);
  };

  const handleRemoveTrack = (trackId: string) => {
    const updated = playlist.filter((t) => t.id !== trackId);
    setPlaylist(updated);
    if (currentTrackIndex >= updated.length) {
      setCurrentTrackIndex(Math.max(0, updated.length - 1));
    }
    if (onUpdateAudioConfig) {
      onUpdateAudioConfig({ radioUrl: radioStreamUrl, playlist: updated });
    }
  };

  return (
    <div className="fixed top-16 right-3 sm:right-6 z-40 select-none font-sans max-w-[calc(100vw-24px)] pointer-events-auto">
      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={currentUrl}
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => {
          setAudioError('Erro ao carregar áudio/stream');
          setIsPlaying(false);
        }}
        onEnded={() => {
          if (activeSourceType === 'playlist') {
            handleNextTrack();
          }
        }}
      />

      {/* COMPACT FLOATING CONTROLLER (when collapsed) */}
      {!isExpanded ? (
        <div className="flex items-center gap-1.5 p-1 bg-black/75 hover:bg-black/90 backdrop-blur-xl border border-[#ffd700]/40 rounded-full shadow-[0_4px_25px_rgba(0,0,0,0.8)] transition-all">
          <button
            type="button"
            onClick={togglePlay}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isPlaying
                ? 'bg-[#ffd700] text-black shadow-[0_0_12px_rgba(255,215,0,0.6)]'
                : 'bg-zinc-800 text-zinc-300 hover:text-white'
            }`}
            title={isPlaying ? 'Pausar Áudio' : 'Reproduzir Rádio / Música'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
          </button>

          {/* Equalizer animation bar & Title */}
          <div
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-2 px-2 py-0.5 cursor-pointer max-w-[130px] sm:max-w-[180px]"
            title="Abrir reprodutor de áudio / rádio da sala"
          >
            <div className="flex items-end gap-0.5 h-3.5">
              <span className={`w-0.5 bg-[#ffd700] rounded-full transition-all ${isPlaying ? 'h-3 animate-pulse' : 'h-1'}`} />
              <span className={`w-0.5 bg-[#ffd700] rounded-full transition-all ${isPlaying ? 'h-2 animate-bounce' : 'h-1'}`} />
              <span className={`w-0.5 bg-[#ffd700] rounded-full transition-all ${isPlaying ? 'h-3.5 animate-pulse' : 'h-1.5'}`} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-amber-200 truncate">
                {currentTitle}
              </span>
              <span className="text-[9px] text-zinc-400 truncate">
                {activeSourceType === 'radio' ? 'Rádio Online' : currentArtist}
              </span>
            </div>
          </div>

          {/* Quick Mute */}
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 rounded-full text-zinc-400 hover:text-[#ffd700] transition-colors cursor-pointer"
            title={isMuted ? 'Desmutar' : 'Mutar'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Expand */}
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="p-1 rounded-full text-zinc-400 hover:text-white cursor-pointer mr-0.5"
            title="Expandir reprodutor"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* EXPANDED PLAYER PANEL */
        <div className="w-72 sm:w-80 bg-[#121319]/95 backdrop-blur-2xl border border-[#ffd700]/50 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.9)] p-3.5 space-y-3 animate-fade-in text-white">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-[#ffd700]/20 border border-[#ffd700]/50 flex items-center justify-center text-[#ffd700]">
                {activeSourceType === 'radio' ? <RadioTower className="w-3.5 h-3.5" /> : <Music className="w-3.5 h-3.5" />}
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-200">Áudio & Rádio da Sala</h4>
                <p className="text-[9px] text-zinc-400">Trilha sonora em tempo real</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="p-1 text-zinc-400 hover:text-white cursor-pointer rounded-lg hover:bg-white/5"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          {/* Now Playing Banner */}
          <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between">
            <div className="min-w-0 flex-1 pr-2">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                  {isPlaying ? 'Reproduzindo' : 'Pausado'}
                </span>
              </div>
              <h5 className="text-xs font-bold text-white truncate mt-0.5">{currentTitle}</h5>
              <p className="text-[10px] text-zinc-400 truncate">{currentArtist}</p>
            </div>

            {/* Main Play/Pause Button */}
            <button
              type="button"
              onClick={togglePlay}
              className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all flex-shrink-0 ${
                isPlaying
                  ? 'bg-gradient-to-r from-[#d4af37] to-[#ffd700] text-black shadow-[0_0_15px_rgba(255,215,0,0.5)]'
                  : 'bg-zinc-800 text-white hover:bg-zinc-700'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
          </div>

          {audioError && (
            <div className="text-[10px] text-amber-400 bg-amber-950/60 border border-amber-500/30 rounded-lg p-1.5 text-center">
              {audioError}
            </div>
          )}

          {/* Volume Control & Track Controls */}
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-1.5 flex-1">
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  setIsMuted(false);
                }}
                className="w-full accent-[#ffd700] h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Prev / Next Track buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevTrack}
                disabled={playlist.length <= 1}
                className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Faixa anterior"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNextTrack}
                disabled={playlist.length <= 1}
                className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Próxima faixa"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Source Tabs: Rádio Online vs Playlist MP3 */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/40 rounded-xl border border-white/5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setActiveSourceType('radio')}
              className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeSourceType === 'radio'
                  ? 'bg-[#ffd700] text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Radio className="w-3 h-3" />
              <span>Link de Rádio</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSourceType('playlist')}
              className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeSourceType === 'playlist'
                  ? 'bg-[#ffd700] text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Music className="w-3 h-3" />
              <span>Playlist ({playlist.length})</span>
            </button>
          </div>

          {/* TAB 1: Rádio Stream Config */}
          {activeSourceType === 'radio' && (
            <div className="space-y-2 pt-1 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                  URL da Estação de Rádio (Stream .mp3 ou .aac):
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newRadioInput}
                    onChange={(e) => setNewRadioInput(e.target.value)}
                    placeholder="https://.../radio.mp3"
                    className="flex-1 bg-black/70 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#ffd700]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyRadio}
                    className="px-2.5 py-1.5 bg-[#ffd700] hover:bg-amber-300 text-black font-bold text-xs rounded-lg cursor-pointer transition-colors"
                  >
                    Tocar
                  </button>
                </div>
              </div>

              {/* Radio Preset Helper */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setNewRadioInput('https://music.poprockenlinea.com/listen/poprock/radio.mp3');
                    setRadioStreamUrl('https://music.poprockenlinea.com/listen/poprock/radio.mp3');
                  }}
                  className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-amber-300 cursor-pointer flex items-center gap-1"
                >
                  <span>📻 Pop Rock en Línea</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Playlist & MP3 Upload */}
          {activeSourceType === 'playlist' && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-zinc-400">Faixas da Sala:</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2 py-1 bg-white/10 hover:bg-[#ffd700] hover:text-black text-[10px] font-bold rounded-lg border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Subir MP3</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/mp3,audio/mpeg,audio/wav,audio/ogg"
                  className="hidden"
                  onChange={handleUploadMp3}
                />
              </div>

              {/* Playlist Tracks List */}
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {playlist.map((track, idx) => {
                  const isCurrent = activeSourceType === 'playlist' && currentTrackIndex === idx;
                  return (
                    <div
                      key={track.id}
                      onClick={() => {
                        setActiveSourceType('playlist');
                        setCurrentTrackIndex(idx);
                        setTimeout(() => {
                          if (audioRef.current) {
                            audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                          }
                        }, 100);
                      }}
                      className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        isCurrent
                          ? 'bg-[#ffd700]/20 border border-[#ffd700]/50 text-amber-200 font-bold'
                          : 'bg-black/40 hover:bg-white/5 border border-transparent text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[10px] text-zinc-500 font-mono w-4">{idx + 1}</span>
                        <span className="truncate">{track.title}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isCurrent && isPlaying && (
                          <span className="text-[10px] text-[#ffd700]">▶</span>
                        )}
                        {playlist.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveTrack(track.id);
                            }}
                            className="p-1 text-zinc-500 hover:text-red-400"
                            title="Remover faixa"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
