import React from 'react';
import { Category } from '../../types'; // Fix import source
import { ChevronRight, Shirt, Hexagon, Crown, Square, Archive, Box, ShoppingBag, SprayCan, GlassWater, Package } from 'lucide-react';
import logo from '../../assets/images/logo.svg';
import { useLanguage } from '../../contexts/LanguageContext';

const ICON_MAP: Record<string, any> = {
    'archive': Archive,
    'shirt': Shirt,
    'hexagon': Hexagon,
    'crown': Crown,
    'square': Square,
    'box': Box,
    'shopping-bag': ShoppingBag,
    'spray-can': SprayCan,
    'glass-water': GlassWater,
    'package': Package
};

interface SidebarProps {
    categories: Category[];
    selectedCategory: string;
    onSelectCategory: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ categories, selectedCategory, onSelectCategory }) => {
    const { t } = useLanguage();
    
    // 获取分类的翻译名称
    const getCategoryName = (categoryId: string) => {
        // 优先使用 displayName（用户输入的友好名称）
        const category = categories.find(c => c.id === categoryId);
        if (category?.displayName) {
            return category.displayName;
        }
        // 如果 displayName 不存在，尝试翻译
        const translated = t(`category.${categoryId}`);
        // 如果翻译结果等于 key 本身，说明没找到翻译，使用 categoryId
        return translated !== `category.${categoryId}` ? translated : categoryId;
    };
    
    return (
        <div className="w-64 h-full bg-white border-r border-gray-100 flex flex-col py-6 overflow-y-auto">
            <div className="px-6 mb-6">
                <img src={logo} alt="Logo" className="h-8" />
                {/* <h2 className="text-xl font-bold text-gray-900 tracking-tight">Category</h2> */}
            </div>
            <div className="space-y-1 px-3">
                {categories.map((category) => {
                    // Resolve icon from string or use default
                    const iconName = typeof category.icon === 'string' ? category.icon.toLowerCase() : 'archive';
                    const Icon = ICON_MAP[iconName] || Archive;
                    const isSelected = selectedCategory === category.id;

                    return (
                        <button
                            key={category.id}
                            onClick={() => onSelectCategory(category.id)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${isSelected
                                ? 'bg-brand-50 text-brand-600 font-medium shadow-sm ring-1 ring-brand-200'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg transition-colors ${isSelected ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-500 group-hover:bg-white group-hover:shadow-sm'
                                    }`}>
                                    <Icon size={18} />
                                </div>
                                <span className="text-sm">{getCategoryName(category.id)}</span>
                            </div>
                            {isSelected && <ChevronRight size={16} className="text-brand-400" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default Sidebar;
