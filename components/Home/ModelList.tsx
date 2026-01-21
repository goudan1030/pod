import React, { Suspense } from 'react';
import { ModelItem } from '../../data/mockData';
import { Edit3, Box } from 'lucide-react';
import ModelPreview from './ModelPreview';
import { useLanguage } from '../../contexts/LanguageContext';

interface ModelListProps {
    models: ModelItem[];
    onSelectModel: (model: ModelItem) => void;
}

const ModelList: React.FC<ModelListProps> = ({ models, onSelectModel }) => {
    const { t } = useLanguage();
    return (
        <div className="flex-1 h-full overflow-y-auto bg-gray-50/50 p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {models.map((model) => (
                    <div
                        key={model.id}
                        className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-brand-100 hover:translate-y-[-4px] transition-all duration-300 overflow-hidden cursor-pointer"
                        onClick={() => onSelectModel(model)}
                    >
                        {/* 3D Preview Area */}
                        <div className="aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
                            {model.thumbnail ? (
                                <img
                                    src={model.thumbnail}
                                    alt={model.name}
                                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                                    <Box size={32} />
                                </div>
                            )}

                            {/* 3D Badge */}
                            <div className="absolute top-3 left-3 bg-white/90 backdrop-blur border border-gray-200 text-gray-500 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                <Box size={12} />
                                3D
                            </div>

                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]">
                                <button className="bg-white text-gray-900 px-6 py-2.5 rounded-full font-bold text-sm shadow-xl transform scale-90 group-hover:scale-100 transition-transform duration-300 hover:bg-brand-50 hover:text-brand-600 flex items-center gap-2">
                                    <Edit3 size={14} />
                                    {t('customize')}
                                </button>
                                <div className="bg-white/20 text-white px-4 py-1.5 rounded-full text-xs font-medium backdrop-blur-md">
                                    {t('clickToEdit')}
                                </div>
                            </div>
                        </div>

                        {/* Info Area */}
                        <div className="p-4 border-t border-gray-50">
                            <h3 className="font-bold text-gray-800 text-sm mb-1 group-hover:text-brand-600 transition-colors line-clamp-1">{model.name}</h3>
                            <div className="flex items-center gap-2 mt-2">
                                <div className="w-3 h-3 rounded-full bg-gray-200 border border-white shadow-sm ring-1 ring-gray-100"></div>
                                <div className="w-3 h-3 rounded-full bg-gray-300 border border-white shadow-sm ring-1 ring-gray-100"></div>
                                <div className="w-3 h-3 rounded-full bg-gray-400 border border-white shadow-sm ring-1 ring-gray-100"></div>
                                <span className="text-xs text-gray-400 ml-1">+2 {t('variants')}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Empty State if no models */}
                {models.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                        <Box size={48} strokeWidth={1} className="mb-4 text-gray-300" />
                        <p>{t('noModelsFound')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModelList;
