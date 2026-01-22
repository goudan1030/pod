import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import ModelList from './ModelList';
import { getCategories, getModels } from '../../data/mockData';
import { Category, ModelItem } from '../../types';
import { Settings, Languages } from 'lucide-react';
import { SidebarSkeleton, ModelListSkeleton } from './SkeletonLoader';
import { dataCache, CACHE_KEYS } from '../../utils/dataCache';
import { useLanguage } from '../../contexts/LanguageContext';

interface HomeLayoutProps {
    onSelectModel: (model: ModelItem) => void;
}

const HomeLayout: React.FC<HomeLayoutProps> = ({ onSelectModel }) => {
    const navigate = useNavigate();
    const { language, setLanguage, t } = useLanguage();
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [categories, setCategories] = useState<Category[]>([]);
    const [models, setModels] = useState<ModelItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        // Fetch data on mount with caching
        const load = async () => {
            setIsLoading(true);
            try {
                // Try to get from cache first
                const cachedCategories = dataCache.get<Category[]>(CACHE_KEYS.CATEGORIES);
                const cachedModels = dataCache.get<ModelItem[]>(CACHE_KEYS.MODELS);

                if (cachedCategories && cachedModels) {
                    // Use cached data
                    setCategories(cachedCategories);
                    setModels(cachedModels);
                    setIsLoading(false);
                } else {
                    // Fetch fresh data
                    const cats = await getCategories();
                    const mods = await getModels();

                    // Store in cache
                    dataCache.set(CACHE_KEYS.CATEGORIES, cats);
                    dataCache.set(CACHE_KEYS.MODELS, mods);

                    setCategories(cats);
                    setModels(mods);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Failed to load home data", error);
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const filteredModels = useMemo(() => {
        if (selectedCategory === 'all') {
            return models;
        }
        return models.filter(m => m.categoryId === selectedCategory);
    }, [selectedCategory, models]);

    return (
        <div className="flex h-screen w-screen bg-[#f8fafc] overflow-hidden font-sans">
            {/* Sidebar */}
            {isLoading ? (
                <SidebarSkeleton />
            ) : (
                <div className="flex-none z-20 shadow-xl shadow-gray-200/50 flex flex-col h-full bg-white">
                    <Sidebar
                        categories={categories}
                        selectedCategory={selectedCategory}
                        onSelectCategory={setSelectedCategory}
                    />

                    {/* Admin Link at bottom of Sidebar */}
                    <div className="p-4 border-t border-gray-100">
                        <button
                            onClick={() => navigate('/admin')}
                            className="flex items-center gap-3 w-full px-4 py-3 text-gray-500 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors text-sm font-medium"
                        >
                            <Settings size={18} />
                            {t('adminPanel')}
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header Area */}
                <div className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 flex-none z-10">
                    <div className="flex items-center gap-3">
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                            {selectedCategory === 'all' 
                                ? t('allModels') 
                                : (() => {
                                    // 优先使用 displayName（用户输入的友好名称）
                                    const category = categories.find(c => c.id === selectedCategory);
                                    if (category?.displayName) {
                                        return category.displayName;
                                    }
                                    // 如果 displayName 不存在，尝试翻译
                                    const translated = t(`category.${selectedCategory}`);
                                    // 如果翻译结果等于 key 本身，说明没找到翻译，使用 name 或 id
                                    return translated !== `category.${selectedCategory}` 
                                        ? translated 
                                        : (category?.name || selectedCategory);
                                })()}
                        </span>
                        <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-md font-medium">
                            {filteredModels.length} {t('items')}
                        </span>
                    </div>

                    {/* Right side actions */}
                    <div className="flex items-center gap-4">
                        {/* Language Toggle */}
                        <button
                            onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
                            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors text-sm font-medium"
                            title={language === 'zh' ? 'Switch to English' : '切换到中文'}
                        >
                            <Languages size={16} />
                            <span className="text-xs font-medium">{language === 'zh' ? 'EN' : '中'}</span>
                        </button>
                        
                        <div className="text-sm text-gray-500">
                            {t('freeTrial')}
                        </div>
                        <button className="bg-black text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors">
                            {t('upgrade')}
                        </button>
                    </div>
                </div>

                {/* Grid */}
                {isLoading ? (
                    <ModelListSkeleton count={8} />
                ) : (
                    <ModelList models={filteredModels} onSelectModel={onSelectModel} />
                )}
            </div>
        </div>
    );
};

export default HomeLayout;
