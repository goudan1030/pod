import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'zh' | 'en';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// 翻译字典
const translations: Record<Language, Record<string, string>> = {
    zh: {
        // Designer.tsx
        'backToModels': '返回模型列表',
        '3dPreview': '3D 预览',
        'save': '保存',
        'share': '分享',
        'export': '导出',
        'enter2DDesignMode': '进入 2D 设计模式',
        'clickToEnterEditor': '点击下方按钮进入编辑器。您可以',
        'uploadLogos': '上传 Logo',
        'andDesignFreely': '并自由设计。',
        'startDesigning': '开始设计',
        
        // Export Modal
        'mockup': '样机',
        'dieline': '刀版',
        'video': '视频',
        'code': '代码',
        'share': '分享',
        'close': '关闭',
        'ratio': '比例',
        'ratio1:1': '比例 1:1',
        'ratio16:9': '比例 16:9',
        'ratio4:3': '比例 4:3',
        'renderingInfo': '使用独立开发的逼真渲染技术。了解更多 >',
        'exportWithShadow': '带地面阴影导出',
        'formatAndQuality': '格式与质量',
        'format': '格式',
        'quality': '质量',
        'highDefFastRender': '*高清, 渲染速度快',
        'renderExport': '渲染导出',
        
        // Controls.tsx
        'appName': '包装设计工具',
        'materialAndPattern': '材质与图案',
        'design': '设计',
        'baseColor': '底色',
        'uploadLogoPattern': '上传 Logo / 图案',
        'adjustCurrentDesign': '调整当前设计（2D 编辑器）',
        'aiCreativeGeneration': 'AI 创意生成',
        'example': '例如: 极简主义线条, 赛博朋克风格',
        'generateAndApply': '生成并应用',
        'poweredBy': '基于 Gemini & Three.js 构建',
        
        // TextureEditor.tsx
        'uploadImage': '上传图片',
        'layerManagement': '图层管理',
        'packagingAssets': '包装素材',
        'clickToUpload': '点击上传图片（支持 JPG, PNG）',
        'addColorBlock': '添加色块',
        'addText': '新增文字',
        'noUploadedImages': '暂无已上传图片',
        'uploadToUse': '上传后可在右侧图层中多次使用',
        'noLayers': '暂无图层',
        'addImageFirst': '先在"上传"中添加图片',
        'cancel': '取消',
        'completeDesign': '完成设计',
        
        // EditorSidebar.tsx
        'edit': '编辑',
        'uploadImage': '上传图片',
        'clickToUploadImage': '点击上传图片',
        'supportFormats': '支持 JPG, PNG 格式',
        'adjustAssets': '调整素材',
        'color': '颜色',
        'customMaterial': '自定义材质',
        'customComponent': '自定义部件',
        'modelId': '模型ID',
        'parts': '部件',
        'adjustAssets': '调整素材',
        'clickToUploadImage': '点击上传图片',
        'supportFormats': '支持 JPG, PNG 格式',
        'addToCanvas': '添加到画布',
        'delete': '删除',
        'imageLayer': '图片图层',
        'colorLayer': '色块图层',
        'textLayer': '文字图层',
        
        // HomeLayout.tsx
        'allModels': '所有模型',
        'items': '项',
        'freeTrial': '免费试用',
        'upgrade': '升级',
        'adminPanel': '管理面板',
        'customize': '自定义',
        'clickToEdit': '点击编辑',
        'variants': '变体',
        'noModelsFound': '此分类中未找到模型',
        
        // Categories
        'category.all': '所有模型',
        'category.t-shirt': 'T恤',
        'category.hoodie': '连帽衫',
        'category.hat': '帽子',
        'category.pillow': '枕头',
        'category.blanket': '毯子',
        'category.box': '盒子',
        'category.pouch': '袋子',
        'category.bottle': '瓶子',
        'category.can': '罐子',
        'category.shorts': '短裤',
    },
    en: {
        // Designer.tsx
        'backToModels': 'Back to Models',
        '3dPreview': '3D Preview',
        'save': 'Save',
        'share': 'Share',
        'export': 'Export',
        'enter2DDesignMode': 'Enter 2D Design Mode',
        'clickToEnterEditor': 'Click below to enter the editor. You can',
        'uploadLogos': 'upload logos',
        'andDesignFreely': 'and design freely.',
        'startDesigning': 'Start Designing',
        
        // Export Modal
        'mockup': 'Mockup',
        'dieline': 'Dieline',
        'video': 'Video',
        'code': 'Code',
        'share': 'Share',
        'close': 'Close',
        'ratio': 'Ratio',
        'ratio1:1': 'Ratio 1:1',
        'ratio16:9': 'Ratio 16:9',
        'ratio4:3': 'Ratio 4:3',
        'renderingInfo': 'Uses independently developed realistic rendering technology. Learn more >',
        'exportWithShadow': 'Export with ground shadow',
        'formatAndQuality': 'Format & Quality',
        'format': 'Format',
        'quality': 'Quality',
        'highDefFastRender': '*High definition, fast rendering speed',
        'renderExport': 'Render Export',
        
        // Controls.tsx
        'appName': 'Packaging Design Tool',
        'materialAndPattern': 'Material & Pattern',
        'design': 'Design',
        'baseColor': 'Base Color',
        'uploadLogoPattern': 'Upload Logo / Pattern',
        'adjustCurrentDesign': 'Adjust Current Design (2D Editor)',
        'aiCreativeGeneration': 'AI Creative Generation',
        'example': 'e.g.: Minimalist lines, Cyberpunk style',
        'generateAndApply': 'Generate & Apply',
        'poweredBy': 'Powered by Gemini & Three.js',
        
        // TextureEditor.tsx
        'uploadImage': 'Upload Image',
        'layerManagement': 'Layer Management',
        'packagingAssets': 'Packaging Assets',
        'clickToUpload': 'Click to upload image (supports JPG, PNG)',
        'addColorBlock': 'Add Color Block',
        'addText': 'Add Text',
        'noUploadedImages': 'No uploaded images',
        'uploadToUse': 'Upload to use multiple times in layers',
        'noLayers': 'No layers',
        'addImageFirst': 'Add images in "Upload" first',
        'cancel': 'Cancel',
        'completeDesign': 'Complete Design',
        
        // EditorSidebar.tsx
        'edit': 'Edit',
        'uploadImage': 'Upload Image',
        'clickToUploadImage': 'Click to upload image',
        'supportFormats': 'Supports JPG, PNG formats',
        'adjustAssets': 'Adjust Assets',
        'color': 'Color',
        'customMaterial': 'Custom Material',
        'customComponent': 'Custom Component',
        'modelId': 'Model ID',
        'parts': 'parts',
        'adjustAssets': 'Adjust Assets',
        'clickToUploadImage': 'Click to upload image',
        'supportFormats': 'Supports JPG, PNG formats',
        'addToCanvas': 'Add to Canvas',
        'delete': 'Delete',
        'imageLayer': 'Image Layer',
        'colorLayer': 'Color Layer',
        'textLayer': 'Text Layer',
        
        // HomeLayout.tsx
        'allModels': 'All Models',
        'items': 'items',
        'freeTrial': 'Free Trial',
        'upgrade': 'Upgrade',
        'adminPanel': 'Admin Panel',
        'customize': 'Customize',
        'clickToEdit': 'Click to Edit',
        'variants': 'variants',
        'noModelsFound': 'No models found in this category.',
        
        // Categories
        'category.all': 'All Models',
        'category.t-shirt': 'T-Shirt',
        'category.hoodie': 'Hoodie',
        'category.hat': 'Hat',
        'category.pillow': 'Pillow',
        'category.blanket': 'Blanket',
        'category.box': 'Box',
        'category.pouch': 'Pouch',
        'category.bottle': 'Bottle',
        'category.can': 'Can',
        'category.shorts': 'Shorts',
    }
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>('zh');

    const t = (key: string): string => {
        return translations[language][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }
    return context;
};
