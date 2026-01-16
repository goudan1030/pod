import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { storageService } from '../../src/services/storageService';
import { Category } from '../../types';

const CategoryManager: React.FC = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isAdding, setIsAdding] = useState(false);

    // New Category Form State
    const [newCatName, setNewCatName] = useState('');
    const [newCatDisplay, setNewCatDisplay] = useState('');

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        const cats = await storageService.getCategories();
        setCategories(cats);
    };

    const handleAdd = async () => {
        if (!newCatName || !newCatDisplay) return;

        const newCategory: Category = {
            id: newCatName.toLowerCase().replace(/\s+/g, '-'),
            name: newCatName.toLowerCase(), // Internal name
            displayName: newCatDisplay,
            icon: 'archive' // Default icon logic 
        };

        await storageService.addCategory(newCategory);
        await loadCategories();

        // Reset form
        setIsAdding(false);
        setNewCatName('');
        setNewCatDisplay('');
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this category? Models in this category may become orphaned.')) {
            await storageService.deleteCategory(id);
            await loadCategories();
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
                    <p className="text-gray-500 mt-1">Manage product categories for your catalog.</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition shadow-sm font-medium"
                >
                    <Plus size={18} />
                    Add Category
                </button>
            </div>

            {/* Add Form */}
            {isAdding && (
                <div className="mb-8 p-6 bg-white rounded-xl border border-brand-100 shadow-sm animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">New Category</h3>
                        <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ID / Internal Name</label>
                            <input
                                type="text"
                                placeholder="e.g. baseball-cap"
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Baseball Cap"
                                value={newCatDisplay}
                                onChange={(e) => setNewCatDisplay(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setIsAdding(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAdd}
                            disabled={!newCatName || !newCatDisplay}
                            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium"
                        >
                            Create Category
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="grid gap-4">
                {categories.map((cat) => (
                    <div key={cat.id} className="bg-white p-4 rounded-xl border border-gray-200 flex items-center justify-between hover:border-brand-200 hover:shadow-sm transition-all group">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                                {/* Future: Render dynamic icon */}
                                <span className="font-bold text-sm">{cat.displayName.charAt(0)}</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">{cat.displayName}</h3>
                                <p className="text-xs text-gray-500 font-mono">{cat.id}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                                <Edit2 size={18} />
                            </button>
                            <button
                                onClick={() => handleDelete(cat.id)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}

                {categories.length === 0 && (
                    <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                        No categories found. Create one to get started.
                    </div>
                )}
            </div>
        </div>
    );
};

export default CategoryManager;
