import React, { useState } from 'react';
import {
  X,
  Download,
  Upload,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Database,
  Box,
  MapPin,
  FolderArchive,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  RoomEditorState,
  InventoryItem,
  CustomizationItem,
  StoreAvatar,
  AvatarPoseConfig,
  SpotVisualConfig,
  CreatorUser,
  ProjectExportPackage,
} from '../types';
import {
  exportAllGlbsAsBase64,
  importGlbsFromBase64,
  base64ToBlob,
  getGlbFile,
} from '../lib/storageIndexedDB';

interface ProjectSaveRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: RoomEditorState[];
  inventory: InventoryItem[];
  activeRoomId: string;
  customizationItems: CustomizationItem[];
  storeAvatars: StoreAvatar[];
  avatarPoses: AvatarPoseConfig[];
  spotVisualConfig?: SpotVisualConfig;
  user: CreatorUser | null;
  onRestoreProject: (data: {
    rooms: RoomEditorState[];
    inventory: InventoryItem[];
    activeRoomId: string;
    customizationItems?: CustomizationItem[];
    storeAvatars?: StoreAvatar[];
    avatarPoses?: AvatarPoseConfig[];
    spotVisualConfig?: SpotVisualConfig;
  }) => void;
}

export const ProjectSaveRestoreModal: React.FC<ProjectSaveRestoreModalProps> = ({
  isOpen,
  onClose,
  rooms,
  inventory,
  activeRoomId,
  customizationItems,
  storeAvatars,
  avatarPoses,
  spotVisualConfig,
  user,
  onRestoreProject,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [projectName, setProjectName] = useState('Meu Projeto 3D Lounge');
  const [includeBinaryGlbs, setIncludeBinaryGlbs] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importedPackage, setImportedPackage] = useState<ProjectExportPackage | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  // Total objects count across all rooms
  const totalObjectsCount = rooms.reduce((acc, r) => acc + (r.placedObjects?.length || 0), 0);
  const totalSpotsCount = rooms.reduce((acc, r) => acc + (r.spots?.length || 0), 0);
  const totalGlbCount = inventory.filter((i) => i.fileBlobUrl || i.modelType === 'custom_glb').length;

  // Handle Export / Download project file
  const handleExportProject = async () => {
    setIsExporting(true);
    setExportSuccess(false);
    setExportError(null);

    try {
      let filesMap: Record<string, string> = {};

      if (includeBinaryGlbs) {
        // Collect Base64 binaries of all uploaded models from IndexedDB
        filesMap = await exportAllGlbsAsBase64();

        // Also check if any inventory item has a blob URL not yet in IndexedDB
        for (const item of inventory) {
          if (!filesMap[item.id] && item.fileBlobUrl) {
            try {
              const res = await fetch(item.fileBlobUrl);
              const blob = await res.blob();
              const reader = new FileReader();
              const b64 = await new Promise<string>((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              filesMap[item.id] = b64;
            } catch (fetchErr) {
              console.warn(`Could not read blob for item ${item.displayName}:`, fetchErr);
            }
          }
        }
      }

      const projectData: ProjectExportPackage = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        projectName: projectName.trim() || 'Projeto 3D Social',
        activeRoomId: activeRoomId,
        rooms: rooms.map((r) => ({
          ...r,
          // Strip volatile blob: URLs from JSON so they don't break on another machine
          sceneAssetBlobUrl: undefined,
          placedObjects: r.placedObjects.map((obj) => ({
            ...obj,
            fileBlobUrl: undefined,
          })),
        })),
        inventory: inventory.map((i) => ({
          ...i,
          fileBlobUrl: undefined,
        })),
        customizationItems,
        storeAvatars,
        avatarPoses,
        spotVisualConfig,
        user: user || undefined,
        files: filesMap,
      };

      const jsonString = JSON.stringify(projectData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(blob);

      const safeName = (projectName.trim() || 'projeto-3d')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_');
      const dateStr = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${safeName}_${dateStr}.3dproj.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setExportSuccess(true);
    } catch (err: any) {
      console.error('Export error:', err);
      setExportError('Erro ao exportar projeto: ' + (err.message || String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  // Handle File Input for Import / Restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportedPackage(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImportFile(file);

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content) as ProjectExportPackage;

          if (!parsed.rooms || !Array.isArray(parsed.rooms)) {
            throw new Error('Arquivo de projeto inválido: lista de salas ausente.');
          }
          if (!parsed.inventory || !Array.isArray(parsed.inventory)) {
            throw new Error('Arquivo de projeto inválido: lista de inventário ausente.');
          }

          setImportedPackage(parsed);
        } catch (err: any) {
          setImportError('Erro ao ler arquivo: ' + (err.message || 'Formato JSON inválido.'));
          setImportedPackage(null);
        }
      };
      reader.onerror = () => {
        setImportError('Falha ao abrir arquivo.');
      };
      reader.readAsText(file);
    }
  };

  // Execute Restore from parsed package
  const handleExecuteRestore = async () => {
    if (!importedPackage) return;
    setIsImporting(true);

    try {
      // 1. If embedded files are present, restore them to IndexedDB and generate fresh Blob URLs
      const restoredBlobUrls: Record<string, string> = {};

      if (importedPackage.files && Object.keys(importedPackage.files).length > 0) {
        await importGlbsFromBase64(importedPackage.files);

        // Create fresh object URLs for all restored GLBs
        for (const id of Object.keys(importedPackage.files)) {
          const blob = await getGlbFile(id);
          if (blob) {
            restoredBlobUrls[id] = URL.createObjectURL(blob);
          }
        }
      }

      // 2. Map inventory items with restored Blob URLs
      const restoredInventory: InventoryItem[] = importedPackage.inventory.map((item) => {
        const matchingUrl = restoredBlobUrls[item.id];
        return {
          ...item,
          fileBlobUrl: matchingUrl || item.fileBlobUrl,
        };
      });

      // 3. Map rooms and placed objects with restored Blob URLs
      const restoredRooms: RoomEditorState[] = importedPackage.rooms.map((room) => {
        const scenarioUrl = room.sceneAssetId ? restoredBlobUrls[room.sceneAssetId] : undefined;
        return {
          ...room,
          sceneAssetBlobUrl: scenarioUrl || room.sceneAssetBlobUrl,
          placedObjects: (room.placedObjects || []).map((obj) => {
            const objUrl = obj.assetId ? restoredBlobUrls[obj.assetId] : undefined;
            return {
              ...obj,
              fileBlobUrl: objUrl || obj.fileBlobUrl,
            };
          }),
        };
      });

      // 4. Pass restored data to parent App
      onRestoreProject({
        rooms: restoredRooms,
        inventory: restoredInventory,
        activeRoomId: importedPackage.activeRoomId || restoredRooms[0]?.id || 'room-a',
        customizationItems: importedPackage.customizationItems,
        storeAvatars: importedPackage.storeAvatars,
        avatarPoses: importedPackage.avatarPoses,
        spotVisualConfig: importedPackage.spotVisualConfig,
      });

      setIsImporting(false);
      onClose();
    } catch (err: any) {
      console.error('Restore error:', err);
      setImportError('Erro ao restaurar projeto: ' + (err.message || String(err)));
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 md:p-6 animate-fade-in font-sans">
      <div className="relative w-full max-w-3xl bg-[#121317] border border-[#d4af37]/60 rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.95)] text-[#e8d5b5] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#d4af37]/30 bg-[#16171e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#ffd700]/15 border border-[#d4af37] flex items-center justify-center text-[#ffd700]">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-extrabold text-[#ffd700] tracking-wide uppercase">
                Salvar, Exportar & Restaurar Projeto
              </h2>
              <p className="text-[11px] text-[#e8d5b5]/70">
                Guarde seu trabalho em arquivo (.json/.3dproj) e restaure exatamente de onde parou em qualquer navegador.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#d4af37]/70 hover:text-[#ffd700] hover:bg-[#d4af37]/15 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 border-b border-[#d4af37]/30 bg-black/40 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`py-3 flex items-center justify-center gap-2 transition-all cursor-pointer border-b-2 ${
              activeTab === 'export'
                ? 'border-[#ffd700] text-[#ffd700] bg-[#1a1b24]'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar / Salvar Arquivo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`py-3 flex items-center justify-center gap-2 transition-all cursor-pointer border-b-2 ${
              activeTab === 'import'
                ? 'border-[#ffd700] text-[#ffd700] bg-[#1a1b24]'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Restaurar Projeto (Upload)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5 custom-scrollbar">
          {/* TAB 1: EXPORT / SAVE */}
          {activeTab === 'export' && (
            <div className="space-y-5">
              {/* Quick Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-[#181922] border border-[#d4af37]/30 flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-400 uppercase font-semibold flex items-center gap-1">
                    <Layers className="w-3 h-3 text-[#d4af37]" /> Salas
                  </span>
                  <span className="text-base font-extrabold text-[#ffd700]">{rooms.length}</span>
                  <span className="text-[9px] text-zinc-400 truncate">
                    {rooms.map((r) => r.name.split('·')[0].trim()).join(', ')}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#181922] border border-[#d4af37]/30 flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-400 uppercase font-semibold flex items-center gap-1">
                    <Box className="w-3 h-3 text-[#d4af37]" /> Objetos 3D
                  </span>
                  <span className="text-base font-extrabold text-[#ffd700]">{totalObjectsCount}</span>
                  <span className="text-[9px] text-zinc-400">Na maquete ativa</span>
                </div>

                <div className="p-3 rounded-xl bg-[#181922] border border-[#d4af37]/30 flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-400 uppercase font-semibold flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#d4af37]" /> Spots
                  </span>
                  <span className="text-base font-extrabold text-[#ffd700]">{totalSpotsCount}</span>
                  <span className="text-[9px] text-zinc-400">Sentar, deitar e pé</span>
                </div>

                <div className="p-3 rounded-xl bg-[#181922] border border-[#d4af37]/30 flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-400 uppercase font-semibold flex items-center gap-1">
                    <FolderArchive className="w-3 h-3 text-[#d4af37]" /> Inventário
                  </span>
                  <span className="text-base font-extrabold text-[#ffd700]">{inventory.length}</span>
                  <span className="text-[9px] text-zinc-400">{totalGlbCount} arquivos 3D</span>
                </div>
              </div>

              {/* Form Options */}
              <div className="p-4 rounded-xl bg-[#181922] border border-[#d4af37]/40 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#ffd700] mb-1">
                    Nome do Projeto / Arquivo
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Ex: Meu Lounge Virtual, Sala Principal..."
                    className="w-full bg-[#101116] border border-[#d4af37]/40 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#ffd700]"
                  />
                </div>

                {/* Checkbox: Include GLB binary models */}
                <label className="flex items-start gap-2.5 p-3 rounded-lg bg-black/40 border border-[#d4af37]/20 hover:border-[#d4af37]/50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={includeBinaryGlbs}
                    onChange={(e) => setIncludeBinaryGlbs(e.target.checked)}
                    className="mt-0.5 accent-[#ffd700] w-4 h-4 rounded cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-[#ffd700] block">
                      Embutir arquivos 3D binários (.GLB) no pacote exportado
                    </span>
                    <span className="text-[11px] text-zinc-400 block leading-relaxed mt-0.5">
                      Recomendado! Garante que todos os modelos 3D que você subiu por upload sejam empacotados em Base64.
                      Ao restaurar o arquivo em outro computador ou navegador, os modelos 3D reaparecerão perfeitamente.
                    </span>
                  </div>
                </label>
              </div>

              {/* Success Notification */}
              {exportSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/60 text-emerald-200 text-xs flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <strong>Download concluído!</strong> O arquivo do projeto foi salvo no seu computador.
                    Guarde-o em local seguro para restaurar quando quiser.
                  </div>
                </div>
              )}

              {/* Error Notification */}
              {exportError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/60 text-red-200 text-xs flex items-center gap-2 animate-fade-in">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div>{exportError}</div>
                </div>
              )}

              {/* Action Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleExportProject}
                  disabled={isExporting}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#ffd700] hover:from-[#e5bd38] hover:to-[#ffe033] text-black font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Empacotando modelos 3D...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Exportar e Baixar Projeto (.3dproj.json)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT / RESTORE */}
          {activeTab === 'import' && (
            <div className="space-y-5">
              {/* Dropzone Area */}
              <div className="relative border-2 border-dashed border-[#d4af37]/60 hover:border-[#ffd700] rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-black/40 hover:bg-[#d4af37]/10 transition-colors">
                <input
                  type="file"
                  accept=".json,.3dproj"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <FileJson className="w-12 h-12 text-[#ffd700] mb-2" />
                <p className="text-sm font-bold text-[#ffd700]">
                  {importFile ? importFile.name : 'Selecione ou solte o arquivo do projeto (.json / .3dproj)'}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  {importFile
                    ? `${(importFile.size / 1024).toFixed(1)} KB`
                    : 'Clique aqui para navegar pelos seus arquivos salvos'}
                </p>
                <div className="mt-3 px-3 py-1.5 rounded-lg border border-[#d4af37] text-xs font-semibold text-[#ffd700] bg-[#14151a]">
                  Procurar no computador
                </div>
              </div>

              {/* Error Message */}
              {importError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/60 text-red-200 text-xs flex items-center gap-2 animate-fade-in">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div>{importError}</div>
                </div>
              )}

              {/* Validated Package Preview */}
              {importedPackage && (
                <div className="p-4 rounded-xl bg-[#181922] border border-emerald-500/50 space-y-3 animate-fade-in">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Arquivo Válido & Pronto para Restaurar!</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded bg-black/50 border border-white/5">
                      <span className="text-[10px] text-zinc-400 block">Nome do Projeto:</span>
                      <strong className="text-white truncate block">{importedPackage.projectName}</strong>
                    </div>
                    <div className="p-2.5 rounded bg-black/50 border border-white/5">
                      <span className="text-[10px] text-zinc-400 block">Salas Salvas:</span>
                      <strong className="text-white block">{importedPackage.rooms?.length || 0} salas</strong>
                    </div>
                    <div className="p-2.5 rounded bg-black/50 border border-white/5">
                      <span className="text-[10px] text-zinc-400 block">Itens no Inventário:</span>
                      <strong className="text-white block">{importedPackage.inventory?.length || 0} itens</strong>
                    </div>
                    <div className="p-2.5 rounded bg-black/50 border border-white/5">
                      <span className="text-[10px] text-zinc-400 block">Modelos 3D Embutidos:</span>
                      <strong className="text-emerald-400 block">
                        {importedPackage.files ? Object.keys(importedPackage.files).length : 0} arquivos
                      </strong>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-300 leading-tight">
                    Ao confirmar, o editor será recarregado exatamente no estado deste arquivo, com todos os seus spots, maquetes, limites e arquivos 3D restaurados.
                  </p>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleExecuteRestore}
                      disabled={isImporting}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isImporting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Restaurando arquivos 3D...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Restaurar Projeto de Onde Parou</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
