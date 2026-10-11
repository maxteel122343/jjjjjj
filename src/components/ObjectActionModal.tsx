import React, { useState, useEffect } from 'react';
import {
  X,
  Activity,
  Play,
  Square,
  Plus,
  Trash2,
  Edit3,
  Check,
  RotateCw,
  Sparkles,
  Repeat,
  Compass,
  ArrowRight,
  Sliders,
  Box,
} from 'lucide-react';
import {
  ActionSpeedKeyframe,
  PlacedObject,
  ObjectAction,
  SpotMotionConfig,
  MotionCurveTrajectory,
} from '../types';
import { ActionSpeedProfileFields } from './ActionSpeedProfileFields';

interface ObjectActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetObject: PlacedObject | null;
  allObjects: PlacedObject[];
  onSelectObject: (id: string) => void;
  onUpdateObjectActions: (objectId: string, actions: ObjectAction[]) => void;
  onToggleTestAction?: (objectId: string, actionId: string | null) => void;
  testingActionId?: string | null;
  onShowToast: (msg: string) => void;
}

export const ObjectActionModal: React.FC<ObjectActionModalProps> = ({
  isOpen,
  onClose,
  targetObject,
  allObjects,
  onSelectObject,
  onUpdateObjectActions,
  onToggleTestAction,
  testingActionId,
  onShowToast,
}) => {
  const [selectedObjId, setSelectedObjId] = useState<string>(targetObject?.id || '');
  const [isEditingOrCreating, setIsEditingOrCreating] = useState(false);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);

  // Form states
  const [actionName, setActionName] = useState('');
  const [trajectory, setTrajectory] = useState<MotionCurveTrajectory>('linear');
  const [deltaPos, setDeltaPos] = useState<[number, number, number]>([0, 0, 2.0]);
  const [deltaRot, setDeltaRot] = useState<[number, number, number]>([0, 360, 0]);
  const [turnAngle, setTurnAngle] = useState<number>(360);
  const [curveRadius, setCurveRadius] = useState<number>(2.0);
  const [curveHeight, setCurveHeight] = useState<number>(1.5);
  const [speed, setSpeed] = useState<number>(1.0);
  const [loop, setLoop] = useState<boolean>(true);
  const [duration, setDuration] = useState('');
  const [speedProfile, setSpeedProfile] = useState<ActionSpeedKeyframe[]>([]);

  useEffect(() => {
    if (targetObject) {
      setSelectedObjId(targetObject.id);
    } else if (allObjects.length > 0 && !selectedObjId) {
      setSelectedObjId(allObjects[0].id);
    }
  }, [targetObject, allObjects]);

  if (!isOpen) return null;

  const currentObj = allObjects.find((o) => o.id === selectedObjId) || targetObject;
  const currentActions: ObjectAction[] = currentObj?.actions || [];

  const handleApplyPreset = (presetType: string) => {
    setSpeedProfile([]);
    switch (presetType) {
      case 'girar_360':
        setActionName('Girar 360°');
        setTrajectory('circle_turn');
        setDeltaPos([0, 0, 0]);
        setDeltaRot([0, 360, 0]);
        setTurnAngle(360);
        setCurveRadius(0.01);
        setSpeed(1.0);
        setLoop(true);
        break;
      case 'frente_tras':
        setActionName('Ir Frente e Trás (+2.5m)');
        setTrajectory('linear');
        setDeltaPos([0, 0, 2.5]);
        setDeltaRot([0, 0, 0]);
        setSpeed(1.0);
        setLoop(true);
        break;
      case 'lateral':
        setActionName('Balanço Lateral (+2.0m)');
        setTrajectory('linear');
        setDeltaPos([2.0, 0, 0]);
        setDeltaRot([0, 0, 0]);
        setSpeed(1.0);
        setLoop(true);
        break;
      case 'elevador':
        setActionName('Elevador Subir (+2.5m)');
        setTrajectory('linear');
        setDeltaPos([0, 2.5, 0]);
        setDeltaRot([0, 0, 0]);
        setSpeed(1.0);
        setLoop(true);
        break;
      case 'arco':
        setActionName('Salto em Arco');
        setTrajectory('arc');
        setDeltaPos([0, 0, 3.0]);
        setCurveHeight(2.0);
        setSpeed(1.2);
        setLoop(true);
        break;
      case 'onda':
        setActionName('Flutuação Suave');
        setTrajectory('wave');
        setDeltaPos([0, 0.4, 0]);
        setSpeed(0.8);
        setLoop(true);
        break;
      case 'espiral':
        setActionName('Subir em Espiral');
        setTrajectory('spiral');
        setDeltaPos([0, 3.0, 0]);
        setTurnAngle(360);
        setCurveRadius(1.5);
        setSpeed(1.0);
        setLoop(true);
        break;
      default:
        break;
    }
  };

  const handleStartCreate = () => {
    setEditingActionId(null);
    setActionName(`Action ${currentActions.length + 1}`);
    setTrajectory('linear');
    setDeltaPos([0, 0, 2.0]);
    setDeltaRot([0, 0, 0]);
    setTurnAngle(360);
    setCurveRadius(2.0);
    setCurveHeight(1.5);
    setSpeed(1.0);
    setLoop(true);
    setDuration('');
    setSpeedProfile([]);
    setIsEditingOrCreating(true);
  };

  const handleStartEdit = (act: ObjectAction) => {
    setEditingActionId(act.id);
    setActionName(act.name);
    setTrajectory(act.motion.curveTrajectory || 'linear');
    setDeltaPos(act.motion.deltaPosition || [0, 0, 2.0]);
    setDeltaRot(act.motion.deltaRotation || [0, 0, 0]);
    setTurnAngle(act.motion.turnAngle !== undefined ? act.motion.turnAngle : 360);
    setCurveRadius(act.motion.curveRadius !== undefined ? act.motion.curveRadius : 2.0);
    setCurveHeight(act.motion.curveHeight !== undefined ? act.motion.curveHeight : 1.5);
    setSpeed(act.motion.speed || 1.0);
    setLoop(act.motion.loop !== false);
    setDuration(act.motion.durationSeconds?.toString() || '');
    setSpeedProfile(act.motion.speedProfile || []);
    setIsEditingOrCreating(true);
  };

  const handleSaveAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentObj) return;

    const trimmedName = actionName.trim() || `Action ${currentActions.length + 1}`;
    const motionConfig: SpotMotionConfig = {
      enabled: true,
      deltaPosition: deltaPos,
      deltaRotation: deltaRot,
      turnAngle,
      curveTrajectory: trajectory,
      curveRadius,
      curveHeight,
      speed,
      ...(speedProfile.length ? { speedProfile } : {}),
      loop,
      ...(duration.trim() && Number.isFinite(Number(duration)) && Number(duration) > 0
        ? { durationSeconds: Number(duration) }
        : {}),
      target: 'parent_object',
    };

    let updatedActions: ObjectAction[];
    if (editingActionId) {
      updatedActions = currentActions.map((a) =>
        a.id === editingActionId ? { ...a, name: trimmedName, motion: motionConfig } : a
      );
      onShowToast(`Action "${trimmedName}" atualizada com sucesso!`);
    } else {
      const newAct: ObjectAction = {
        id: `act-${Date.now()}`,
        name: trimmedName,
        motion: motionConfig,
      };
      updatedActions = [...currentActions, newAct];
      onShowToast(`Nova Action "${trimmedName}" criada no objeto "${currentObj.name}"!`);
    }

    onUpdateObjectActions(currentObj.id, updatedActions);
    setIsEditingOrCreating(false);
    setEditingActionId(null);
  };

  const handleRemoveAction = (actionId: string) => {
    if (!currentObj) return;
    const act = currentActions.find((a) => a.id === actionId);
    const updated = currentActions.filter((a) => a.id !== actionId);
    onUpdateObjectActions(currentObj.id, updated);
    if (testingActionId === actionId && onToggleTestAction) {
      onToggleTestAction(currentObj.id, null);
    }
    onShowToast(`Action "${act?.name || 'Action'}" removida do objeto.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in font-sans">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-[#121317] border border-[#d4af37]/60 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] text-[#e8d5b5] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#d4af37]/30 bg-[#171922]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-300">
              <Activity className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#ffd700] tracking-wide flex items-center gap-2">
                CRIAR & GERENCIAR ACTIONS DO OBJETO
              </h2>
              <p className="text-xs text-[#e8d5b5]/70">
                Adicione comportamentos, movimentos e trajetórias em tempo real para qualquer objeto 3D.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#d4af37]/60 hover:text-[#ffd700] hover:bg-[#d4af37]/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Object Selector Bar */}
        <div className="px-6 py-3 bg-[#151720] border-b border-[#d4af37]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#ffd700] uppercase tracking-wider flex items-center gap-1.5">
              <Box className="w-4 h-4 text-amber-400" />
              Objeto Selecionado:
            </span>
            <select
              value={selectedObjId}
              onChange={(e) => {
                setSelectedObjId(e.target.value);
                onSelectObject(e.target.value);
                setIsEditingOrCreating(false);
              }}
              className="bg-[#0e0f14] border border-[#d4af37]/40 rounded-lg px-3 py-1.5 text-xs text-[#ffd700] font-semibold outline-none focus:border-[#ffd700]"
            >
              {allObjects.map((obj) => (
                <option key={obj.id} value={obj.id}>
                  {obj.name} ({obj.type.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-mono">
              {currentActions.length} action(s) configurada(s)
            </span>
            {!isEditingOrCreating && (
              <button
                type="button"
                onClick={handleStartCreate}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#ffd700] hover:brightness-110 text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Nova Action</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isEditingOrCreating ? (
            /* Creation / Edit Form */
            <form onSubmit={handleSaveAction} className="space-y-4 p-4 rounded-xl border border-[#d4af37]/50 bg-black/50">
              <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
                <span className="text-sm font-bold text-[#ffd700] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#ffd700]" />
                  {editingActionId ? 'Editar Action Existente' : 'Criar Nova Action no Objeto'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingOrCreating(false)}
                  className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800"
                >
                  Cancelar
                </button>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="text-[11px] font-bold text-amber-300 block mb-1.5">
                  ⚡ Predefinições Rápidas (1-Clique para Preencher):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('girar_360')}
                    className="p-2 rounded-lg bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/40 text-left text-xs text-amber-200 transition-colors"
                  >
                    🔄 Girar 360°
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('frente_tras')}
                    className="p-2 rounded-lg bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/40 text-left text-xs text-cyan-300 transition-colors"
                  >
                    ⏩ Frente e Trás
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('lateral')}
                    className="p-2 rounded-lg bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/40 text-left text-xs text-emerald-300 transition-colors"
                  >
                    ↔️ Balanço Lateral
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('elevador')}
                    className="p-2 rounded-lg bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/40 text-left text-xs text-yellow-300 transition-colors"
                  >
                    🛗 Elevador / Subir
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('arco')}
                    className="p-2 rounded-lg bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/40 text-left text-xs text-purple-300 transition-colors"
                  >
                    🎢 Salto em Arco
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('onda')}
                    className="p-2 rounded-lg bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/40 text-left text-xs text-teal-300 transition-colors"
                  >
                    〰️ Flutuação Onda
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('espiral')}
                    className="p-2 rounded-lg bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/40 text-left text-xs text-rose-300 transition-colors"
                  >
                    🚀 Subir em Espiral
                  </button>
                </div>
              </div>

              {/* Action Name & Trajectory */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                    Nome da Action:
                  </label>
                  <input
                    type="text"
                    required
                    value={actionName}
                    onChange={(e) => setActionName(e.target.value)}
                    placeholder="Ex: Girar 360°, Deslizar, Pular..."
                    className="w-full bg-[#161820] border border-[#d4af37]/40 rounded-lg px-3 py-2 text-xs text-[#ffd700] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                    Tipo de Trajetória / Curva:
                  </label>
                  <select
                    value={trajectory}
                    onChange={(e) => setTrajectory(e.target.value as any)}
                    className="w-full bg-[#161820] border border-[#d4af37]/40 rounded-lg px-3 py-2 text-xs text-[#ffd700] outline-none"
                  >
                    <option value="linear">📏 Reta Direta (Linear)</option>
                    <option value="circle_turn">🔄 Volta Circular (Curva em Raio)</option>
                    <option value="spiral">🚀 Subir em Espiral</option>
                    <option value="arc">🎢 Curva em Arco (Salto Parabólico)</option>
                    <option value="wave">〰️ Ondulação / Senoide (Flutuação)</option>
                  </select>
                </div>
              </div>

              {/* Directional Deltas */}
              <div className="pt-2">
                <label className="text-[11px] font-bold text-cyan-300 block mb-1">
                  Deslocamento 3D em Metros (a partir da posição original do objeto):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Frente/Trás (Z):</span>
                    <input
                      type="number"
                      step="0.01"
                      value={deltaPos[2]}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setDeltaPos([deltaPos[0], deltaPos[1], val]);
                      }}
                      className="w-full bg-[#161820] border border-cyan-400/50 rounded-lg px-2 py-1.5 text-xs text-cyan-300 font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Direita/Esquerda (X):</span>
                    <input
                      type="number"
                      step="0.01"
                      value={deltaPos[0]}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setDeltaPos([val, deltaPos[1], deltaPos[2]]);
                      }}
                      className="w-full bg-[#161820] border border-[#d4af37]/40 rounded-lg px-2 py-1.5 text-xs text-[#ffd700]"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Elevador / Altura (Y):</span>
                    <input
                      type="number"
                      step="0.01"
                      value={deltaPos[1]}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setDeltaPos([deltaPos[0], val, deltaPos[2]]);
                      }}
                      className="w-full bg-[#161820] border border-[#d4af37]/40 rounded-lg px-2 py-1.5 text-xs text-[#ffd700]"
                    />
                  </div>
                </div>
              </div>

              {/* Speed & Loop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                    Velocidade base: {speed.toFixed(2)}x
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      value={speed}
                      onChange={(e) => setSpeed(Math.max(0.01, Number(e.target.value) || 0.01))}
                      className="w-20 rounded border border-[#d4af37]/40 bg-[#161820] px-2 py-1 text-right text-xs text-[#ffd700]"
                      aria-label="Velocidade base da Action"
                    />
                    <span className="text-xs text-zinc-400">x</span>
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="100"
                    step="0.01"
                    value={Math.min(speed, 20)}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-full accent-[#ffd700]"
                    aria-label="Ajustar velocidade base"
                  />
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-200">
                    <input
                      type="checkbox"
                      checked={loop}
                      onChange={(e) => setLoop(e.target.checked)}
                      className="w-4 h-4 accent-[#ffd700]"
                    />
                    <span>Repetição Contínua (Loop Vai e Vem)</span>
                  </label>
                </div>
              </div>
              <ActionSpeedProfileFields
                value={speedProfile}
                baseSpeed={speed}
                onChange={setSpeedProfile}
              />
              <div>
                <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                  Duração (segundos):
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="Indefinida"
                  className="w-full bg-[#161820] border border-[#d4af37]/40 rounded-lg px-3 py-2 text-xs text-[#ffd700] outline-none"
                />
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#d4af37]/20">
                <button
                  type="button"
                  onClick={() => setIsEditingOrCreating(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#ffd700] hover:brightness-110 text-black text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Action no Objeto</span>
                </button>
              </div>
            </form>
          ) : currentActions.length === 0 ? (
            /* Empty state */
            <div className="p-8 rounded-xl border border-dashed border-[#d4af37]/40 bg-black/30 text-center space-y-3">
              <Activity className="w-12 h-12 text-[#d4af37]/50 mx-auto" />
              <h3 className="text-sm font-bold text-[#ffd700]">
                Nenhuma action configurada para "{currentObj?.name}"
              </h3>
              <p className="text-xs text-[#e8d5b5]/70 max-w-md mx-auto">
                Actions permitem que qualquer objeto gire, ande, suba em elevador ou execute trajetórias
                quando ativado por você ou visto na Loja/Vitrine!
              </p>
              <button
                type="button"
                onClick={handleStartCreate}
                className="px-4 py-2 rounded-lg bg-[#ffd700] text-black text-xs font-bold hover:brightness-110 cursor-pointer inline-flex items-center gap-1.5 shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Primeira Action</span>
              </button>
            </div>
          ) : (
            /* Actions List */
            <div className="space-y-3">
              {currentActions.map((act) => {
                const isTesting = testingActionId === act.id;
                return (
                  <div
                    key={act.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isTesting
                        ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_15px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400'
                        : 'border-[#d4af37]/35 bg-[#161822] hover:border-[#d4af37]'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white flex items-center gap-1.5">
                          <span className="text-cyan-400">⚡</span>
                          {act.name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#ffd700]/15 text-[#ffd700] border border-[#ffd700]/40">
                          {act.motion.curveTrajectory?.toUpperCase() || 'LINEAR'}
                        </span>
                        {isTesting && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-400 text-black animate-pulse">
                            ▶ Executando em Tempo Real
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 font-mono">
                        Deslocamento: [X: {act.motion.deltaPosition[0]}m, Y: {act.motion.deltaPosition[1]}m, Z: {act.motion.deltaPosition[2]}m] · Velocidade: {act.motion.speed || 1}x · Loop: {act.motion.loop ? 'Sim' : 'Não'} · Duração: {act.motion.durationSeconds !== undefined ? `${act.motion.durationSeconds}s` : 'Indefinida'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Play / Stop Test Button */}
                      {onToggleTestAction && currentObj && (
                        <button
                          type="button"
                          onClick={() => onToggleTestAction(currentObj.id, isTesting ? null : act.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                            isTesting
                              ? 'bg-cyan-400 text-black ring-2 ring-cyan-200 animate-pulse'
                              : 'bg-cyan-700 hover:bg-cyan-600 text-white'
                          }`}
                          title={isTesting ? 'Parar execução da Action' : 'Executar e testar esta Action na cena 3D'}
                        >
                          {isTesting ? (
                            <>
                              <Square className="w-3.5 h-3.5 fill-black" />
                              <span>Parar</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-white" />
                              <span>Executar / Testar</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(act)}
                        className="p-2 rounded-lg bg-zinc-800 hover:bg-[#d4af37] text-zinc-300 hover:text-black transition-colors cursor-pointer"
                        title="Editar esta action"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveAction(act.id)}
                        className="p-2 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-400 hover:text-white transition-colors cursor-pointer border border-red-500/40"
                        title="Remover esta action"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#171922] border-t border-[#d4af37]/30 flex items-center justify-between text-xs text-[#e8d5b5]/70">
          <span>
            As actions criadas permanecem salvas no objeto e serão exibidas na Loja/Vitrine ao publicar.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#d4af37] text-black font-bold hover:brightness-110 cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
