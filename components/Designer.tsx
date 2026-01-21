import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Scene from './Scene';
import Controls from './Controls';
import FeasibilityReport from './FeasibilityReport';
import TextureEditor from './TextureEditor';
import EditorSidebar from './EditorSidebar';
import HomeLayout from './Home/HomeLayout';
import { PackagingState, ModelItem } from '../types';
import { Sparkles, ArrowLeft, Loader2, Download, Share2, Save, X, Languages } from 'lucide-react';
import { storageService } from '../src/services/storageService';
import { useLanguage } from '../contexts/LanguageContext';

const Designer: React.FC = () => {
    // Get URL parameters
    const { category, modelId } = useParams<{ category?: string; modelId?: string }>();
    const navigate = useNavigate();
    const { language, setLanguage, t } = useLanguage();

    // View State: determined by URL parameters
    const [currentView, setCurrentView] = useState<'home' | 'editor'>(
        category && modelId ? 'editor' : 'home'
    );

    const [config, setConfig] = useState<PackagingState>({
        shape: 'mannequin',
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
    const [editorInitialLayers, setEditorInitialLayers] = useState<any[] | undefined>(undefined);
    const [showInteractionPrompt, setShowInteractionPrompt] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState<'jpg' | 'png'>('png');
    const [exportQuality, setExportQuality] = useState<'2k' | '4k' | '8k'>('2k');
    const [exportWithShadow, setExportWithShadow] = useState(true);
    const sceneRef = useRef<HTMLDivElement>(null);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    const exportPreviewRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭导出菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setShowExportMenu(false);
            }
        };

        if (showExportMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showExportMenu]);

    const handleConfigChange = (newConfig: Partial<PackagingState>) => {
        setConfig((prev) => ({ ...prev, ...newConfig }));
    };

    const handleOpenEditor = (imageUrl: string | null) => {
        setEditorInitialImage(imageUrl || config.textureUrl);
        setActiveModal('editor');
    };

    const handleSaveTexture = (newTextureUrl: string, layers?: any[]) => {
        setConfig(prev => ({
            ...prev,
            textureUrl: newTextureUrl,
            layers: layers, // 保存图层数据
            textureOffset: [0, 0],
            textureRepeat: [1, 1],
            textureRotation: 0,
        }));
    };

    // 执行导出
    const executeExport = async () => {
        try {
            setShowExportModal(false);
            
            // 等待一小段时间确保场景已渲染
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const canvas = exportPreviewRef.current?.querySelector('canvas') || sceneRef.current?.querySelector('canvas');
            if (canvas) {
                // 根据质量设置导出尺寸
                let scale = 1;
                switch (exportQuality) {
                    case '2k':
                        scale = 1; // 原始尺寸
                        break;
                    case '4k':
                        scale = 2;
                        break;
                    case '8k':
                        scale = 4;
                        break;
                }

                // 创建高质量导出
                const mimeType = exportFormat === 'jpg' ? 'image/jpeg' : 'image/png';
                const quality = exportFormat === 'jpg' ? 0.95 : 1.0;
                
                // 如果设置了缩放，需要创建新的canvas
                if (scale > 1) {
                    const exportCanvas = document.createElement('canvas');
                    exportCanvas.width = canvas.width * scale;
                    exportCanvas.height = canvas.height * scale;
                    const ctx = exportCanvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);
                        exportCanvas.toBlob((blob) => {
                            if (blob) {
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `3d场景-${exportQuality}-${Date.now()}.${exportFormat}`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(url);
                            }
                        }, mimeType, quality);
                    }
                } else {
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `3d-scene-${exportQuality}-${Date.now()}.${exportFormat}`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                        }
                    }, mimeType, quality);
                }
            } else {
                alert('无法获取3D场景，请稍后再试');
            }
        } catch (error) {
            console.error('导出失败:', error);
            alert('导出失败，请稍后再试');
        }
    };

    // 导出功能（打开弹窗）
    const handleExport = () => {
        setShowExportModal(true);
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

    // --- Handler for Home Selection ---
    const handleModelSelect = async (model: ModelItem) => {
        // Navigate to model preview URL
        const categorySlug = model.config.category || model.categoryId || 'all';
        navigate(`/${categorySlug}/${model.id}`);
    };

    // Load model from URL parameters
    useEffect(() => {
        const loadModelFromUrl = async () => {
            if (!category || !modelId) {
                setCurrentView('home');
                return;
            }

            try {
                const model = await storageService.getModel(modelId);
                if (model) {
                    const newConfig: PackagingState = {
                        ...config,
                        ...model.config,
                        modelFileUrl: model.file, // Add the GLB file URL
                        textureUrl: null,
                    };
                    setConfig(newConfig);
                    setCurrentView('editor');
                } else {
                    // Model not found, redirect to home
                    console.error('Model not found:', modelId);
                    navigate('/', { replace: true });
                }
            } catch (error) {
                console.error('Error loading model:', error);
                navigate('/', { replace: true });
            }
        };

        loadModelFromUrl();
    }, [category, modelId]);

    const handleBackToHome = () => {
        navigate('/');
    };

    // --- Render View: Home ---
    if (currentView === 'home') {
        return <HomeLayout onSelectModel={handleModelSelect} />;
    }

    // --- Render View: Editor ---
    return (
        <div className="flex h-screen w-screen overflow-hidden bg-[#f3f4f6] text-gray-900 font-sans">

            {/* Main 3D Viewport - Light Gray background */}
            <div className="flex-1 relative bg-[#f3f4f6] flex">
                {/* Left Sidebar */}
                <div className="flex-none h-full">
                    <EditorSidebar
                        config={config}
                        modelId={modelId || 'unknown'}
                        onConfigUpdate={handleConfigChange}
                        onOpenTextureEditor={() => handleOpenEditor(null)}
                    />
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col">
                    {/* Top Action Bar */}
                    <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-none z-10">
                        <div className="flex items-center gap-6">
                            {/* 返回模型列表按钮 */}
                            <button
                                onClick={handleBackToHome}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 text-gray-700 hover:text-gray-900 transition-all text-sm font-medium"
                            >
                                <ArrowLeft size={16} />
                                {t('backToModels')}
                            </button>

                            <div className="flex items-center gap-3">
                                <h2 className="text-lg font-bold text-gray-900">{t('3dPreview')}</h2>
                                <span className="text-xs text-gray-400">WebGL 2.0</span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                            {/* Language Toggle */}
                            <button
                                onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
                                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors text-sm font-medium"
                                title={language === 'zh' ? 'Switch to English' : '切换到中文'}
                            >
                                <Languages size={16} />
                                <span className="text-xs font-medium">{language === 'zh' ? 'EN' : '中'}</span>
                            </button>
                            
                            <button 
                                onClick={async () => {
                                    if (modelId) {
                                        try {
                                            const model = await storageService.getModel(modelId);
                                            if (model) {
                                                await storageService.updateModel({
                                                    ...model,
                                                    config: config
                                                });
                                                alert(language === 'zh' ? '保存成功！' : 'Saved successfully!');
                                            }
                                        } catch (error) {
                                            console.error('保存失败:', error);
                                            alert(language === 'zh' ? '保存失败，请稍后再试' : 'Save failed, please try again');
                                        }
                                    } else {
                                        alert(language === 'zh' ? '请先选择模型' : 'Please select a model first');
                                    }
                                }}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                                title={t('save')}
                            >
                                <Save size={20} />
                            </button>
                            <button 
                                onClick={() => {
                                    const shareUrl = window.location.href;
                                    navigator.clipboard.writeText(shareUrl).then(() => {
                                        alert(language === 'zh' ? '链接已复制到剪贴板' : 'Link copied to clipboard');
                                    }).catch(() => {
                                        alert(language === 'zh' ? '复制失败，请手动复制链接' : 'Copy failed, please copy manually');
                                    });
                                }}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                                title={t('share')}
                            >
                                <Share2 size={20} />
                            </button>
                            <button 
                                onClick={handleExport}
                                className="flex items-center gap-2 px-4 py-2.5 bg-black hover:bg-gray-800 text-white rounded-lg transition-colors text-sm font-bold shadow-sm"
                            >
                                <Download size={16} />
                                {t('export')}
                            </button>
                        </div>
                    </div>

                    {/* 3D Scene */}
                    <div className="flex-1" ref={sceneRef}>
                        <Scene config={config} onModelClick={handleModelClick} />
                    </div>
                </div>
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
                    initialLayers={config.layers}
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
                            <h3 className="text-xl font-bold text-gray-900">{t('enter2DDesignMode')}</h3>
                            <p className="text-sm text-gray-500 leading-relaxed px-4">
                                {t('clickToEnterEditor')} <span className="text-brand-600 font-bold">{t('uploadLogos')}</span> {t('andDesignFreely')}
                            </p>
                        </div>

                        <div className="w-full space-y-3 mt-2">
                            <button
                                onClick={handleConfirmDesign}
                                className="w-full py-4 bg-black hover:bg-gray-800 text-white rounded-2xl font-bold shadow-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                {t('startDesigning')}
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

            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-6xl h-[85vh] max-h-[800px] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setShowExportModal(false)}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                        true ? 'text-gray-700 border-b-2 border-black' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                    title={t('mockup')}
                                >
                                    {t('mockup')}
                                </button>
                                <button className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-lg transition-colors" title={t('dieline')}>
                                    {t('dieline')}
                                </button>
                                <button className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-lg transition-colors" title={t('video')}>
                                    {t('video')}
                                </button>
                                <button className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-lg transition-colors" title={t('code')}>
                                    {t('code')}
                                </button>
                                <button className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-lg transition-colors" title={t('share')}>
                                    {t('share')}
                                </button>
                            </div>
                            <button
                                onClick={() => setShowExportModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                title={t('close')}
                            >
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Left Preview */}
                            <div className="flex-1 bg-gray-50 flex flex-col items-center justify-center p-6">
                                <div className="w-full h-full max-w-2xl" ref={exportPreviewRef}>
                                    <Scene config={config} onModelClick={handleModelClick} />
                                </div>
                                <div className="mt-4">
                                    <select 
                                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
                                        title={t('ratio')}
                                    >
                                        <option value="1:1">{t('ratio1:1')}</option>
                                        <option value="16:9">{t('ratio16:9')}</option>
                                        <option value="4:3">{t('ratio4:3')}</option>
                                    </select>
                                </div>
                            </div>

                            {/* Right Settings */}
                            <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto">
                                <div className="space-y-6">
                                    {/* Rendering Info */}
                                    <div className="bg-gradient-to-br from-purple-50 to-white p-4 rounded-xl border border-purple-100">
                                        <p className="text-xs text-gray-600">
                                            {t('renderingInfo')}
                                        </p>
                                    </div>

                                    {/* Ground Shadow Toggle */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-700">{t('exportWithShadow')}</span>
                                        <button
                                            onClick={() => setExportWithShadow(!exportWithShadow)}
                                            className={`relative w-11 h-6 rounded-full transition-colors ${
                                                exportWithShadow ? 'bg-black' : 'bg-gray-300'
                                            }`}
                                        >
                                            <span
                                                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                                    exportWithShadow ? 'translate-x-5' : 'translate-x-0'
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Format and Quality */}
                                    <div className="space-y-4">
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-900 mb-3">{t('formatAndQuality')}</h3>
                                            
                                            {/* Format */}
                                            <div className="mb-4">
                                                <label className="text-xs font-medium text-gray-600 mb-2 block">{t('format')}</label>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setExportFormat('jpg')}
                                                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                                                            exportFormat === 'jpg'
                                                                ? 'border-black bg-gray-50 text-gray-900'
                                                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        JPG
                                                    </button>
                                                    <button
                                                        onClick={() => setExportFormat('png')}
                                                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                                                            exportFormat === 'png'
                                                                ? 'border-black bg-gray-50 text-gray-900'
                                                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        PNG
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Quality */}
                                            <div>
                                                <label className="text-xs font-medium text-gray-600 mb-2 block">{t('quality')}</label>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setExportQuality('2k')}
                                                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                                                            exportQuality === '2k'
                                                                ? 'border-black bg-gray-50 text-gray-900'
                                                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        2K
                                                    </button>
                                                    <button
                                                        onClick={() => setExportQuality('4k')}
                                                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                                                            exportQuality === '4k'
                                                                ? 'border-black bg-gray-50 text-gray-900'
                                                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        4K
                                                    </button>
                                                    <button
                                                        onClick={() => setExportQuality('8k')}
                                                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                                                            exportQuality === '8k'
                                                                ? 'border-black bg-gray-50 text-gray-900'
                                                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        8K
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2">{t('highDefFastRender')}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Export Button */}
                                    <button
                                        onClick={executeExport}
                                        className="w-full py-3 bg-black hover:bg-gray-800 text-white rounded-lg font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Sparkles size={16} />
                                        {t('renderExport')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Designer;
