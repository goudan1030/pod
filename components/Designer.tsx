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
    
    // Export Tab State
    const [exportTab, setExportTab] = useState<'mockup' | 'dieline'>('mockup');
    
    // Mockup Export States
    const [exportFormat, setExportFormat] = useState<'jpg' | 'png'>('png');
    const [exportQuality, setExportQuality] = useState<'2k' | '4k' | '8k'>('2k');
    const [exportWithShadow, setExportWithShadow] = useState(true);
    
    // Dieline Export States
    const [dielineType, setDielineType] = useState<'design' | 'cutline'>('design');
    const [dielineFormat, setDielineFormat] = useState<'ai' | 'pdf' | 'dxf'>('ai');
    const [dielineColorMode, setDielineColorMode] = useState<'cmyk' | 'rgb'>('cmyk');
    
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

    // 执行样机导出
    const executeMockupExport = async () => {
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
                                link.download = `mockup-${exportQuality}-${Date.now()}.${exportFormat}`;
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
                            link.download = `mockup-${exportQuality}-${Date.now()}.${exportFormat}`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                        }
                    }, mimeType, quality);
                }
            } else {
                alert(language === 'zh' ? '无法获取3D场景，请稍后再试' : 'Unable to capture 3D scene, please try again');
            }
        } catch (error) {
            console.error('导出失败:', error);
            alert(language === 'zh' ? '导出失败，请稍后再试' : 'Export failed, please try again');
        }
    };

    // 从画布中提取区域纹理
    const extractRegionTexture = async (textureUrl: string, regionId: string, svgWidth: number, svgHeight: number, canvasWidth: number, canvasHeight: number): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                // 获取区域在画布中的位置
                const dynamicPaths = config.dynamicSVGPaths || {};
                const pathData = dynamicPaths[regionId];
                
                if (!pathData) {
                    // 如果没有动态路径，返回原始纹理
                    resolve(textureUrl);
                    return;
                }
                
                // 使用SVG DOM API获取路径边界框
                const getPathBounds = (d: string): { x: number, y: number, width: number, height: number } => {
                    try {
                        if (typeof document !== 'undefined') {
                            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                            svg.setAttribute('viewBox', '0 0 10000 10000');
                            svg.setAttribute('width', '10000');
                            svg.setAttribute('height', '10000');
                            svg.style.position = 'absolute';
                            svg.style.visibility = 'hidden';
                            svg.style.width = '0';
                            svg.style.height = '0';
                            
                            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                            path.setAttribute('d', d);
                            svg.appendChild(path);
                            document.body.appendChild(svg);
                            
                            try {
                                const bbox = path.getBBox();
                                document.body.removeChild(svg);
                                return {
                                    x: bbox.x,
                                    y: bbox.y,
                                    width: bbox.width,
                                    height: bbox.height
                                };
                            } catch (e) {
                                if (document.body.contains(svg)) {
                                    document.body.removeChild(svg);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('Failed to get path bounds:', e);
                    }
                    // 回退：使用pathData的宽高
                    return { x: 0, y: 0, width: pathData.w, height: pathData.h };
                };
                
                const svgBounds = getPathBounds(pathData.d);
                
                // 计算缩放比例：SVG坐标到画布坐标
                // 所有路径共享同一个SVG画布
                const firstPath = Object.values(dynamicPaths)[0];
                const svgCanvasWidth = firstPath?.w || canvasWidth;
                const svgCanvasHeight = firstPath?.h || canvasHeight;
                
                const scaleX = canvasWidth / svgCanvasWidth;
                const scaleY = canvasHeight / svgCanvasHeight;
                
                // 计算在画布中的位置和尺寸
                const canvasX = svgBounds.x * scaleX;
                const canvasY = svgBounds.y * scaleY;
                const canvasW = svgBounds.width * scaleX;
                const canvasH = svgBounds.height * scaleY;
                
                // 确保坐标在有效范围内
                const clampedX = Math.max(0, Math.min(canvasX, canvasWidth));
                const clampedY = Math.max(0, Math.min(canvasY, canvasHeight));
                const clampedW = Math.max(1, Math.min(canvasW, canvasWidth - clampedX));
                const clampedH = Math.max(1, Math.min(canvasH, canvasHeight - clampedY));
                
                // 创建临时canvas提取区域
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = svgWidth;
                tempCanvas.height = svgHeight;
                const tempCtx = tempCanvas.getContext('2d');
                if (!tempCtx) {
                    resolve(textureUrl);
                    return;
                }
                
                // 绘制裁剪后的区域，缩放到目标尺寸
                tempCtx.drawImage(
                    img,
                    clampedX, clampedY, clampedW, clampedH, // 源区域（画布坐标）
                    0, 0, svgWidth, svgHeight // 目标尺寸（SVG坐标）
                );
                
                resolve(tempCanvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve(textureUrl);
            img.src = textureUrl;
        });
    };

    // 执行刀版导出
    const executeDielineExport = async () => {
        try {
            setShowExportModal(false);
            
            // 生成真实的T恤刀版SVG数据
            const generateDielineSVG = async () => {
                // 使用真实的T恤裁片路径
                const strokeColor = dielineColorMode === 'cmyk' ? '#00FF00' : '#000000';
                const strokeWidth = 2;
                const strokeDasharray = dielineType === 'cutline' ? '10,5' : '0';
                
                // 画布尺寸
                const canvasWidth = 2048;
                const canvasHeight = 1024;
                
                // 提取各区域的纹理
                let textureFront = config.textureUrl || '';
                let textureBack = config.textureUrl || '';
                let textureSleeve = config.textureUrl || '';
                let textureCollar = config.textureUrl || '';
                
                if (dielineType === 'design' && config.textureUrl) {
                    // 根据dynamicSVGPaths提取各区域
                    const dynamicPaths = config.dynamicSVGPaths || {};
                    const regionKeys = Object.keys(dynamicPaths);
                    
                    // 尝试提取各区域纹理（支持多种命名方式）
                    // Front区域：region_1, front, Front Body等
                    const frontKey = regionKeys.find(k => 
                        k.toLowerCase().includes('front') || 
                        k.toLowerCase().includes('region_1') ||
                        k === 'region_1'
                    );
                    if (frontKey) {
                        textureFront = await extractRegionTexture(config.textureUrl, frontKey, 1065, 1502.5, canvasWidth, canvasHeight);
                    }
                    
                    // Back区域：region_4, back, Back Body等
                    const backKey = regionKeys.find(k => 
                        k.toLowerCase().includes('back') || 
                        k.toLowerCase().includes('region_4') ||
                        k === 'region_4'
                    );
                    if (backKey) {
                        textureBack = await extractRegionTexture(config.textureUrl, backKey, 1060.5, 1502.5, canvasWidth, canvasHeight);
                    }
                    
                    // Sleeve区域：region_2, region_3, sleeve等
                    const sleeveKey = regionKeys.find(k => 
                        k.toLowerCase().includes('sleeve') || 
                        k.toLowerCase().includes('region_2') ||
                        k.toLowerCase().includes('region_3') ||
                        k === 'region_2' || k === 'region_3'
                    );
                    if (sleeveKey) {
                        textureSleeve = await extractRegionTexture(config.textureUrl, sleeveKey, 773, 531, canvasWidth, canvasHeight);
                    }
                    
                    // Collar区域
                    const collarKey = regionKeys.find(k => k.toLowerCase().includes('collar'));
                    if (collarKey) {
                        textureCollar = await extractRegionTexture(config.textureUrl, collarKey, 773, 170, canvasWidth, canvasHeight);
                    }
                }
                
                const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="3100" height="2000" viewBox="0 0 3100 2000" xmlns="http://www.w3.org/2000/svg">
    ${dielineType === 'design' && config.textureUrl ? `
    <defs>
        <pattern id="textureFront" patternUnits="userSpaceOnUse" width="1065" height="1502.5">
            <image href="${textureFront}" x="0" y="0" width="1065" height="1502.5" preserveAspectRatio="none"/>
        </pattern>
        <pattern id="textureBack" patternUnits="userSpaceOnUse" width="1060.5" height="1502.5">
            <image href="${textureBack}" x="0" y="0" width="1060.5" height="1502.5" preserveAspectRatio="none"/>
        </pattern>
        <pattern id="textureSleeve" patternUnits="userSpaceOnUse" width="773" height="531">
            <image href="${textureSleeve}" x="0" y="0" width="773" height="531" preserveAspectRatio="none"/>
        </pattern>
        <pattern id="textureCollar" patternUnits="userSpaceOnUse" width="773" height="170">
            <image href="${textureCollar}" x="0" y="0" width="773" height="170" preserveAspectRatio="none"/>
        </pattern>
    </defs>
    ` : ''}
    
    <!-- Front Body -->
    <g id="front-body" transform="translate(0, 0)">
        <path d="M0,185Q154,430.5,48.5,527L48.5,1502.5L1017,1502.5L1017,527Q902.5,436,1065,185Q850,58,754,0Q717,234.5,533,234.5Q351,241.5,311,0L0,185Z" 
              fill="${dielineType === 'design' && config.textureUrl ? 'url(#textureFront)' : '#f0f0f0'}" 
              stroke="${strokeColor}" 
              stroke-width="${strokeWidth}"
              stroke-dasharray="${strokeDasharray}"/>
        <text x="532.5" y="750" font-size="48" fill="#999" text-anchor="middle" font-weight="bold">Front</text>
    </g>
    
    <!-- Back Body -->
    <g id="back-body" transform="translate(1165, 0)">
        <path d="M0,1502.5006L1060.5,1502.5006L1060.5,510.00049Q895.5,385.50586,1028,106.00307Q793,36.505859,692.5,0Q591,39.005859,525,39.005859Q436.5,39.005859,373.5,0L38,106.00391Q152,441.00586,0.5,510.00049Q0.5,641.00049,0,1502.5006Z" 
              fill="${dielineType === 'design' && config.textureUrl ? 'url(#textureBack)' : '#f0f0f0'}" 
              stroke="${strokeColor}" 
              stroke-width="${strokeWidth}"
              stroke-dasharray="${strokeDasharray}"/>
        <text x="530" y="750" font-size="48" fill="#999" text-anchor="middle" font-weight="bold">Back</text>
    </g>
    
    <!-- Left Sleeve -->
    <g id="sleeve-left" transform="translate(2240, 0)">
        <path d="M0,212L0,531L773,531L773,212C667.5,182,579.75,0,386.5,0C193.25,0,93.5,187,0,212Z" 
              fill="${dielineType === 'design' && config.textureUrl ? 'url(#textureSleeve)' : '#f0f0f0'}" 
              stroke="${strokeColor === '#00FF00' ? '#0088ff' : strokeColor}" 
              stroke-width="${strokeWidth}"
              stroke-dasharray="${strokeDasharray}"/>
        <text x="386.5" y="300" font-size="36" fill="#999" text-anchor="middle" font-weight="bold">Sleeve Left</text>
    </g>
    
    <!-- Right Sleeve -->
    <g id="sleeve-right" transform="translate(2240, 600)">
        <path d="M0,212L0,531L773,531L773,212C667.5,182,579.75,0,386.5,0C193.25,0,93.5,187,0,212Z" 
              fill="${dielineType === 'design' && config.textureUrl ? 'url(#textureSleeve)' : '#f0f0f0'}" 
              stroke="${strokeColor === '#00FF00' ? '#0088ff' : strokeColor}" 
              stroke-width="${strokeWidth}"
              stroke-dasharray="${strokeDasharray}"/>
        <text x="386.5" y="300" font-size="36" fill="#999" text-anchor="middle" font-weight="bold">Sleeve Right</text>
    </g>
    
    <!-- Collar -->
    <g id="collar" transform="translate(2240, 1200)">
        <rect x="0" y="0" width="773" height="170"
              fill="${dielineType === 'design' && config.textureUrl ? 'url(#textureCollar)' : '#f0f0f0'}" 
              stroke="${strokeColor === '#00FF00' ? '#ff6600' : strokeColor}" 
              stroke-width="${strokeWidth}"
              stroke-dasharray="${strokeDasharray}"/>
        <text x="386.5" y="100" font-size="36" fill="#999" text-anchor="middle" font-weight="bold">Collar</text>
    </g>
</svg>`;
                return svgContent;
            };

            const svgContent = await generateDielineSVG();
            const blob = new Blob([svgContent], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const fileExtension = dielineFormat === 'ai' ? 'svg' : dielineFormat; // AI格式导出为SVG
            link.download = `tshirt-dieline-${dielineType}-${Date.now()}.${fileExtension}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            alert(language === 'zh' ? '刀版文件已生成（SVG格式）' : 'Dieline file generated (SVG format)');
        } catch (error) {
            console.error('刀版导出失败:', error);
            alert(language === 'zh' ? '刀版导出失败，请稍后再试' : 'Dieline export failed, please try again');
        }
    };

    // 统一导出入口
    const executeExport = async () => {
        switch (exportTab) {
            case 'mockup':
                await executeMockupExport();
                break;
            case 'dieline':
                await executeDielineExport();
                break;
            default:
                break;
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
                                    onClick={() => setExportTab('mockup')}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                        exportTab === 'mockup' ? 'text-gray-700 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                    title={t('mockup')}
                                >
                                    {t('mockup')}
                                </button>
                                <button 
                                    onClick={() => setExportTab('dieline')}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                        exportTab === 'dieline' ? 'text-gray-700 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                    title={t('dieline')}
                                >
                                    {t('dieline')}
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
                                {exportTab === 'dieline' ? (
                                    // Dieline Preview: Show SVG cutlines with real T-shirt pattern
                                    <svg width="780" height="520" viewBox="0 0 3100 2000" className="" preserveAspectRatio="xMidYMid meet">
                                        <defs>
                                            {dielineType === 'design' && config.textureUrl && (
                                                <>
                                                    {/* Front texture */}
                                                    <pattern id="textureFront" patternUnits="userSpaceOnUse" width="1065" height="1502.5" x="0" y="0">
                                                        <image href={config.textureUrl} x="0" y="0" width="1065" height="1502.5" preserveAspectRatio="xMidYMid slice"/>
                                                    </pattern>
                                                    {/* Back texture */}
                                                    <pattern id="textureBack" patternUnits="userSpaceOnUse" width="1060.5" height="1502.5" x="1065" y="0">
                                                        <image href={config.textureUrl} x="0" y="0" width="1060.5" height="1502.5" preserveAspectRatio="xMidYMid slice"/>
                                                    </pattern>
                                                    {/* Sleeve texture */}
                                                    <pattern id="textureSleeve" patternUnits="userSpaceOnUse" width="773" height="531">
                                                        <image href={config.textureUrl} x="0" y="0" width="773" height="531" preserveAspectRatio="xMidYMid slice"/>
                                                    </pattern>
                                                    {/* Collar texture */}
                                                    <pattern id="textureCollar" patternUnits="userSpaceOnUse" width="773" height="170">
                                                        <image href={config.textureUrl} x="0" y="0" width="773" height="170" preserveAspectRatio="xMidYMid slice"/>
                                                    </pattern>
                                                </>
                                            )}
                                        </defs>
                                                
                                                {/* Front Body - Real T-shirt shape */}
                                                <g transform="translate(0, 0)">
                                                    <path 
                                                        d="M0,185Q154,430.5,48.5,527L48.5,1502.5L1017,1502.5L1017,527Q902.5,436,1065,185Q850,58,754,0Q717,234.5,533,234.5Q351,241.5,311,0L0,185Z"
                                                        fill={dielineType === 'design' && config.textureUrl ? 'url(#textureFront)' : '#f0f0f0'} 
                                                        stroke="#00ff00" 
                                                        strokeWidth="4"
                                                        strokeDasharray={dielineType === 'cutline' ? '10,5' : '0'}
                                                    />
                                                    <text x="532.5" y="750" fontSize="48" fill="#999" textAnchor="middle" fontWeight="bold">Front</text>
                                                </g>
                                                
                                                {/* Back Body - Real T-shirt shape */}
                                                <g transform="translate(1165, 0)">
                                                    <path 
                                                        d="M0,1502.5006L1060.5,1502.5006L1060.5,510.00049Q895.5,385.50586,1028,106.00307Q793,36.505859,692.5,0Q591,39.005859,525,39.005859Q436.5,39.005859,373.5,0L38,106.00391Q152,441.00586,0.5,510.00049Q0.5,641.00049,0,1502.5006Z"
                                                        fill={dielineType === 'design' && config.textureUrl ? 'url(#textureBack)' : '#f0f0f0'} 
                                                        stroke="#00ff00" 
                                                        strokeWidth="4"
                                                        strokeDasharray={dielineType === 'cutline' ? '10,5' : '0'}
                                                    />
                                                    <text x="530" y="750" fontSize="48" fill="#999" textAnchor="middle" fontWeight="bold">Back</text>
                                                </g>
                                                
                                                {/* Left Sleeve */}
                                                <g transform="translate(2240, 0)">
                                                    <path 
                                                        d="M0,212L0,531L773,531L773,212C667.5,182,579.75,0,386.5,0C193.25,0,93.5,187,0,212Z"
                                                        fill={dielineType === 'design' && config.textureUrl ? 'url(#textureSleeve)' : '#f0f0f0'} 
                                                        stroke="#0088ff" 
                                                        strokeWidth="4"
                                                        strokeDasharray={dielineType === 'cutline' ? '10,5' : '0'}
                                                    />
                                                    <text x="386.5" y="300" fontSize="36" fill="#999" textAnchor="middle" fontWeight="bold">Sleeve L</text>
                                                </g>
                                                
                                                {/* Right Sleeve */}
                                                <g transform="translate(2240, 600)">
                                                    <path 
                                                        d="M0,212L0,531L773,531L773,212C667.5,182,579.75,0,386.5,0C193.25,0,93.5,187,0,212Z"
                                                        fill={dielineType === 'design' && config.textureUrl ? 'url(#textureSleeve)' : '#f0f0f0'} 
                                                        stroke="#0088ff" 
                                                        strokeWidth="4"
                                                        strokeDasharray={dielineType === 'cutline' ? '10,5' : '0'}
                                                    />
                                                    <text x="386.5" y="300" fontSize="36" fill="#999" textAnchor="middle" fontWeight="bold">Sleeve R</text>
                                                </g>
                                                
                                                {/* Collar */}
                                                <g transform="translate(2240, 1200)">
                                                    <rect 
                                                        x="0" 
                                                        y="0" 
                                                        width="773" 
                                                        height="170"
                                                        fill={dielineType === 'design' && config.textureUrl ? 'url(#textureCollar)' : '#f0f0f0'} 
                                                        stroke="#ff6600" 
                                                        strokeWidth="4"
                                                        strokeDasharray={dielineType === 'cutline' ? '10,5' : '0'}
                                                    />
                                                    <text x="386.5" y="100" fontSize="36" fill="#999" textAnchor="middle" fontWeight="bold">Collar</text>
                                                </g>
                                    </svg>
                                ) : (
                                    // Mockup Preview: Show 3D scene
                                    <>
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
                                    </>
                                )}
                            </div>

                            {/* Right Settings */}
                            <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto">
                                <div className="space-y-6">{exportTab === 'mockup' && (
                                        <>
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
                                                    aria-label={t('exportWithShadow')}
                                                    title={t('exportWithShadow')}
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
                                        </>
                                    )}

                                    {exportTab === 'dieline' && (
                                        <>
                                            {/* File Type Selection */}
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 mb-3">{t('fileType')}</h3>
                                                
                                                {/* Design File Option */}
                                                <button
                                                    onClick={() => setDielineType('design')}
                                                    className={`w-full p-4 mb-3 text-left rounded-xl border-2 transition-all ${
                                                        dielineType === 'design'
                                                            ? 'border-purple-600 bg-purple-50'
                                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                                    }`}
                                                >
                                                    <div className="font-bold text-sm text-gray-900 mb-1">{t('designFile')}</div>
                                                    <div className="text-xs text-gray-500">{t('designFileDesc')}</div>
                                                </button>

                                                {/* Cutline File Option */}
                                                <button
                                                    onClick={() => setDielineType('cutline')}
                                                    className={`w-full p-4 text-left rounded-xl border-2 transition-all ${
                                                        dielineType === 'cutline'
                                                            ? 'border-purple-600 bg-purple-50'
                                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                                    }`}
                                                >
                                                    <div className="font-bold text-sm text-gray-900 mb-1">{t('dielineFile')}</div>
                                                    <div className="text-xs text-gray-500">{t('dielineFileDesc')}</div>
                                                </button>
                                            </div>

                                            {/* Color Mode (only for design files) */}
                                            {dielineType === 'design' && (
                                                <div>
                                                    <h3 className="text-sm font-bold text-gray-900 mb-3">{t('colorMode')}</h3>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => setDielineColorMode('cmyk')}
                                                            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                                                                dielineColorMode === 'cmyk'
                                                                    ? 'border-purple-600 bg-purple-50 text-purple-900'
                                                                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                                            }`}
                                                        >
                                                            {t('cmyk')}
                                                        </button>
                                                        <button
                                                            onClick={() => setDielineColorMode('rgb')}
                                                            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                                                                dielineColorMode === 'rgb'
                                                                    ? 'border-purple-600 bg-purple-50 text-purple-900'
                                                                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                                            }`}
                                                        >
                                                            {t('rgb')}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Format Selection */}
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 mb-3">{t('format')}</h3>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setDielineFormat('ai')}
                                                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                                                            dielineFormat === 'ai'
                                                                ? 'border-purple-600 bg-purple-50 text-purple-900'
                                                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        AI
                                                    </button>
                                                    <button
                                                        onClick={() => setDielineFormat('pdf')}
                                                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                                                            dielineFormat === 'pdf'
                                                                ? 'border-purple-600 bg-purple-50 text-purple-900'
                                                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        PDF
                                                    </button>
                                                    <button
                                                        onClick={() => setDielineFormat('dxf')}
                                                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                                                            dielineFormat === 'dxf'
                                                                ? 'border-purple-600 bg-purple-50 text-purple-900'
                                                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        DXF
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}


                                    {/* Export Button */}
                                    <button
                                        onClick={executeExport}
                                        className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Sparkles size={16} />
                                        {t('exportNow')}
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
