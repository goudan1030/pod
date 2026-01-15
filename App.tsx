import React, { useState, useRef } from 'react';
import Scene from './components/Scene';
import Controls from './components/Controls';
import FeasibilityReport from './components/FeasibilityReport';
import TextureEditor from './components/TextureEditor';
import { PackagingState } from './types';

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
  // DIRECTLY OPEN EDITOR now, instead of prompting for upload
  const handleModelClick = () => {
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
    </div>
  );
};

export default App;