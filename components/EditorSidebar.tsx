import React, { useState, useRef, useEffect } from 'react';
import { Edit3, ChevronRight, Upload, Plus } from 'lucide-react';
import { PackagingState } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface EditorSidebarProps {
    config: PackagingState;
    modelId: string;
    onConfigUpdate: (updates: Partial<PackagingState>) => void;
    onOpenTextureEditor: () => void;
}

type MenuItem = 'edit';

const EditorSidebar: React.FC<EditorSidebarProps> = ({
    config,
    modelId,
    onConfigUpdate,
    onOpenTextureEditor
}) => {
    const { language, t } = useLanguage();
    const [activeMenu, setActiveMenu] = useState<MenuItem>('edit');
    const [selectedColor, setSelectedColor] = useState<string>(config.color || '#ffffff');
    const [showMaterialMenu, setShowMaterialMenu] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const materialMenuRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭材质菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (materialMenuRef.current && !materialMenuRef.current.contains(event.target as Node)) {
                setShowMaterialMenu(false);
            }
        };

        if (showMaterialMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showMaterialMenu]);

    // 材质预设定义（与Controls.tsx保持一致）
    const materialPresets = {
        cotton: { name: '棉基', color: '#ffffff', roughness: 0.7, metalness: 0 },
        white: { name: '白棉布', color: '#ffffff', roughness: 0.5, metalness: 0 },
        kraft: { name: '黄麻布', color: '#e3c099', roughness: 0.9, metalness: 0 },
        glossy: { name: '丝绸', color: '#ffffff', roughness: 0.1, metalness: 0.1 },
        canvas: { name: '帆布', color: '#f5f5dc', roughness: 0.8, metalness: 0 },
        denim: { name: '牛仔布', color: '#4a6fa5', roughness: 0.85, metalness: 0 },
        leather: { name: '皮革', color: '#8b4513', roughness: 0.6, metalness: 0.1 },
        metal: { name: '金属', color: '#c0c0c0', roughness: 0.2, metalness: 0.9 },
        plastic: { name: '塑料', color: '#ffffff', roughness: 0.3, metalness: 0.2 },
        paper: { name: '纸张', color: '#fffef7', roughness: 0.95, metalness: 0 },
    };

    const handleMaterialSelect = (materialKey: keyof typeof materialPresets) => {
        const preset = materialPresets[materialKey];
        if (preset) {
            onConfigUpdate({
                color: preset.color,
                roughness: preset.roughness,
                metalness: preset.metalness,
                material: preset.name,
            });
            setShowMaterialMenu(false);
        }
    };

    // Predefined colors
    const presetColors = [
        '#8b5cf6', // Purple
        '#9ca3af', // Gray
        '#1f2937', // Dark gray
        '#f5f5dc', // Beige
        '#ffc0cb', // Pink
    ];

    const handleColorSelect = (color: string) => {
        setSelectedColor(color);
        onConfigUpdate({ color });
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const imageUrl = event.target?.result as string;
                onConfigUpdate({ textureUrl: imageUrl });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="flex h-full">
            {/* Left Icon Menu Bar */}
            <div className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-2">
                <button
                    onClick={() => setActiveMenu('edit')}
                    className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg transition-all ${activeMenu === 'edit'
                        ? 'bg-gray-100 text-black'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                        }`}
                    title={t('edit')}
                >
                    <Edit3 size={20} />
                    <span className="text-[10px] font-medium mt-0.5">{t('edit')}</span>
                </button>
            </div>

            {/* Right Content Panel */}
            {activeMenu === 'edit' && (
                <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
                    <div className="p-6 space-y-6">
                        {/* Panel Title */}
                        <div className="pb-4 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900">{t('edit')}</h2>
                        </div>

                        {/* Dieline Preview Section */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 mb-3">{t('uploadImage')}</h3>
                            <div
                                onClick={onOpenTextureEditor}
                                className="relative border-2 border-dashed border-brand-400 rounded-xl p-8 cursor-pointer hover:border-brand-500 hover:bg-brand-50/30 transition-all group"
                                style={{ minHeight: '200px' }}
                            >
                                {config.textureUrl ? (
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        {/* Show the dieline/template image */}
                                        <img
                                            src={config.textureUrl}
                                            alt="刀板图"
                                            className="max-w-full max-h-48 object-contain"
                                        />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                            <span className="text-white text-sm font-medium">点击编辑</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-center">
                                        <Upload className="text-black mb-3" size={32} />
                                        <p className="text-sm font-medium text-gray-700 mb-1">{t('clickToUploadImage')}</p>
                                        <p className="text-xs text-gray-500">{t('supportFormats')}</p>
                                    </div>
                                )}
                            </div>
                            {config.textureUrl && (
                                <button
                                    onClick={onOpenTextureEditor}
                                    className="mt-3 w-full bg-brand-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
                                >
                                    调整素材
                                </button>
                            )}
                        </div>
                        {/* Color Section */}
                        <div className="bg-gray-50 rounded-xl p-4">
                            <h3 className="text-sm font-bold text-gray-900 mb-3">颜色</h3>
                            <div className="flex items-center gap-3 flex-wrap">
                                {/* Add Color Button */}
                                <button
                                    className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-brand-500 transition-colors"
                                    onClick={() => {
                                        const input = document.createElement('input');
                                        input.type = 'color';
                                        input.onchange = (e) => handleColorSelect((e.target as HTMLInputElement).value);
                                        input.click();
                                    }}
                                >
                                    <Plus size={20} className="text-gray-600" />
                                </button>

                                {/* Preset Colors */}
                                {presetColors.map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => handleColorSelect(color)}
                                        className={`w-10 h-10 rounded-full border-2 transition-all ${selectedColor === color
                                            ? 'border-brand-600 ring-2 ring-brand-200 scale-110'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Material Section */}
                        <div className="bg-gray-50 rounded-xl p-4 relative" ref={materialMenuRef}>
                            <h3 className="text-xs font-medium text-gray-500 mb-1">{t('customMaterial')}</h3>
                            <button 
                                onClick={() => setShowMaterialMenu(!showMaterialMenu)}
                                className="w-full flex items-center justify-between py-2 hover:bg-gray-100 rounded-lg px-2 transition-colors"
                                title={language === 'zh' ? '切换材质' : 'Switch Material'}
                            >
                                <span className="text-base font-bold text-gray-900">
                                    {config.material || (language === 'zh' ? '棉基' : 'Cotton')}
                                </span>
                                <ChevronRight 
                                    size={20} 
                                    className={`text-gray-400 transition-transform ${showMaterialMenu ? 'rotate-90' : ''}`}
                                />
                            </button>
                            
                            {/* Material Selection Menu */}
                            {showMaterialMenu && (
                                <div className="absolute left-4 right-4 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                                    {Object.entries(materialPresets).map(([key, preset]) => (
                                        <button
                                            key={key}
                                            onClick={() => handleMaterialSelect(key as keyof typeof materialPresets)}
                                            className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                                                (config.material || (language === 'zh' ? '棉基' : 'Cotton')) === preset.name 
                                                    ? 'bg-gray-100 text-black font-medium' 
                                                    : 'text-gray-700'
                                            }`}
                                            title={language === 'zh' ? `选择${preset.name}材质` : `Select ${preset.name} material`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm">{preset.name}</span>
                                                {(config.material || (language === 'zh' ? '棉基' : 'Cotton')) === preset.name && (
                                                    <span className="text-black text-xs">✓</span>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Model Parts Section */}
                        <div className="bg-gray-50 rounded-xl p-4">
                            <h3 className="text-xs font-medium text-gray-500 mb-1">自定义部件</h3>
                            <button className="w-full flex items-center justify-between py-2 hover:bg-gray-100 rounded-lg px-2 transition-colors">
                                <span className="text-base font-bold text-gray-900">
                                    {config.hiddenMeshes ? `${config.hiddenMeshes.length} 部件` : '1 部件'}
                                </span>
                                <ChevronRight size={20} className="text-gray-400" />
                            </button>
                        </div>

                        {/* Model ID Section */}
                        <div className="bg-gray-50 rounded-xl p-4">
                            <h3 className="text-xs font-medium text-gray-500 mb-1">模型ID</h3>
                            <p className="text-sm font-mono text-gray-700 break-all">{modelId}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EditorSidebar;
