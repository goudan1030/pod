import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import ModelList from './ModelList';
import { getCategories, getModels } from '../../data/mockData';
import { Category, ModelItem } from '../../types';
import { Settings } from 'lucide-react';

interface HomeLayoutProps {
    onSelectModel: (model: ModelItem) => void;
}

const HomeLayout: React.FC<HomeLayoutProps> = ({ onSelectModel }) => {
    const navigate = useNavigate();
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [categories, setCategories] = useState<Category[]>([]);
    const [models, setModels] = useState<ModelItem[]>([]);

    useEffect(() => {
        // Fetch data on mount
        const load = async () => {
            try {
                const cats = await getCategories();
                setCategories(cats);
                const mods = await getModels();
                setModels(mods);
            } catch (error) {
                console.error("Failed to load home data", error);
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
                        Admin Panel
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header Area */}
                <div className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 flex-none z-10">
                    <div className="flex items-center gap-3">
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                            {categories.find(c => c.id === selectedCategory)?.displayName || categories.find(c => c.id === selectedCategory)?.name || 'Models'}
                        </span>
                        <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-md font-medium">
                            {filteredModels.length} items
                        </span>
                    </div>

                    {/* Right side actions */}
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-gray-500">
                            Free Trial
                        </div>
                        <button className="bg-black text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors">
                            Upgrade
                        </button>
                    </div>
                </div>

                {/* Grid */}
                <ModelList models={filteredModels} onSelectModel={onSelectModel} />
            </div>
        </div>
    );
};

export default HomeLayout;
