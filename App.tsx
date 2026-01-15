import React, { useState, useRef } from 'react';
import Scene from './components/Scene';
import Controls from './components/Controls';
import FeasibilityReport from './components/FeasibilityReport';
import TextureEditor from './components/TextureEditor';
import { PackagingState } from './types';
import { Sparkles, Edit3, Image as ImageIcon, X } from 'lucide-react';

const App: React.FC = () => {
  const [config, setConfig] = useState<PackagingState>({
    shape: 'mannequin',
    customModelUrl: null,
    color: '#ffffff',
    textureUrl: null,
    roughness: 0.7,
    metalness: 0,
    scale: [1, 1, 1],
    dimensions: {
      length: 20,
      width: 15,
      height: 15,
    },
    textureOffset: [0, 0],
    textureRepeat: [1, 1],
    textureRotation: 0,
  });

  const [activeModal, setActiveModal] = useState<'none' | 'report' | 'editor'>('none');
  const [editorInitialImage, setEditorInitialImage] = useState<string | null>(null);
  const [showInteractionPrompt, setShowInteractionPrompt] = useState(false);

  const handleConfigChange = (newConfig: Partial<PackagingState>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
  };

  const handleOpenEditor = (imageUrl: string | null) => {
    // If specific image passed (e.g. from upload), use it.
    // Otherwise, try to load the current existing texture on the model.
    setEditorInitialImage(imageUrl || config.textureUrl);
    setActiveModal('editor');
  };

  const handleSaveTexture = (newTextureUrl: string) => {
    setConfig(prev => ({
      ...prev,
      textureUrl: newTextureUrl,
      textureOffset: [0, 0],
      textureRepeat: [1, 1],
      textureRotation: 0,
    }));
  };

  // Handler when user clicks on the 3D model
  const handleModelClick = () => {
    setShowInteractionPrompt(true);
  };

  const handleConfirmDesign = () => {
    setShowInteractionPrompt(false);
    handleOpenEditor(null);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f3f4f6] text-gray-900 font-sans">
      {/* Sidebar Controls - White background */}
      <div className="flex-none z-10 shadow-lg relative bg-white border-r border-gray-200">
        <Controls
          config={config}
          onChange={handleConfigChange}
          onOpenFeasibility={() => setActiveModal('report')}
          onOpenEditor={handleOpenEditor}
        />
      </div>

      {/* Main 3D Viewport - Light Gray background */}
      <div className="flex-1 relative bg-[#f3f4f6]">
        <Scene config={config} onModelClick={handleModelClick} />
      </div>

      {/* Modals */}
      <FeasibilityReport
        isOpen={activeModal === 'report'}
        onClose={() => setActiveModal('none')}
      />

      <TextureEditor
        isOpen={activeModal === 'editor'}
        onClose={() => setActiveModal('none')}
        onSave={handleSaveTexture}
        initialImage={editorInitialImage}
        config={config}
      />

      {/* 3D -> 2D Intermediate Interaction Prompt */}
      {showInteractionPrompt && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-white/50 w-96 max-w-[90vw] flex flex-col items-center gap-5 transform animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 shadow-inner">
              <Sparkles size={32} />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-gray-900">进入 2D 设计模式</h3>
              <p className="text-sm text-gray-500 leading-relaxed px-4">
                点击下方按钮进入编辑器。进入后，您可以<span className="text-brand-600 font-bold">上传 Logo 或图片</span>来定制您的专属模型。
              </p>
            </div>

            <div className="w-full space-y-3 mt-2">
              <button
                onClick={handleConfirmDesign}
                className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold shadow-xl shadow-brand-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <Edit3 size={18} />
                确认并开始设计
              </button>

              <button
                onClick={() => setShowInteractionPrompt(false)}
                className="w-full py-3 text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;