import React, { useState, useRef, useEffect, useMemo } from 'react';
import { PackagingState, ShapeType } from '../types';
import { Box, Circle, Cylinder, Loader2, Sparkles, AlertCircle, FileText, CheckCircle2, Upload, Package, PackagePlus, Ruler, Palette, Shirt, BoxSelect, Edit3, Trash2, Database } from 'lucide-react';
import { generateTexture } from '../services/geminiService';
import { saveModelToLibrary, getModelLibrary, getModelBlob, deleteModelFromLibrary, ModelMetadata } from '../services/storageService';

interface ControlsProps {
  config: PackagingState;
  onChange: (newConfig: Partial<PackagingState>) => void;
  onOpenFeasibility: () => void;
  onOpenEditor: (img: string | null) => void;
}

// Static definition outside component to prevent re-allocation
const SHAPES: { id: ShapeType; label: string; icon: React.ReactNode }[] = [
  { id: 'box', label: '标准箱', icon: <Box size={18} /> },
  { id: 'mailer', label: '飞机盒', icon: <Package size={18} /> },
  { id: 'tuck', label: '管式盒', icon: <PackagePlus size={18} /> },
  { id: 'bottle', label: '瓶身', icon: <Circle size={18} /> },
  { id: 'can', label: '易拉罐', icon: <Cylinder size={18} /> },
  { id: 'mannequin', label: '模特', icon: <Shirt size={18} /> },
];

const Controls: React.FC<ControlsProps> = ({ config, onChange, onOpenFeasibility, onOpenEditor }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Model Library State
  const [savedModels, setSavedModels] = useState<ModelMetadata[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const imgInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  // Load models on mount
  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    setIsLoadingModels(true);
    try {
      const models = await getModelLibrary();
      setSavedModels(models);
    } catch (e) {
      console.error("Failed to load model library", e);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const textureData = await generateTexture(prompt);
      if (textureData) {
        onOpenEditor(textureData);
      } else {
        setError('生成失败，请重试');
      }
    } catch (e) {
      setError('API请求错误');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          onOpenEditor(result);
          if (imgInputRef.current) imgInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleModelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        // 1. Save to DB
        const savedMeta = await saveModelToLibrary(file);

        // 2. Refresh List
        setSavedModels(prev => [savedMeta, ...prev]);

        // 3. Set Active
        const url = URL.createObjectURL(file);
        onChange({
          shape: 'custom',
          customModelUrl: url
        });

        // Reset input
        if (modelInputRef.current) modelInputRef.current.value = '';

      } catch (e) {
        console.error("Failed to save model", e);
        // Fallback if DB fails: just show it temporarily
        const url = URL.createObjectURL(file);
        onChange({ shape: 'custom', customModelUrl: url });
      }
    }
  };

  const handleSelectSavedModel = async (id: string) => {
    try {
      const blob = await getModelBlob(id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        onChange({
          shape: 'custom',
          customModelUrl: url
        });
      }
    } catch (e) {
      console.error("Failed to load saved model", e);
    }
  };

  const handleDeleteModel = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要从库中删除此模型吗？')) {
      await deleteModelFromLibrary(id);
      setSavedModels(prev => prev.filter(m => m.id !== id));
    }
  };

  const applyMaterial = (type: 'white' | 'kraft' | 'glossy') => {
    switch (type) {
      case 'white':
        onChange({ color: '#ffffff', roughness: 0.5, metalness: 0, textureUrl: null });
        break;
      case 'kraft':
        onChange({ color: '#e3c099', roughness: 0.9, metalness: 0, textureUrl: null });
        break;
      case 'glossy':
        onChange({ color: '#ffffff', roughness: 0.1, metalness: 0.1, textureUrl: null });
        break;
    }
  };

  return (
    <div className="w-80 h-full bg-white border-r border-gray-200 flex flex-col overflow-y-auto text-sm text-gray-700">

      {/* Header */}
      <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-10">
        <h1 className="font-extrabold text-gray-900 text-xl tracking-tight flex items-center gap-1">
          PACDORA <span className="text-brand-600 text-xs font-normal border border-brand-200 px-1 rounded">Lite</span>
        </h1>
        <button
          onClick={onOpenFeasibility}
          className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-brand-600 transition-colors"
          title="查看可行性报告"
        >
          <FileText size={18} />
        </button>
      </div>

      <div className="p-5 space-y-8">

        {/* Shape Selection */}
        <section>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            1. 选择模型 (Model)
          </label>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {SHAPES.map((shape) => (
              <button
                key={shape.id}
                onClick={() => onChange({ shape: shape.id })}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all shadow-sm ${config.shape === shape.id
                  ? 'bg-brand-50 border-brand-500 text-brand-700 font-medium'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
              >
                <div className="mb-2 text-current opacity-80">{shape.icon}</div>
                <span className="text-xs">{shape.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => modelInputRef.current?.click()}
            className={`w-full py-2.5 border border-dashed rounded-lg flex items-center justify-center gap-2 transition-all text-xs font-medium mb-4 ${config.shape === 'custom'
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-gray-300 text-gray-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50/50'
              }`}
          >
            <Upload size={16} />
            {config.customModelUrl ? '上传新模型 (GLB)' : '上传自定义模型 (GLB)'}
          </button>
          <input
            type="file"
            ref={modelInputRef}
            onChange={handleModelUpload}
            accept=".glb,.gltf"
            className="hidden"
          />

          {/* Saved Models Library */}
          {savedModels.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-gray-400">
                <Database size={10} />
                我的模型库
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {savedModels.map(model => (
                  <div
                    key={model.id}
                    onClick={() => handleSelectSavedModel(model.id)}
                    className={`group flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${config.shape === 'custom' && config.customModelUrl?.includes('blob') // Simple heuristic, ideally compare IDs
                      ? 'border-brand-200 bg-brand-50'
                      : 'border-gray-100 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <BoxSelect size={14} className="text-gray-400 shrink-0" />
                      <span className="text-xs truncate text-gray-700 max-w-[140px]" title={model.name}>{model.name}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteModel(e, model.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Material Properties */}
        <section>
          <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            <Palette size={14} />
            2. 材质与图案 (Design)
          </label>

          {/* Color & Base Material */}
          <div className="space-y-4 mb-5">
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-600">底色 (Base Color)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-200 shadow-sm">
                  <input
                    type="color"
                    value={config.color}
                    onChange={(e) => onChange({ color: e.target.value })}
                    className="absolute -top-2 -left-2 w-12 h-12 p-0 border-0 cursor-pointer"
                  />
                </div>
                <span className="text-xs text-gray-400 font-mono">{config.color}</span>
              </div>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => applyMaterial('white')} className="py-1.5 px-2 text-xs font-medium rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-sm">白棉布</button>
              <button onClick={() => applyMaterial('kraft')} className="py-1.5 px-2 text-xs font-medium rounded border border-[#e3c099]/50 bg-[#e3c099]/10 hover:bg-[#e3c099]/20 text-[#b08d66]">黄麻布</button>
              <button onClick={() => applyMaterial('glossy')} className="py-1.5 px-2 text-xs font-medium rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-sm">丝绸</button>
            </div>
          </div>

          <div className="space-y-3 border-t border-gray-100 pt-5">

            {/* Main Action Buttons */}
            <div className="flex flex-col gap-3">
              {/* Upload */}
              <button
                onClick={() => imgInputRef.current?.click()}
                className="w-full py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md"
              >
                <Upload size={16} className="text-brand-600" />
                上传 Logo / 图案
              </button>

              {/* Edit Existing */}
              {config.textureUrl && (
                <button
                  onClick={() => onOpenEditor(null)}
                  className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white border border-transparent rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-brand-500/20"
                >
                  <Edit3 size={16} />
                  调整当前设计 (2D Editor)
                </button>
              )}

              <input type="file" ref={imgInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
            </div>

            {/* AI Generation */}
            <div className="bg-gradient-to-br from-purple-50 to-white p-4 rounded-xl border border-purple-100 mt-6 shadow-inner">
              <label className="flex items-center gap-2 text-xs font-bold text-purple-600 uppercase tracking-wider mb-2">
                <Sparkles size={14} />
                AI 创意生成
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="例如: 极简主义线条, 赛博朋克风格"
                className="w-full bg-white border border-purple-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none h-16 placeholder-gray-400 mb-3 text-gray-700"
              />
              <button
                disabled={isGenerating}
                onClick={() => {
                  if (prompt) handleGenerate();
                  else setPrompt('Cool pattern');
                }}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                {isGenerating ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                生成并应用
              </button>
              {error && <span className="text-red-500 text-[10px] mt-2 block font-medium">{error}</span>}
            </div>

          </div>
        </section>

        <div className="text-[10px] text-gray-400 pt-4 border-t border-gray-100 flex justify-center">
          Powered by Gemini & Three.js
        </div>

      </div>
    </div>
  );
};

export default Controls;