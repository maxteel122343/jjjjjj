import React, { useState, useEffect } from 'react';
import { X, Box, Check, Upload, Sparkles, ArrowLeft, Tag, Pencil, Cloud, AlertCircle, RefreshCw } from 'lucide-react';
import { InventoryItem, StoreObjectType } from '../types';
import { persistStoreItem } from '../lib/database';
import { saveGlbFile } from '../lib/storageIndexedDB';
import { checkStorageHealth, uploadGlbDirect, StorageConfigHealth } from '../lib/assetSyncClient';
import { CoverImagePicker } from './CoverImagePicker';

interface UploadGLBModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (
    item: InventoryItem,
    autoInsertPoint?: [number, number, number] | null
  ) => void;
  userDisplayName?: string;
  insertionPoint?: [number, number, number] | null;
  onPublishToStore?: (item: InventoryItem) => void;
}

export const UploadGLBModal: React.FC<UploadGLBModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  userDisplayName = 'Luzenne',
  insertionPoint,
  onPublishToStore,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [thumbUrl, setThumbUrl] = useState('');
  const [selectedType, setSelectedType] = useState<'Sala' | 'Avatar' | 'Item'>('Item');
  const [uploadedItem, setUploadedItem] = useState<InventoryItem | null>(null);

  // Storage Health & Direct Upload State
  const [storageHealth, setStorageHealth] = useState<StorageConfigHealth | null>(null);
  const [isUploadingToStorage, setIsUploadingToStorage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      checkStorageHealth().then(setStorageHealth).catch(() => {});
    }
  }, [isOpen]);

  // Dual-mode publish state
  const [isConfiguringPublish, setIsConfiguringPublish] = useState(false);
  const [publishMode, setPublishMode] = useState<'simples' | 'avancado'>('simples');
  const [publishName, setPublishName] = useState('');
  const [publishObjectType, setPublishObjectType] = useState<StoreObjectType>('item');
  const [publishPrice, setPublishPrice] = useState(0);
  const [publishHashtags, setPublishHashtags] = useState('#comunidade, #3d, #criador');
  const [publishThumb, setPublishThumb] = useState('');
  const [publishRarity, setPublishRarity] = useState<'COMUM' | 'RARO' | 'ÉLITE'>('RARO');
  const [publishDescription, setPublishDescription] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      // Clean up base name for readability while letting user customize it freely
      const baseName = f.name.replace(/\.[^/.]+$/, '').trim();
      const readable = baseName.replace(/[_-]+/g, ' ').trim();
      const formatted = readable.charAt(0).toUpperCase() + readable.slice(1);
      setDisplayName(formatted || baseName);
    }
  };

  const handleThumbImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const imgFile = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setThumbUrl(ev.target.result as string);
        }
      };
      reader.readAsDataURL(imgFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (!file) {
      setUploadError('Selecione um arquivo .glb para realizar o upload.');
      return;
    }

    // 3. Garante terminação única em .glb sem duplicar (.glb.glb)
    const cleanBaseName = file.name.replace(/(\.glb)+$/i, '').trim() || 'modelo';
    const finalFileName = `${cleanBaseName}.glb`;
    const finalDisplayName = displayName.trim() || cleanBaseName;

    let finalThumb = thumbUrl.trim();
    if (!finalThumb) {
      if (selectedType === 'Sala') {
        finalThumb = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=300&q=80';
      } else if (selectedType === 'Avatar') {
        finalThumb = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';
      } else {
        finalThumb = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=300&q=80';
      }
    }

    const blobUrl = URL.createObjectURL(file);
    let s3AssetId: string | undefined = undefined;

    // 1. O upload usa só POST /assets/upload/init, PUT na upload_url assinada e POST /complete.
    // Se o storage não estiver ativo, interrompe imediatamente e avisa o usuário.
    if (!storageHealth?.storage_configured) {
      setUploadError(
        `Supabase Storage (Protocolo S3) não configurado no servidor. Defina as variáveis no .env: ${(storageHealth?.missing_storage_env || []).join(', ')}`
      );
      return;
    }

    setIsUploadingToStorage(true);
    setUploadProgress(0);

    try {
      const cat = selectedType === 'Sala' ? 'room_mesh' : selectedType === 'Avatar' ? 'avatar' : 'accessory';
      const res = await uploadGlbDirect(
        file,
        cat,
        'user-default',
        undefined,
        (pct) => setUploadProgress(pct)
      );
      s3AssetId = res.asset_id;
    } catch (err: any) {
      // 4. Se o PUT não for 2xx (ou init/complete falharem), mostre na tela o status e o body. Não marque sucesso.
      const errorDetail = err?.message || 'Falha desconhecida no envio do arquivo 3D';
      console.error('Falha no upload para o storage:', errorDetail);
      setUploadError(errorDetail);
      setIsUploadingToStorage(false);
      return; // Interrompe imediatamente. Não marca sucesso.
    } finally {
      setIsUploadingToStorage(false);
    }

    const newItem: InventoryItem = {
      id: `inv-${Date.now()}`,
      assetId: s3AssetId,
      fileName: finalFileName,
      displayName: finalDisplayName,
      thumbUrl: finalThumb,
      type: selectedType,
      createdAt: 'Agora',
      isScenario: selectedType === 'Sala',
      fileBlobUrl: blobUrl,
      modelType: 'custom_glb',
    };

    // Guarantee persistence of the actual binary GLB in IndexedDB
    saveGlbFile(newItem.id, file);

    setUploadedItem(newItem);
    // Initialize publish fields
    setPublishName(newItem.displayName);
    setPublishThumb(newItem.thumbUrl);
    setPublishObjectType(
      newItem.type === 'Sala'
        ? 'sala'
        : newItem.type === 'Avatar'
        ? 'avatar'
        : 'item'
    );
  };

  const handleFinishSaveOnly = () => {
    if (!uploadedItem) return;
    onUploadSuccess(uploadedItem, null);
    setUploadedItem(null);
    setIsConfiguringPublish(false);
    onClose();
  };

  const handleFinishInsertNow = () => {
    if (!uploadedItem) return;
    const pointToUse =
      insertionPoint ? insertionPoint : ([0, 0, 0] as [number, number, number]);
    onUploadSuccess(uploadedItem, pointToUse);
    setUploadedItem(null);
    setIsConfiguringPublish(false);
    onClose();
  };

  const handleConfirmPublish = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!uploadedItem) return;

    const parsedTags = publishHashtags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => (t.startsWith('#') ? t : `#${t}`));

    const finalTags = parsedTags.length > 0 ? parsedTags : ['#comunidade', '#3d'];
    const finalPrice = publishMode === 'simples' ? 0 : Number(publishPrice) || 0;
    const finalThumb = publishThumb.trim() || uploadedItem.thumbUrl;
    const finalName = publishName.trim() || uploadedItem.displayName;

    await persistStoreItem(
      {
        name: finalName,
        objectType: publishObjectType,
        price: finalPrice,
        hashtags: finalTags,
        thumbnailUrl: finalThumb,
        rarity: publishMode === 'simples' ? 'COMUM' : publishRarity,
        publishMode: publishMode,
        description:
          publishDescription.trim() || `Item 3D criado por ${userDisplayName}.`,
        fileBlobUrl: uploadedItem.fileBlobUrl,
        author: userDisplayName,
      },
      null
    );

    if (onPublishToStore) {
      onPublishToStore({
        ...uploadedItem,
        displayName: finalName,
        thumbUrl: finalThumb,
      });
    }

    onUploadSuccess(uploadedItem, null);
    setUploadedItem(null);
    setIsConfiguringPublish(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 md:p-6 animate-fade-in font-sans">
      <div className="relative w-full max-w-3xl md:max-w-4xl bg-[#121317] border border-[#d4af37]/60 rounded-2xl p-6 md:p-8 shadow-[0_16px_50px_rgba(0,0,0,0.95)] text-[#e8d5b5]">
        {/* Header HUD: User / Coins / Close */}
        <div className="flex items-center justify-between pb-4 border-b border-[#d4af37]/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-[#d4af37]/80 flex items-center justify-center text-sm text-[#ffd700] bg-[#1a1c24]">
              👤
            </div>
            <span className="text-sm md:text-base font-bold text-[#e8d5b5]">
              {userDisplayName}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs md:text-sm font-semibold text-[#ffd700]">
              <span className="w-4 h-4 rounded-full border border-[#d4af37] flex items-center justify-center text-[10px]">
                $
              </span>
              <span>2.450</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs md:text-sm font-semibold text-purple-400">
              <span className="w-3.5 h-3.5 rotate-45 border border-purple-400" />
              <span>180</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (uploadedItem) {
                  onUploadSuccess(uploadedItem, null);
                }
                onClose();
              }}
              className="p-1.5 rounded-lg text-[#d4af37]/70 hover:text-[#ffd700] hover:bg-[#d4af37]/15 transition-colors cursor-pointer ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Title: ENVIAR ARQUIVO 3D */}
        <h1 className="text-lg md:text-xl font-extrabold tracking-wide text-[#ffd700] uppercase my-4">
          ENVIAR ARQUIVO 3D (GLB / GLTF)
        </h1>

        {uploadedItem ? (
          isConfiguringPublish ? (
            /* DUAL-MODE PUBLISH CONFIGURATION PANEL */
            <div className="py-4 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-[#d4af37]/30">
                <button
                  type="button"
                  onClick={() => setIsConfiguringPublish(false)}
                  className="flex items-center gap-1.5 text-xs text-[#d4af37] hover:text-[#ffd700] cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
                <div className="flex items-center gap-2 text-[#ffd700] font-bold text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  <span>Publicar na Loja (Persistência)</span>
                </div>
                <div className="w-12" />
              </div>

              {/* Mode Toggle: Simples vs Avançado */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-black/60 rounded-xl border border-[#d4af37]/30">
                <button
                  type="button"
                  onClick={() => setPublishMode('simples')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    publishMode === 'simples'
                      ? 'bg-gradient-to-r from-[#d4af37] to-[#ffd700] text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>⚡ Modo Simples</span>
                  <span className="text-[10px] opacity-75">(1 Clique)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPublishMode('avancado')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    publishMode === 'avancado'
                      ? 'bg-gradient-to-r from-[#d4af37] to-[#ffd700] text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>⚙️ Modo Avançado</span>
                  <span className="text-[10px] opacity-75">(Customizar)</span>
                </button>
              </div>

              <form onSubmit={handleConfirmPublish} className="space-y-4">
                {/* Nome */}
                <div>
                  <label className="block text-xs font-semibold text-[#e8d5b5] mb-1">
                    Nome do Item na Loja <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={publishName}
                    onChange={(e) => setPublishName(e.target.value)}
                    placeholder="Ex: Armadura Dourada, Poltrona Imperial"
                    className="w-full bg-[#1b1c24] border border-[#d4af37]/30 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-[#ffd700]"
                    required
                  />
                </div>

                {publishMode === 'simples' ? (
                  <div className="p-4 rounded-xl bg-[#1b1d24] border border-[#d4af37]/30 text-xs space-y-2">
                    <p className="text-zinc-200 text-xs leading-relaxed">
                      No <strong>Modo Simples</strong>, o item é publicado instantaneamente com valores automáticos: 
                      Preço <strong>0 moedas (Grátis)</strong>, hashtags <code>#comunidade</code> e <code>#3d</code>.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5 animate-fade-in">
                    {/* Tipo de Objeto */}
                    <div>
                      <label className="block text-xs font-semibold text-[#e8d5b5] mb-1">
                        Tipo de Objeto
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-[11px]">
                        {[
                          { type: 'avatar' as const, label: 'Avatar', icon: '👤' },
                          { type: 'item' as const, label: 'Item / Roupa', icon: '👔' },
                          { type: 'pose' as const, label: 'Pose', icon: '🧘' },
                          { type: 'sala' as const, label: 'Sala / Room', icon: '🏛️' },
                          { type: 'moveis' as const, label: 'Móveis', icon: '🛋️' },
                        ].map((t) => (
                          <button
                            key={t.type}
                            type="button"
                            onClick={() => setPublishObjectType(t.type)}
                            className={`py-2 px-1 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                              publishObjectType === t.type
                                ? 'bg-[#d4af37]/30 border-[#ffd700] text-[#ffd700] font-bold shadow-sm'
                                : 'bg-[#1b1c24] border-white/10 text-zinc-400 hover:text-white'
                            }`}
                          >
                            <span className="text-xs">{t.icon}</span>
                            <span className="truncate w-full">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preço */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-[#e8d5b5]">
                          Preço em Moedas (🪙)
                        </label>
                        <button
                          type="button"
                          onClick={() => setPublishPrice(0)}
                          className="text-[10px] text-[#ffd700] hover:underline cursor-pointer"
                        >
                          Tornar Grátis (0 moedas)
                        </button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={publishPrice}
                        onChange={(e) => setPublishPrice(Number(e.target.value))}
                        placeholder="0 para Grátis"
                        className="w-full bg-[#1b1c24] border border-[#d4af37]/30 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-[#ffd700]"
                      />
                    </div>

                    {/* Hashtags */}
                    <div>
                      <label className="block text-xs font-semibold text-[#e8d5b5] mb-1">
                        Hashtags (separadas por vírgula)
                      </label>
                      <input
                        type="text"
                        value={publishHashtags}
                        onChange={(e) => setPublishHashtags(e.target.value)}
                        placeholder="#formal, #noite, #luxo, #moveis"
                        className="w-full bg-[#1b1c24] border border-[#d4af37]/30 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-[#ffd700]"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {['#formal', '#noite', '#luxo', '#streetwear', '#moveis', '#decor', '#cyberpunk'].map(
                          (tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                if (!publishHashtags.includes(tag)) {
                                  setPublishHashtags((prev) =>
                                    prev ? `${prev}, ${tag}` : tag
                                  );
                                }
                              }}
                              className="px-2 py-0.5 rounded-md bg-[#222430] hover:bg-[#d4af37]/20 text-[10px] text-zinc-300 hover:text-[#ffd700] border border-white/5 transition-colors cursor-pointer"
                            >
                              + {tag}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Thumbnail / Capa */}
                    <CoverImagePicker
                      value={publishThumb || uploadedItem.thumbUrl}
                      onChange={setPublishThumb}
                      label="Thumbnail / Capa do Item na Loja"
                      defaultFallback={uploadedItem.thumbUrl}
                    />

                    {/* Raridade */}
                    <div>
                      <label className="block text-xs font-semibold text-[#e8d5b5] mb-1">
                        Raridade
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['COMUM', 'RARO', 'ÉLITE'] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setPublishRarity(r)}
                            className={`py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              publishRarity === r
                                ? 'bg-[#d4af37]/25 border-[#ffd700] text-[#ffd700]'
                                : 'bg-[#1b1c24] border-white/10 text-zinc-400'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Descrição */}
                    <div>
                      <label className="block text-xs font-semibold text-[#e8d5b5] mb-1">
                        Descrição (opcional)
                      </label>
                      <textarea
                        rows={2}
                        value={publishDescription}
                        onChange={(e) => setPublishDescription(e.target.value)}
                        placeholder="Detalhes sobre este modelo 3D..."
                        className="w-full bg-[#1b1c24] border border-[#d4af37]/30 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-[#ffd700] resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsConfiguringPublish(false)}
                    className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#ffd700] hover:from-[#e5bd38] hover:to-[#ffe033] text-black font-extrabold text-xs uppercase tracking-wide shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {publishMode === 'simples'
                        ? 'Publicar Agora (1 Clique)'
                        : 'Confirmar Publicação Avançada'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center space-y-5">
              <div className="w-16 h-16 rounded-full border-2 border-[#ffd700] bg-[#ffd700]/10 flex items-center justify-center text-[#ffd700] shadow-[0_0_25px_rgba(255,215,0,0.3)]">
                <Check className="w-9 h-9" />
              </div>

              <div className="text-center space-y-1">
                <p className="text-base font-extrabold text-[#ffd700] uppercase tracking-wider">
                  Upload concluído com sucesso!
                </p>
                <p className="text-sm text-[#e8d5b5]">
                  <strong className="text-white">"{uploadedItem.displayName}"</strong> foi adicionado ao seu inventário.
                </p>
                <p className="text-xs text-[#e8d5b5]/70 max-w-md mx-auto">
                  Você decide se deseja colocá-lo agora no ambiente 3D, publicá-lo na loja ou mantê-lo na sua biblioteca.
                </p>
              </div>

              {/* Action Buttons: Insert Now vs Publish to Store vs Keep in Library */}
              <div className="w-full max-w-md flex flex-col gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleFinishInsertNow}
                  className="w-full py-3 px-4 rounded-xl bg-[#ffd700] hover:bg-amber-300 active:scale-[0.99] text-black font-extrabold text-sm tracking-wide uppercase transition-all shadow-[0_4px_20px_rgba(255,215,0,0.35)] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>➕</span>
                  <span>
                    {uploadedItem.type === 'Sala'
                      ? 'Aplicar como Cenário 3D Agora'
                      : 'Inserir na Cena 3D Agora'}
                  </span>
                </button>

                {onPublishToStore && (
                  <button
                    type="button"
                    onClick={() => {
                      onUploadSuccess(uploadedItem, null);
                      onPublishToStore(uploadedItem);
                      setUploadedItem(null);
                      setIsConfiguringPublish(false);
                      onClose();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#d4af37]/30 to-[#ffd700]/30 hover:from-[#d4af37]/50 hover:to-[#ffd700]/50 border border-[#ffd700] text-[#ffd700] font-bold text-xs tracking-wide uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <Sparkles className="w-4 h-4 text-[#ffd700]" />
                    <span>Publicar na Loja & Vitrine</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleFinishSaveOnly}
                  className="w-full py-2.5 px-4 rounded-xl bg-black/40 hover:bg-black/60 border border-[#d4af37]/40 hover:border-[#ffd700] text-[#e8d5b5] font-semibold text-xs tracking-wide uppercase transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>📁</span>
                  <span>Guardar apenas no Inventário (Não Inserir)</span>
                </button>
              </div>
            </div>
          )
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Object Storage Status Banner */}
            {storageHealth && (
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                  storageHealth.storage_configured
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 flex-shrink-0" />
                  <div>
                    <span className="font-bold">
                      {storageHealth.storage_configured
                        ? `Object Storage S3/R2 Ativo (Bucket: ${storageHealth.bucket})`
                        : 'Object Storage S3/R2 aguardando variáveis no .env'}
                    </span>
                    {!storageHealth.storage_configured && (
                      <p className="text-[10px] text-amber-300/80 mt-0.5">
                        Defina: {storageHealth.missing_storage_env.join(', ')} para upload direto.
                      </p>
                    )}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-black/40 border border-current">
                  {storageHealth.storage_configured ? 'S3 Direct' : 'Local / IDB'}
                </span>
              </div>
            )}

            {uploadError && (
              <div className="p-4 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-xs flex flex-col gap-2 shadow-lg animate-fade-in">
                <div className="flex items-center gap-2 font-bold text-red-400 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
                  <span>Erro no Upload do Arquivo 3D</span>
                </div>
                <div className="font-mono bg-black/70 p-3 rounded-lg border border-red-900/60 break-all text-[11px] whitespace-pre-wrap max-h-48 overflow-y-auto text-red-300">
                  {uploadError}
                </div>
                <p className="text-[10px] text-red-400/80">
                  O arquivo não foi marcado como concluído pois o envio ao Storage não retornou status de sucesso (2xx).
                </p>
              </div>
            )}

            {/* Outer box with fine gold border */}
            <div className="border border-[#d4af37]/40 rounded-xl p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-black/50">
              {/* Left Side: Dotted Dropzone */}
              <div className="relative border-2 border-dashed border-[#d4af37]/60 rounded-xl p-6 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-[#d4af37]/10 transition-colors">
                <input
                  type="file"
                  accept=".glb,.gltf"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />

                {/* Wireframe Cube Icon */}
                <div className="mb-3 text-[#ffd700] group-hover:scale-105 transition-transform">
                  <Box className="w-14 h-14 stroke-[1.5]" />
                </div>

                <p className="text-sm font-bold text-[#ffd700] mb-2 px-2 break-all">
                  {file ? file.name : 'Solte o arquivo GLB aqui'}
                </p>

                <p className="text-xs text-[#e8d5b5]/70 mb-3">
                  {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'Clique para procurar em seu computador'}
                </p>

                <div className="px-4 py-2 rounded-lg border border-[#d4af37] text-[#ffd700] text-xs md:text-sm font-bold bg-[#14151a] group-hover:bg-[#d4af37] group-hover:text-black transition-colors flex items-center gap-2 shadow-sm">
                  <Upload className="w-4 h-4" />
                  <span>{file ? 'Trocar arquivo selecionado' : 'Selecionar arquivo do disco'}</span>
                </div>
              </div>

              {/* Right Side: Form Inputs */}
              <div className="space-y-4 flex flex-col justify-between">
                {/* Nome de exibição */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs md:text-sm font-bold text-[#ffd700] flex items-center gap-1.5">
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Nome do arquivo / Objeto na cena</span>
                    </label>
                    <span className="text-[10px] text-[#ffd700]/80 font-mono">
                      Personalizável
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ex: Sala Moderna, Mesa de Vidro, Personagem Avatar..."
                    className="w-full bg-[#181a22] border border-[#d4af37]/50 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-[#ffd700] placeholder:text-[#e8d5b5]/30 outline-none focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700]"
                  />
                  <span className="text-xs text-[#e8d5b5]/60 mt-1 block">
                    Defina como este modelo aparecerá no seu inventário e no mundo 3D.
                  </span>
                </div>

                {/* Imagem de capa */}
                <CoverImagePicker
                  value={thumbUrl}
                  onChange={setThumbUrl}
                  label="Imagem de Capa (Capa / Thumbnail)"
                  defaultFallback="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=300&q=80"
                />

                {/* Tipo Selector: [ Sala ] [ Avatar ] [ Item ] */}
                <div>
                  <label className="block text-xs md:text-sm font-bold text-[#ffd700] mb-1.5">
                    Tipo do produto 3D
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Sala', 'Avatar', 'Item'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedType(t)}
                        className={`py-2 text-xs md:text-sm font-bold rounded-lg border transition-all cursor-pointer ${
                          selectedType === t
                            ? 'bg-[#d4af37] text-black border-[#ffd700] shadow-md'
                            : 'border-[#d4af37]/40 text-[#e8d5b5]/80 hover:border-[#ffd700] bg-[#161820]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs text-[#d4af37]/80 mt-1.5 leading-relaxed">
                    {selectedType === 'Sala'
                      ? 'Sala: cenário 3D da room (paredes, arquitetura e piso).'
                      : selectedType === 'Avatar'
                      ? 'Avatar: modelo usado para o visitante interagir nos spots.'
                      : 'Item: móvel ou objeto inserível em qualquer ponto clicado na cena.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Submit Button */}
            <button
              type="submit"
              disabled={isUploadingToStorage}
              className="w-full py-3 rounded-xl bg-[#d4af37] hover:bg-[#e2bd44] active:scale-[0.99] text-black text-sm font-extrabold tracking-wider uppercase transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUploadingToStorage ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Enviando direto para S3/R2 ({uploadProgress}%)...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span>Enviar Arquivo 3D para o Inventário</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
