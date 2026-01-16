import React, { useState } from 'react';
import Scene from './Scene';
import Controls from './Controls';
import FeasibilityReport from './FeasibilityReport';
import TextureEditor from './TextureEditor';
import HomeLayout from './Home/HomeLayout';
import { PackagingState, ModelItem } from '../types';
import { Sparkles, ArrowLeft, Loader2 } from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const Designer: React.FC = () => {
    // View State: 'home' or 'editor'
    // Note: ideally this should sync with URL, but for now keeping internal state to minimize regression
    // for the existing "Designer" flow.
    const [currentView, setCurrentView] = useState<'home' | 'editor'>('home');

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

    const handleModelClick = () => {
        setShowInteractionPrompt(true);
    };

    const handleConfirmDesign = () => {
        setShowInteractionPrompt(false);
        handleOpenEditor(null);
    };

    // Loading State
    const [isLoading, setIsLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);

    // --- New Handler for Home Selection with Loading & SVG Extraction ---
    const handleModelSelect = async (model: ModelItem) => {
        // 1. Immediate UI Switch: Go to Editor, Show Loading
        setIsLoading(true);
        setLoadingProgress(10);

        // Initial basic config to render the scene (even if SVG paths aren't ready)
        const initialConfig: PackagingState = {
            ...config, // Keep defaults
            ...model.config,
            shape: 'custom',
            textureUrl: null,
            customModelUrl: model.file,
            category: model.config.category,
        };

        setConfig(initialConfig);
        setCurrentView('editor');

        // 2. Start Minimum Delay Timer (e.g. 2 seconds)
        const minDelayPromise = new Promise(resolve => setTimeout(resolve, 2000));

        // 3. Heavy Lifting: Load GLB & Extract
        const extractionPromise = (async () => {
            try {
                if (!model.file) return {};

                console.log(`[Designer] Loading model: ${model.file}`);
                setLoadingProgress(30);

                const loader = new GLTFLoader();
                const gltf = await loader.loadAsync(model.file, (e) => {
                    // Optional: finer progress updates
                });

                console.log(`[Designer] Model loaded. Extracting SVG paths...`);
                setLoadingProgress(70);

                const { extractSVGPathFromMesh } = await import('../utils/uvPipeline');
                const extractedPaths: Record<string, { d: string, w: number, h: number }> = {};

                gltf.scene.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        const svgInfo = extractSVGPathFromMesh(child);
                        if (svgInfo) {
                            extractedPaths[child.name] = {
                                d: svgInfo.d,
                                w: svgInfo.width,
                                h: svgInfo.height
                            };
                        }
                    }
                });

                return extractedPaths;
            } catch (err) {
                console.error("Error loading model:", err);
                return {};
            }
        })();

        const [_, paths] = await Promise.all([minDelayPromise, extractionPromise]);

        setLoadingProgress(100);
        if (Object.keys(paths).length > 0) {
            setConfig(prev => ({
                ...prev,
                dynamicSVGPaths: paths
            }));
        }

        setIsLoading(false);
    };

    const handleBackToHome = () => {
        setCurrentView('home');
        setActiveModal('none');
        setShowInteractionPrompt(false);
    };

    // --- Render View: Home ---
    if (currentView === 'home') {
        return <HomeLayout onSelectModel={handleModelSelect} />;
    }

    // --- Render View: Editor ---
    return (
        <div className="flex h-screen w-screen overflow-hidden bg-[#f3f4f6] text-gray-900 font-sans">
            {/* Back Button (Overlay or inside Sidebar) */}
            <div className="absolute top-4 left-4 z-50">
                <button
                    onClick={handleBackToHome}
                    className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-lg border border-gray-100 text-gray-700 hover:text-brand-600 hover:border-brand-100 transition-all font-medium text-sm"
                >
                    <ArrowLeft size={16} />
                    Back to Models
                </button>
            </div>

            {/* Sidebar Controls - White background */}
            <div className="flex-none z-10 shadow-lg relative bg-white border-r border-gray-200 mt-16 lg:mt-0 lg:pt-16">
                {/* Check alignment due to back button */}
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
                            <h3 className="text-xl font-bold text-gray-900">Enter 2D Design Mode</h3>
                            <p className="text-sm text-gray-500 leading-relaxed px-4">
                                Click below to enter the editor. You can <span className="text-brand-600 font-bold">upload logos</span> and design freely.
                            </p>
                        </div>

                        <div className="w-full space-y-3 mt-2">
                            <button
                                onClick={handleConfirmDesign}
                                className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold shadow-xl shadow-brand-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                Start Designing
                            </button>

                            <button
                                onClick={() => setShowInteractionPrompt(false)}
                                className="w-full py-3 text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
                    <div className="flex items-center gap-4 px-8 py-4 bg-white rounded-xl shadow-xl animate-in fade-in zoom-in duration-300">
                        <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                        <span className="text-[15px] font-medium text-gray-900">Building model</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Designer;
