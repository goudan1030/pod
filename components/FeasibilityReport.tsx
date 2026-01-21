import React, { useEffect, useState } from 'react';
import { X, Check, Activity, Code2, BrainCircuit, Server, Zap } from 'lucide-react';
import { generateFeasibilityAnalysis } from '../services/geminiService';
import { FeasibilityItem } from '../types';

interface FeasibilityReportProps {
    isOpen: boolean;
    onClose: () => void;
}

const ReportCard: React.FC<{ item: FeasibilityItem; icon: React.ReactNode }> = ({ item, icon }) => (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors">
        <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2 text-brand-400">
                {icon}
                <h3 className="font-semibold text-sm">{item.title}</h3>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
                item.status === 'High' ? 'bg-green-900/50 text-green-400' :
                item.status === 'Medium' ? 'bg-yellow-900/50 text-yellow-400' :
                'bg-red-900/50 text-red-400'
            }`}>
                {item.status} 可行性
            </span>
        </div>
        <div className="w-full bg-gray-700 h-1.5 rounded-full mb-3">
            <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${item.score}%` }}></div>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">{item.description}</p>
    </div>
);

const FeasibilityReport: React.FC<FeasibilityReportProps> = ({ isOpen, onClose }) => {
    const [aiSummary, setAiSummary] = useState<string>("正在加载 AI 分析...");

    useEffect(() => {
        if (isOpen) {
            generateFeasibilityAnalysis().then(setAiSummary);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const reportItems: { item: FeasibilityItem, icon: React.ReactNode }[] = [
        {
            icon: <Code2 size={16} />,
            item: {
                title: "前端 3D 渲染 (WebGL)",
                score: 95,
                status: "High",
                description: "使用 Three.js 和 React Three Fiber 在浏览器中渲染包装模型非常成熟。性能足以应对常见的纸盒、瓶子等单一物体渲染，甚至支持复杂的光照和材质。"
            }
        },
        {
            icon: <BrainCircuit size={16} />,
            item: {
                title: "AI 贴图生成 (GenAI)",
                score: 90,
                status: "High",
                description: "Gemini 2.5 Flash Image 能够快速生成高质量的纹理素材。难点在于控制生成的图像无缝平铺以及准确的透视映射（UV Mapping），这需要结合 Canvas 2D 进行后期处理。"
            }
        },
        {
            icon: <Zap size={16} />,
            item: {
                title: "性能与体验",
                score: 85,
                status: "High",
                description: "现代浏览器对 WebGL 支持良好。只要不加载过大的外部 GLTF 模型（>20MB），加载速度可控。建议使用 DRACO 压缩模型或程序化几何体（Procedural Geometry）。"
            }
        },
        {
            icon: <Server size={16} />,
            item: {
                title: "后端与导出",
                score: 80,
                status: "Medium",
                description: "虽然前端展示容易，但要生成可印刷的 CMYK 高清 PDF 需要后端支持（如 Headless Chrome 或 Node-Canvas）。纯前端导出高清图仅限于 Web 展示用途。"
            }
        }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-dark-900 border border-white/20 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-dark-800">
                    <div>
                        <h2 className="text-xl font-bold text-white">技术可行性评估报告</h2>
                        <p className="text-xs text-gray-400 mt-1">项目代号: Teemdrop-Lite • 评估人: Senior Architect (AI)</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Executive Summary */}
                    <div className="bg-brand-900/20 border border-brand-500/20 rounded-lg p-4">
                        <h3 className="text-brand-400 text-sm font-bold mb-2 flex items-center gap-2">
                            <Activity size={16} /> 
                            老板，这是你要的评估结论：
                        </h3>
                        <div className="text-sm text-gray-300 space-y-2">
                            <p>仿制 Teemdrop 核心功能的<b>技术门槛中等偏低</b>，完全可行。</p>
                            <ul className="list-disc pl-5 space-y-1 text-gray-400 text-xs">
                                <li><b>核心技术栈</b>: React + Three.js 生态极其成熟。</li>
                                <li><b>成本优势</b>: 前端渲染降低服务器压力，AI 生成增加付费点。</li>
                                <li><b>风险点</b>: 复杂的异形包装 UV 展开需要专业 3D 建模师配合，单纯靠代码生成复杂 UV 较难。</li>
                            </ul>
                        </div>
                    </div>

                    {/* Detailed Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {reportItems.map((r, i) => (
                            <ReportCard key={i} item={r.item} icon={r.icon} />
                        ))}
                    </div>

                    {/* AI Generated Section */}
                    <div className="border-t border-white/10 pt-4">
                        <h3 className="text-xs uppercase font-bold text-gray-500 mb-2">Gemini 智能简报</h3>
                        <p className="text-xs text-gray-400 italic">
                            {aiSummary}
                        </p>
                    </div>
                </div>

                <div className="p-4 border-t border-white/10 bg-dark-800 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-white text-black text-sm font-semibold rounded hover:bg-gray-200 transition-colors"
                    >
                        关闭报告，开始开发
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FeasibilityReport;
