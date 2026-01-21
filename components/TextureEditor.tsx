import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { X, Layout, Upload, Undo2, Redo2, Trash2, MousePointer2, Hand, ZoomIn, ZoomOut, Move, Layers, GripVertical, Image as ImageIcon, Maximize, Palette, Check, Square, Plus, Filter, Type, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Package } from 'lucide-react';
import { PackagingState } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Canvas, useFrame } from '@react-three/fiber';
import { Center, OrbitControls, Environment } from '@react-three/drei';
import { PackagingMesh } from './Scene';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { extractSVGPathFromMesh } from '../utils/uvPipeline';

// --- Constants for SVG Shapes (Category-Specific) ---

// T-Shirt / Hoodie SVG Paths
const TSHIRT_SVG_PATHS: Record<string, { d: string, w: number, h: number }> = {
    // front: {
    //     d: "M0,185Q154,430.5,48.5,527L48.5,1502.5L1017,1502.5L1017,527Q902.5,436,1065,185Q850,58,754,0Q717,234.5,533,234.5Q351,241.5,311,0L0,185Z",
    //     w: 1065,
    //     h: 1502.5
    // },
    // back: {
    //     d: "M0,1502.5006L1060.5,1502.5006L1060.5,510.00049Q895.5,385.50586,1028,106.00307Q793,36.505859,692.5,0Q591,39.005859,525,39.005859Q436.5,39.005859,373.5,0L38,106.00391Q152,441.00586,0.5,510.00049Q0.5,641.00049,0,1502.5006Z",
    //     w: 1060.5,
    //     h: 1502.5
    // },
    // sleeve_l: {
    //     d: "M0,212L0,531L773,531L773,212C667.5,182,579.75,0,386.5,0C193.25,0,93.5,187,0,212Z",
    //     w: 773,
    //     h: 531
    // },
    // sleeve_r: {
    //     d: "M0,212L0,531L773,531L773,212C667.5,182,579.75,0,386.5,0C193.25,0,93.5,187,0,212Z",
    //     w: 773,
    //     h: 531
    // },
    // collar: {
    //     d: "M0,0L773,0L773,170L0,170Z",
    //     w: 773,
    //     h: 170
    // }
};

// Hat SVG Paths (5 regions based on your API data)
const HAT_SVG_PATHS: Record<string, { d: string, w: number, h: number }> = {
    // panel_1: {
    //     // First hat panel (arc shape)
    //     d: "M75,0 Q150,20 225,0 L200,320 L100,320 Z",
    //     w: 300,
    //     h: 320
    // },
    // panel_2: {
    //     // Second hat panel (arc shape)
    //     d: "M75,0 Q150,20 225,0 L200,320 L100,320 Z",
    //     w: 300,
    //     h: 320
    // },
    // panel_3: {
    //     // Third hat panel (arc shape)
    //     d: "M75,0 Q150,20 225,0 L200,320 L100,320 Z",
    //     w: 300,
    //     h: 320
    // },
    // brim_top: {
    //     // Hat brim top (curved arc)
    //     d: "M0,100 Q225,50 450,100 L450,200 Q225,150 0,200 Z",
    //     w: 450,
    //     h: 200
    // },
    // brim_bottom: {
    //     // Hat brim bottom (curved arc, slightly different)
    //     d: "M50,80 Q225,40 400,80 L400,160 Q225,120 50,160 Z",
    //     w: 450,
    //     h: 180
    // }
};

// Category to SVG Path mapping
const CATEGORY_SVG_PATHS: Record<string, Record<string, { d: string, w: number, h: number }>> = {
    'hat': HAT_SVG_PATHS,
    't-shirt': TSHIRT_SVG_PATHS,
    'hoodie': TSHIRT_SVG_PATHS, // Reuse t-shirt paths for hoodie
    // Add more categories as needed
};

// Fallback for T-shirt (mannequin mode)
const REGION_SVG_PATHS = TSHIRT_SVG_PATHS;

// 包装相关SVG素材
interface PackagingAsset {
    id: string;
    name: string;
    svg: string;
    width: number;
    height: number;
}

const PACKAGING_ASSETS: PackagingAsset[] = [
    {
        id: 'stack-limit',
        name: '堆叠限制',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><text x="50" y="40" font-size="40" font-weight="bold" text-anchor="middle" fill="#000">8</text><line x1="20" y1="60" x2="80" y2="60" stroke="#000" stroke-width="4"/><line x1="20" y1="70" x2="80" y2="70" stroke="#000" stroke-width="4"/></svg>',
        width: 100,
        height: 100
    },
    {
        id: 'handle-with-care',
        name: '小心轻放',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M30 20 L30 50 L20 50 L20 60 L50 60 L50 50 L40 50 L40 20 Z M60 20 L60 50 L50 50 L50 60 L80 60 L80 50 L70 50 L70 20 Z" fill="#000"/><rect x="25" y="65" width="50" height="25" fill="#000"/></svg>',
        width: 100,
        height: 100
    },
    {
        id: 'ce-mark',
        name: 'CE标记',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><text x="50" y="60" font-size="50" font-weight="bold" text-anchor="middle" fill="#000" font-family="Arial">CE</text></svg>',
        width: 100,
        height: 100
    },
    {
        id: 'recycle',
        name: '回收',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M50 20 L65 35 L50 50 M35 35 L50 50 L35 65 M50 50 L65 65 L50 80" stroke="#000" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M50 20 L35 35 M65 35 L50 50 M35 65 L50 80" stroke="#000" stroke-width="4" fill="none" stroke-linecap="round"/></svg>',
        width: 100,
        height: 100
    },
    {
        id: 'fsc',
        name: 'FSC认证',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M50 20 L40 50 L30 50 L45 65 L35 65 L50 80 L65 65 L55 65 L70 50 L60 50 Z" fill="#000"/><text x="50" y="90" font-size="12" text-anchor="middle" fill="#000">FSC</text></svg>',
        width: 100,
        height: 100
    },
    {
        id: 'do-not-litter',
        name: '请勿乱扔',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="35" r="15" fill="#000"/><rect x="40" y="50" width="20" height="30" fill="#000"/><rect x="35" y="50" width="30" height="5" fill="#000"/></svg>',
        width: 100,
        height: 100
    },
    {
        id: 'fragile',
        name: '易碎品',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="30" y="20" width="40" height="60" fill="none" stroke="#000" stroke-width="3"/><line x1="40" y1="30" x2="60" y2="30" stroke="#000" stroke-width="2"/><line x1="40" y1="40" x2="60" y2="40" stroke="#000" stroke-width="2"/><line x1="40" y1="50" x2="60" y2="50" stroke="#000" stroke-width="2"/><line x1="40" y1="60" x2="60" y2="60" stroke="#000" stroke-width="2"/><line x1="40" y1="70" x2="60" y2="70" stroke="#000" stroke-width="2"/></svg>',
        width: 100,
        height: 100
    },
    {
        id: 'flammable',
        name: '易燃',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M50 20 Q45 30 50 40 Q55 30 50 20 M45 35 Q50 45 45 55 Q40 45 45 35 M55 35 Q60 45 55 55 Q50 45 55 35" fill="#000"/><path d="M50 50 L50 80" stroke="#000" stroke-width="3" stroke-linecap="round"/></svg>',
        width: 100,
        height: 100
    },
    {
        id: 'temperature',
        name: '温度要求',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="35" y="20" width="10" height="50" fill="#000"/><circle cx="40" cy="75" r="8" fill="#000"/><text x="60" y="45" font-size="20" fill="#000">°C</text></svg>',
        width: 100,
        height: 100
    },
    {
        id: 'pet',
        name: 'PET',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M50 20 L65 35 L50 50 M35 35 L50 50 L35 65 M50 50 L65 65 L50 80" stroke="#000" stroke-width="4" fill="none" stroke-linecap="round"/><text x="50" y="70" font-size="20" text-anchor="middle" fill="#000">1</text><text x="50" y="95" font-size="12" text-anchor="middle" fill="#000">PETE</text></svg>',
        width: 100,
        height: 100
    },
    {
        id: 'hdpe',
        name: 'HDPE',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M50 20 L65 35 L50 50 M35 35 L50 50 L35 65 M50 50 L65 65 L50 80" stroke="#000" stroke-width="4" fill="none" stroke-linecap="round"/><text x="50" y="70" font-size="20" text-anchor="middle" fill="#000">2</text><text x="50" y="95" font-size="12" text-anchor="middle" fill="#000">HDPE</text></svg>',
        width: 100,
        height: 100
    },
    {
        id: 'pvc',
        name: 'PVC',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M50 20 L65 35 L50 50 M35 35 L50 50 L35 65 M50 50 L65 65 L50 80" stroke="#000" stroke-width="4" fill="none" stroke-linecap="round"/><text x="50" y="70" font-size="20" text-anchor="middle" fill="#000">3</text><text x="50" y="95" font-size="12" text-anchor="middle" fill="#000">PVC</text></svg>',
        width: 100,
        height: 100
    },
    {
        id: 'ldpe',
        name: 'LDPE',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M50 20 L65 35 L50 50 M35 35 L50 50 L35 65 M50 50 L65 65 L50 80" stroke="#000" stroke-width="4" fill="none" stroke-linecap="round"/><text x="50" y="70" font-size="20" text-anchor="middle" fill="#000">4</text><text x="50" y="95" font-size="12" text-anchor="middle" fill="#000">LDPE</text></svg>',
        width: 100,
        height: 100
    },
    {
        id: 'warning',
        name: '警告',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M50 20 L20 80 L80 80 Z" fill="#000"/><text x="50" y="65" font-size="30" font-weight="bold" text-anchor="middle" fill="#fff">!</text></svg>',
        width: 100,
        height: 100
    },
    {
        id: 'do-not-cut',
        name: '禁止切割',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M30 30 L70 70 M70 30 L30 70" stroke="#000" stroke-width="6" stroke-linecap="round"/><path d="M40 20 L50 30 L60 20" fill="#000"/></svg>',
        width: 100,
        height: 100
    }
];


// --- Types ---

interface Layer {
    id: string;
    type: 'image' | 'color' | 'text';
    src: string; // Image URL or Color Hex or Text Content
    imgElement: HTMLImageElement | null; // Null for color/text layers
    x: number; // Center X in Canvas Coordinates
    y: number; // Center Y in Canvas Coordinates
    width: number; // Original Width
    height: number; // Original Height
    rotation: number; // Degrees
    scale: number;
    textProps?: {
        fontSize?: number;
        fontFamily?: string;
        color?: string;
        fontWeight?: 'normal' | 'bold';
        fontStyle?: 'normal' | 'italic';
        textAlign?: 'left' | 'center' | 'right';
        textDecoration?: 'none' | 'underline' | 'line-through';
    };
}

interface Region {
    id: string;
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
    path?: string; // Optional SVG path for custom shapes
}

// UV Layout for auto-packing
interface UVLayout {
    partIndex: number;
    // Original UV bounds
    originalMinU: number;
    originalMaxU: number;
    originalMinV: number;
    originalMaxV: number;
    // Packed position on canvas (in pixels)
    packedX: number;
    packedY: number;
    packedW: number;
    packedH: number;
}

interface ViewportState {
    x: number; // Pan X
    y: number; // Pan Y
    scale: number; // Zoom Level
}

interface TextureEditorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (url: string, layers?: Layer[]) => void;
    initialImage: string | null;
    config: PackagingState;
    initialLayers?: Layer[];
}

// --- Helper: Color Picker Component ---
// 颜色按钮组件 - 第一步交互
const ColorButton: React.FC<{
    position: { x: number, y: number };
    onClick: () => void;
    onClose: () => void;
}> = ({ position, onClick, onClose }) => {
    return (
        <div
            className="absolute z-50 animate-in fade-in zoom-in-95 duration-200"
            style={{ left: position.x, top: position.y }}
            onMouseDown={e => e.stopPropagation()} // Prevent canvas drag
        >
            <button
                onClick={onClick}
                className="bg-white rounded-full px-4 py-2 shadow-lg border border-gray-200 hover:shadow-xl hover:border-brand-300 transition-all flex items-center gap-2 group"
            >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-400 via-yellow-400 via-green-400 to-blue-400 p-0.5">
                    <div className="w-full h-full rounded-full bg-white"></div>
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-brand-600">颜色</span>
            </button>
        </div>
    );
};

// 将十六进制颜色转换为HSV
const hexToHsv = (hex: string): { h: number; s: number; v: number } => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    let h = 0;
    if (delta !== 0) {
        if (max === r) {
            h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        } else if (max === g) {
            h = ((b - r) / delta + 2) / 6;
        } else {
            h = ((r - g) / delta + 4) / 6;
        }
    }
    
    const s = max === 0 ? 0 : delta / max;
    const v = max;
    
    return { h: h * 360, s: s * 100, v: v * 100 };
};

// 将HSV转换为十六进制颜色
const hsvToHex = (h: number, s: number, v: number): string => {
    s /= 100;
    v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    
    let r = 0, g = 0, b = 0;
    
    if (h >= 0 && h < 60) {
        r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
        r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
        r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
        r = x; g = 0; b = c;
    } else if (h >= 300 && h < 360) {
        r = c; g = 0; b = x;
    }
    
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

// 色块编辑工具栏组件
const ColorBlockEditorToolbar: React.FC<{
    layer: Layer;
    position: { x: number, y: number };
    onUpdate: (updates: { src?: string; width?: number; height?: number; rotation?: number; scale?: number }) => void;
    onClose: () => void;
}> = ({ layer, position, onUpdate, onClose }) => {
    return (
        <div
            className="absolute z-50 bg-white rounded-xl shadow-2xl border border-gray-100 p-3 animate-in fade-in zoom-in-95 duration-200"
            style={{ left: position.x, top: position.y }}
            onMouseDown={e => e.stopPropagation()}
        >
            <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">色块编辑</span>
                <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600"><X size={14} /></button>
            </div>

            {/* 颜色选择 */}
            <div className="mb-3">
                <div className="text-xs font-medium text-gray-700 mb-1.5">颜色</div>
                <div className="flex items-center gap-2">
                    <input
                        type="color"
                        value={layer.src}
                        onChange={(e) => onUpdate({ src: e.target.value })}
                        className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
                        title="颜色"
                    />
                    <input
                        type="text"
                        value={layer.src}
                        onChange={(e) => {
                            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                                onUpdate({ src: e.target.value });
                            }
                        }}
                        className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs font-mono focus:outline-none focus:border-brand-500 uppercase"
                        placeholder="#3b82f6"
                    />
                </div>
            </div>

            {/* 大小调整 */}
            <div className="mb-3">
                <div className="text-xs font-medium text-gray-700 mb-1.5">大小</div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">宽度</label>
                        <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2">
                            <button
                                onClick={() => onUpdate({ width: Math.max(10, (layer.width || 300) - 10) })}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <ZoomOut size={12} />
                            </button>
                            <input
                                type="number"
                                value={Math.round(layer.width || 300)}
                                onChange={(e) => onUpdate({ width: Math.max(10, parseInt(e.target.value) || 300) })}
                                className="w-16 text-center text-xs border-0 focus:outline-none"
                                min="10"
                            />
                            <button
                                onClick={() => onUpdate({ width: (layer.width || 300) + 10 })}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <ZoomIn size={12} />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">高度</label>
                        <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2">
                            <button
                                onClick={() => onUpdate({ height: Math.max(10, (layer.height || 300) - 10) })}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <ZoomOut size={12} />
                            </button>
                            <input
                                type="number"
                                value={Math.round(layer.height || 300)}
                                onChange={(e) => onUpdate({ height: Math.max(10, parseInt(e.target.value) || 300) })}
                                className="w-16 text-center text-xs border-0 focus:outline-none"
                                min="10"
                            />
                            <button
                                onClick={() => onUpdate({ height: (layer.height || 300) + 10 })}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <ZoomIn size={12} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 旋转 */}
            <div>
                <div className="text-xs font-medium text-gray-700 mb-1.5">旋转</div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onUpdate({ rotation: ((layer.rotation || 0) - 15) % 360 })}
                        className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 text-gray-600"
                        title="逆时针旋转15度"
                    >
                        <Undo2 size={14} />
                    </button>
                    <input
                        type="number"
                        value={Math.round(layer.rotation || 0)}
                        onChange={(e) => onUpdate({ rotation: parseInt(e.target.value) || 0 })}
                        className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs text-center focus:outline-none focus:border-brand-500"
                        placeholder="0"
                    />
                    <span className="text-xs text-gray-500">°</span>
                    <button
                        onClick={() => onUpdate({ rotation: ((layer.rotation || 0) + 15) % 360 })}
                        className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 text-gray-600"
                        title="顺时针旋转15度"
                    >
                        <Redo2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// 文字编辑工具栏组件
const TextEditorToolbar: React.FC<{
    layer: Layer;
    position: { x: number, y: number };
    onUpdate: (updates: Partial<Layer['textProps']> & { src?: string }) => void;
    onClose: () => void;
}> = ({ layer, position, onUpdate, onClose }) => {
    const textProps = layer.textProps || {
        fontSize: 24,
        fontFamily: 'Arial',
        color: '#000000',
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'center',
        textDecoration: 'none',
    };

    const commonFonts = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS', 'Impact'];

    return (
        <div
            className="absolute z-50 bg-white rounded-xl shadow-2xl border border-gray-100 p-3 animate-in fade-in zoom-in-95 duration-200"
            style={{ left: position.x, top: position.y }}
            onMouseDown={e => e.stopPropagation()}
        >
            <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">文字编辑</span>
                <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600"><X size={14} /></button>
            </div>

            {/* 文字内容输入 */}
            <div className="mb-3">
                <input
                    type="text"
                    value={layer.src || '文字'}
                    onChange={(e) => onUpdate({ src: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-500"
                    placeholder="在这输入文字"
                />
            </div>

            {/* 字体和大小 */}
            <div className="flex gap-2 mb-3">
                <select
                    value={textProps.fontFamily || 'Arial'}
                    onChange={(e) => onUpdate({ fontFamily: e.target.value })}
                    className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-500"
                >
                    {commonFonts.map(font => (
                        <option key={font} value={font}>{font}</option>
                    ))}
                </select>
                <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2">
                    <button
                        onClick={() => onUpdate({ fontSize: Math.max(8, (textProps.fontSize || 24) - 1) })}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        <ZoomOut size={12} />
                    </button>
                    <input
                        type="number"
                        value={textProps.fontSize || 24}
                        onChange={(e) => onUpdate({ fontSize: Math.max(8, Math.min(200, parseInt(e.target.value) || 24)) })}
                        className="w-12 text-center text-xs border-0 focus:outline-none"
                        min="8"
                        max="200"
                    />
                    <button
                        onClick={() => onUpdate({ fontSize: Math.min(200, (textProps.fontSize || 24) + 1) })}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        <ZoomIn size={12} />
                    </button>
                </div>
            </div>

            {/* 样式按钮 */}
            <div className="flex items-center gap-1 mb-3 p-1 bg-gray-50 rounded-lg">
                <button
                    onClick={() => onUpdate({ fontWeight: textProps.fontWeight === 'bold' ? 'normal' : 'bold' })}
                    className={`p-1.5 rounded transition-colors ${textProps.fontWeight === 'bold' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-600 hover:bg-white'}`}
                    title="粗体"
                >
                    <Bold size={14} />
                </button>
                <button
                    onClick={() => onUpdate({ fontStyle: textProps.fontStyle === 'italic' ? 'normal' : 'italic' })}
                    className={`p-1.5 rounded transition-colors ${textProps.fontStyle === 'italic' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-600 hover:bg-white'}`}
                    title="斜体"
                >
                    <Italic size={14} />
                </button>
                <button
                    onClick={() => onUpdate({ textDecoration: textProps.textDecoration === 'underline' ? 'none' : 'underline' })}
                    className={`p-1.5 rounded transition-colors ${textProps.textDecoration === 'underline' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-600 hover:bg-white'}`}
                    title="下划线"
                >
                    <Underline size={14} />
                </button>
                <div className="w-px h-4 bg-gray-300 mx-1"></div>
                <button
                    onClick={() => onUpdate({ textAlign: 'left' })}
                    className={`p-1.5 rounded transition-colors ${textProps.textAlign === 'left' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-600 hover:bg-white'}`}
                    title="左对齐"
                >
                    <AlignLeft size={14} />
                </button>
                <button
                    onClick={() => onUpdate({ textAlign: 'center' })}
                    className={`p-1.5 rounded transition-colors ${textProps.textAlign === 'center' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-600 hover:bg-white'}`}
                    title="居中"
                >
                    <AlignCenter size={14} />
                </button>
                <button
                    onClick={() => onUpdate({ textAlign: 'right' })}
                    className={`p-1.5 rounded transition-colors ${textProps.textAlign === 'right' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-600 hover:bg-white'}`}
                    title="右对齐"
                >
                    <AlignRight size={14} />
                </button>
            </div>

            {/* 颜色选择 */}
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={textProps.color || '#000000'}
                    onChange={(e) => onUpdate({ color: e.target.value })}
                    className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                    title="文字颜色"
                />
                <input
                    type="text"
                    value={textProps.color || '#000000'}
                    onChange={(e) => {
                        if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                            onUpdate({ color: e.target.value });
                        }
                    }}
                    className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs font-mono focus:outline-none focus:border-brand-500 uppercase"
                    placeholder="#000000"
                />
            </div>
        </div>
    );
};

const ColorPickerPopup: React.FC<{
    color: string | null;
    onChange: (c: string | null) => void;
    position: { x: number, y: number };
    onClose: () => void;
}> = ({ color, onChange, position, onClose }) => {
    const defaultColor = '#ffffff';
    const currentColor = color || defaultColor;
    const [hsv, setHsv] = useState(() => hexToHsv(currentColor));
    const [hex, setHex] = useState(currentColor);
    const [isDragging, setIsDragging] = useState<'hue' | 'saturation' | null>(null);

    useEffect(() => {
        if (color) {
            const newHsv = hexToHsv(color);
            setHsv(newHsv);
            setHex(color);
        } else {
            setHsv(hexToHsv(defaultColor));
            setHex(defaultColor);
        }
    }, [color]);

    const updateColor = (newHsv: { h: number; s: number; v: number }) => {
        setHsv(newHsv);
        const newHex = hsvToHex(newHsv.h, newHsv.s, newHsv.v);
        setHex(newHex);
        onChange(newHex);
    };

    const handleSaturationBrightnessClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        updateColor({ ...hsv, s: Math.max(0, Math.min(100, x * 100)), v: Math.max(0, Math.min(100, (1 - y) * 100)) });
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging === 'saturation') {
                const element = document.elementFromPoint(e.clientX, e.clientY);
                const picker = element?.closest('[data-saturation-picker]') as HTMLElement;
                if (picker) {
                    const rect = picker.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / rect.width;
                    const y = (e.clientY - rect.top) / rect.height;
                    updateColor({ ...hsv, s: Math.max(0, Math.min(100, x * 100)), v: Math.max(0, Math.min(100, (1 - y) * 100)) });
                }
            } else if (isDragging === 'hue') {
                const element = document.elementFromPoint(e.clientX, e.clientY);
                const picker = element?.closest('[data-hue-picker]') as HTMLElement;
                if (picker) {
                    const rect = picker.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / rect.width;
                    updateColor({ ...hsv, h: Math.max(0, Math.min(360, x * 360)) });
                }
            }
        };

        const handleMouseUp = () => {
            setIsDragging(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, hsv]);

    const handleHueClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        updateColor({ ...hsv, h: Math.max(0, Math.min(360, x * 360)) });
    };

    const handleHueDrag = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isDragging === 'hue') {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            updateColor({ ...hsv, h: Math.max(0, Math.min(360, x * 360)) });
        }
    };

    const handleHexChange = (val: string) => {
        setHex(val);
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            const newHsv = hexToHsv(val);
            setHsv(newHsv);
            onChange(val);
        }
    };

    // 生成色相渐变色
    const hueGradient = 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)';
    // 生成当前色相的饱和度和亮度渐变
    // 水平：从白色到当前色相的全饱和颜色
    // 垂直：从当前颜色到黑色
    const currentHueColor = hsvToHex(hsv.h, 100, 100);
    const saturationBrightnessGradient = {
        background: `linear-gradient(to bottom, transparent, #000000), linear-gradient(to right, #ffffff, ${currentHueColor})`
    };

    return (
        <div
            className="absolute z-50 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 w-72 animate-in fade-in zoom-in-95 duration-200"
            style={{ left: position.x, top: position.y }}
            onMouseDown={e => e.stopPropagation()}
        >
            <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">FACE COLOR</span>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
            </div>

            {/* Transparent Option */}
            <div className="mb-3">
                <div className="text-xs font-medium text-gray-700 mb-1.5">透明</div>
                <button
                    onClick={() => onChange(null)}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all relative ${!color ? 'border-brand-500 ring-2 ring-brand-100' : 'border-gray-200 hover:border-gray-300'}`}
                >
                    {!color && <Check size={14} className="text-brand-600" />}
                    <div className="absolute inset-0 rounded-full opacity-30" style={{ backgroundImage: 'repeating-conic-gradient(#000 0% 25%, #fff 0% 50%)', backgroundSize: '4px 4px' }}></div>
                </button>
            </div>

            <div className="h-px bg-gray-200 mb-3"></div>

            {/* Color Selection */}
            <div className="mb-3">
                <div className="text-xs font-medium text-gray-700 mb-1.5">颜色</div>
                
                {/* Saturation and Brightness Picker */}
                <div
                    data-saturation-picker
                    className="relative w-full h-32 rounded-lg overflow-hidden cursor-crosshair mb-2 border border-gray-200"
                    style={saturationBrightnessGradient}
                    onClick={handleSaturationBrightnessClick}
                    onMouseDown={(e) => {
                        setIsDragging('saturation');
                        handleSaturationBrightnessClick(e);
                    }}
                >
                    <div
                        className="absolute w-3 h-3 rounded-full border-2 border-white shadow-lg pointer-events-none z-10"
                        style={{
                            left: `${hsv.s}%`,
                            top: `${100 - hsv.v}%`,
                            transform: 'translate(-50%, -50%)'
                        }}
                    />
                </div>

                {/* Hue Slider */}
                <div
                    data-hue-picker
                    className="relative w-full h-4 rounded cursor-pointer mb-2 border border-gray-200"
                    style={{ background: hueGradient }}
                    onClick={handleHueClick}
                    onMouseDown={(e) => {
                        setIsDragging('hue');
                        handleHueClick(e);
                    }}
                >
                    <div
                        className="absolute w-3 h-3 rounded-full border-2 border-white shadow-lg pointer-events-none top-1/2 z-10"
                        style={{
                            left: `${(hsv.h / 360) * 100}%`,
                            transform: 'translate(-50%, -50%)'
                        }}
                    />
                </div>

                {/* Color Preview and Hex Input */}
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: hex }}></div>
                    <input
                        type="text"
                        value={hex.toUpperCase()}
                        onChange={(e) => handleHexChange(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-md px-2 py-1.5 text-xs font-mono text-gray-600 focus:outline-none focus:border-brand-500 uppercase"
                        placeholder="#FFFFFF"
                    />
                </div>
            </div>
        </div>
    );
};

// --- Optimized PreviewScene ---
const PreviewScene: React.FC<{ config: PackagingState; canvasRef: React.RefObject<HTMLCanvasElement | null>; version: number }> = ({ config, canvasRef, version }) => {
    const [canvasTexture, setCanvasTexture] = useState<THREE.CanvasTexture | null>(null);

    useEffect(() => {
        let tex: THREE.CanvasTexture | null = null;
        if (canvasRef.current) {
            tex = new THREE.CanvasTexture(canvasRef.current);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = 16;
            tex.flipY = true; // Canvas Y-axis is inverted, need to flip
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            setCanvasTexture(tex);
        }
        // Cleanup texture on unmount or update to prevent GPU memory leaks
        return () => {
            if (tex) tex.dispose();
        };
    }, [version, canvasRef]);

    useFrame(() => {
        if (canvasTexture) canvasTexture.needsUpdate = true;
    });

    return (
        <React.Suspense fallback={null}>
            <color attach="background" args={['#f3f4f6']} />
            {/* Natural lighting environment */}
            <Environment preset="city" />

            {/* Subtle balanced lights */}
            <ambientLight intensity={0.4} />
            {/* <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow shadow-mapSize={[1024, 1024]} /> */}
            <directionalLight position={[-5, 5, 5]} intensity={0.3} />
            <Center>
                <PackagingMesh config={{ ...config, textureUrl: null }} overrideTexture={canvasTexture} />
            </Center>
            <OrbitControls 
                makeDefault 
                minPolarAngle={0} 
                maxPolarAngle={Math.PI} 
                enablePan={true} 
                enableZoom={true} 
                autoRotate={false}
                minDistance={40}
                maxDistance={80}
                target={[0, 0, 0]}
            />
        </React.Suspense>
    );
};

const TextureEditor: React.FC<TextureEditorProps> = ({ isOpen, onClose, onSave, initialImage, config, initialLayers }) => {
    const { language, t } = useLanguage();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const uiCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // -- State --
    const [layers, setLayers] = useState<Layer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    
    // 撤销/重做历史记录
    const [history, setHistory] = useState<Layer[][]>([[]]); // 历史记录栈
    const [historyIndex, setHistoryIndex] = useState(0); // 当前历史记录索引
    const isUndoRedoRef = useRef(false); // 标记是否正在执行撤销/重做，避免循环保存历史
    const [activePanel, setActivePanel] = useState<'upload' | 'layers' | 'assets'>('upload');
    const [uvMode, setUvMode] = useState<'database' | 'custom'>('database'); // UV 模式：database = 使用数据库 SVG region

    interface UploadedImage {
        id: string;
        src: string;
        name?: string;
        createdAt: number;
    }
    const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
    const draggingLayerIdRef = useRef<string | null>(null);
    const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
    const [insertPosition, setInsertPosition] = useState<'above' | 'below' | null>(null);

    // Face/Region Colors
    const [faceColors, setFaceColors] = useState<Record<string, string | null>>({});
    const [activeFaceId, setActiveFaceId] = useState<string | null>(null);
    const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
    const [colorPickerPos, setColorPickerPos] = useState<{ x: number, y: number } | null>(null);
    const [showColorButton, setShowColorButton] = useState<{ regionId: string; position: { x: number, y: number } } | null>(null);
    const [textEditorPos, setTextEditorPos] = useState<{ x: number, y: number } | null>(null);
    const [colorBlockEditorPos, setColorBlockEditorPos] = useState<{ x: number, y: number } | null>(null);

    // Custom Model Data
    const [customUVs, setCustomUVs] = useState<Float32Array[]>([]);
    // Store named parts from the GLB with their boundary edges
    const [customParts, setCustomParts] = useState<{ name: string; uvs: Float32Array; boundaries: Float32Array }[]>([]);
    // Store UV layout mapping (for auto-packing)
    const [customPartsLayout, setCustomPartsLayout] = useState<UVLayout[]>([]);
    // Store dynamic SVG paths for custom models
    const [dynamicPaths, setDynamicPaths] = useState<Record<string, { d: string, w: number, h: number }>>({});
    const [uvMeshData, setUvMeshData] = useState<{
        uvs: Float32Array;
        positions: Float32Array;
        indices: Uint32Array | Uint16Array | Uint8Array | null;
    } | null>(null);
    const [uvWireframe, setUvWireframe] = useState<Float32Array | null>(null);
    const [isLoadingUVs, setIsLoadingUVs] = useState(false);
    const [previewVersion, setPreviewVersion] = useState(0);
    const [cursorStyle, setCursorStyle] = useState('default');

    // Viewport State (Infinite Canvas)
    const [view, setView] = useState<ViewportState>({ x: 0, y: 0, scale: 0.4 }); // Start zoomed out slightly

    // Interaction State
    const interactionRef = useRef<{
        mode: 'none' | 'pan' | 'move_layer' | 'rotate_layer' | 'scale_layer';
        startMouse: { x: number; y: number }; // Screen Coords
        startView: ViewportState;
        startLayer: Layer | null;
        activeHandle?: string; // 'tl', 'tr', 'bl', 'br', 'rot'
        historySaved?: boolean; // 标记是否已保存操作开始时的历史
    }>({
        mode: 'none',
        startMouse: { x: 0, y: 0 },
        startView: { x: 0, y: 0, scale: 1 },
        startLayer: null,
        historySaved: false
    });

    // -- Config & Init --

    const canvasConfig = useMemo(() => {
        switch (config.shape) {
            case 'mannequin':
            case 'custom': return { width: 2048, height: 1024 };
            case 'bottle':
            case 'can': return { width: 2048, height: 1024 };
            default: return { width: 1024, height: 1024 };
        }
    }, [config.shape]);

    /**
     * 从 custom 模型的 UV 中生成多个区域
     * 这里采用「按 UV 网格聚类」的策略：
     * - 先把 UV 点落到一个固定分辨率的网格上（例如 64x64）
     * - 然后对网格里连续占用的格子做连通块分析，得到多个 UV 岛
     * 好处：复杂度近似 O(N)，比暴力 O(N^2) 聚类可靠很多。
     */
    const customUvIslands = useMemo(() => {
        if (!customUVs.length) return [];

        type Island = { minU: number; maxU: number; minV: number; maxV: number };
        const islands: Island[] = [];

        // 网格分辨率，越大越精细；提高到 128 以避免相邻大块被误连
        const GRID = 128;
        // 进入连通块时的最小占用阈值，避免“单点细线”把两块误连
        const MIN_COUNT = 2;

        // 记录哪些网格单元被 UV 点占用了，以及这个单元里的 UV 范围
        const cellBounds = new Map<string, Island & { count: number }>();

        customUVs.forEach(uvData => {
            for (let i = 0; i + 1 < uvData.length; i += 2) {
                const uRaw = uvData[i];
                const vRaw = uvData[i + 1];
                if (!Number.isFinite(uRaw) || !Number.isFinite(vRaw)) continue;

                // UV 理论范围是 0-1，但有些模型会略微越界，这里 clamp 一下
                const u = Math.min(1, Math.max(0, uRaw));
                const v = Math.min(1, Math.max(0, vRaw));

                const gx = Math.floor(u * (GRID - 1));
                const gy = Math.floor(v * (GRID - 1));
                const key = `${gx},${gy}`;

                const existed = cellBounds.get(key);
                if (existed) {
                    existed.minU = Math.min(existed.minU, u);
                    existed.maxU = Math.max(existed.maxU, u);
                    existed.minV = Math.min(existed.minV, v);
                    existed.maxV = Math.max(existed.maxV, v);
                    existed.count += 1;
                } else {
                    cellBounds.set(key, { minU: u, maxU: u, minV: v, maxV: v, count: 1 });
                }
            }
        });

        if (!cellBounds.size) return [];

        // 在网格上做连通块（4 邻接），把相邻的 cell 聚成一个 UV 岛
        const visited = new Set<string>();
        const directions = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ];

        for (const [key, bounds] of cellBounds.entries()) {
            if (visited.has(key)) continue;

            const [startGX, startGY] = key.split(',').map(Number);
            let queue: Array<[number, number]> = [[startGX, startGY]];
            visited.add(key);

            let islandMinU = bounds.minU;
            let islandMaxU = bounds.maxU;
            let islandMinV = bounds.minV;
            let islandMaxV = bounds.maxV;

            while (queue.length) {
                const [cx, cy] = queue.pop()!;

                for (const [dx, dy] of directions) {
                    const nx = cx + dx;
                    const ny = cy + dy;
                    if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
                    const nKey = `${nx},${ny}`;
                    if (visited.has(nKey)) continue;
                    const cell = cellBounds.get(nKey);
                    if (!cell || cell.count < MIN_COUNT) continue;

                    visited.add(nKey);
                    queue.push([nx, ny]);

                    islandMinU = Math.min(islandMinU, cell.minU);
                    islandMaxU = Math.max(islandMaxU, cell.maxU);
                    islandMinV = Math.min(islandMinV, cell.minV);
                    islandMaxV = Math.max(islandMaxV, cell.maxV);
                }
            }

            const area = (islandMaxU - islandMinU) * (islandMaxV - islandMinV);
            // 过滤非常小的噪点
            if (area > 0.001) {
                islands.push({ minU: islandMinU, maxU: islandMaxU, minV: islandMinV, maxV: islandMaxV });
            }
        }

        return islands;
    }, [customUVs]);
    console.log('customUvIslands', customUvIslands);



    // 解析 SVG 路径的边界框（bounding box）
    const getPathBounds = useCallback((pathData: string): { x: number; y: number; width: number; height: number } => {
        try {
            // 优先使用 SVG DOM API 获取精确的边界框（支持所有路径类型，包括曲线）
            if (typeof document !== 'undefined') {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                // 设置足够大的 viewBox 以确保路径不被裁剪
                svg.setAttribute('viewBox', '0 0 10000 10000');
                svg.setAttribute('width', '10000');
                svg.setAttribute('height', '10000');
                svg.style.position = 'absolute';
                svg.style.visibility = 'hidden';
                svg.style.width = '0';
                svg.style.height = '0';
                
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', pathData);
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

            // 回退方法：使用 Canvas API 测量路径
            try {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = 4096;
                tempCanvas.height = 4096;
                const tempCtx = tempCanvas.getContext('2d');
                if (tempCtx) {
                    const path = new Path2D(pathData);
                    // 使用 isPointInPath 来估算边界（采样方法）
                    // 更简单：直接使用路径的近似边界
                    const bounds = tempCtx.isPointInPath(path, 0, 0) ? { minX: 0, minY: 0, maxX: 4096, maxY: 4096 } : null;
                    
                    // 如果 Canvas API 不可靠，回退到解析坐标点
                    if (!bounds) {
                        const coords: number[] = [];
                        const numberPattern = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
                        const matches = pathData.match(numberPattern);
                        
                        if (matches) {
                            const numbers = matches.map(Number).filter(n => !isNaN(n));
                            for (let i = 0; i < numbers.length; i += 2) {
                                if (i + 1 < numbers.length) {
                                    coords.push(numbers[i], numbers[i + 1]);
                                }
                            }
                        }
                        
                        if (coords.length === 0) {
                            return { x: 0, y: 0, width: 100, height: 100 };
                        }

                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        for (let i = 0; i < coords.length; i += 2) {
                            const x = coords[i];
                            const y = coords[i + 1];
                            minX = Math.min(minX, x);
                            minY = Math.min(minY, y);
                            maxX = Math.max(maxX, x);
                            maxY = Math.max(maxY, y);
                        }

                        return {
                            x: minX,
                            y: minY,
                            width: maxX - minX || 100,
                            height: maxY - minY || 100
                        };
                    }
                }
            } catch (e) {
                console.warn('Canvas bounds calculation failed:', e);
            }

            // 最终回退
            return { x: 0, y: 0, width: 100, height: 100 };
        } catch (e) {
            console.warn('Failed to parse path bounds:', e);
            return { x: 0, y: 0, width: 100, height: 100 };
        }
    }, []);

    // Define Clickable Regions based on dynamic SVG paths or fallback to single canvas region
    const getRegions = useCallback((w: number, h: number): Region[] => {
        // 根据 UV 模式选择数据源
        if (uvMode === 'database') {
            // 使用数据库中的 SVG region（config.dynamicSVGPaths）
            const dynamic = config.dynamicSVGPaths || {};
            const dynamicKeys = Object.keys(dynamic);

            if (dynamicKeys.length > 0) {
                // 获取 SVG 的原始画布尺寸（所有路径共享同一个画布）
                const firstPath = dynamic[dynamicKeys[0]];
                const svgCanvasWidth = firstPath?.w || w;
                const svgCanvasHeight = firstPath?.h || h;

                // 计算缩放比例：将 SVG 坐标系统映射到实际画布
                const scaleX = w / svgCanvasWidth;
                const scaleY = h / svgCanvasHeight;

                const result: Region[] = [];
                dynamicKeys.forEach((key) => {
                    const pathData = dynamic[key];
                    if (!pathData || !pathData.d) return;

                    // 解析路径的边界框，获取其在 SVG 坐标系统中的实际位置和尺寸
                    const bounds = getPathBounds(pathData.d);
                    
                    // 将 SVG 坐标映射到画布坐标
                    const regionX = bounds.x * scaleX;
                    const regionY = bounds.y * scaleY;
                    const regionW = bounds.width * scaleX;
                    const regionH = bounds.height * scaleY;

                    result.push({
                        id: key,
                        label: pathData.label || key,
                        x: regionX,
                        y: regionY,
                        w: regionW,
                        h: regionH
                    });
                });
                return result;
            }
        } else if (uvMode === 'custom') {
            // 未来可以支持自定义 UV 模式（例如从 GLB 提取的 UV）
            // 暂时回退到默认
        }

        // 默认：整个画布一个区域
        return [{
            id: 'canvas_root',
            label: 'Canvas',
            x: 0,
            y: 0,
            w: w,
            h: h
        }];
    }, [config.dynamicSVGPaths, uvMode, getPathBounds]);

    const regions = useMemo(() => getRegions(canvasConfig.width, canvasConfig.height), [getRegions, canvasConfig]);
    console.log('regions', regions);
    
    // Actions
    const fitToScreen = useCallback(() => {
        if (containerRef.current) {
            const cw = containerRef.current.clientWidth;
            const ch = containerRef.current.clientHeight;
            const scaleX = (cw - 100) / canvasConfig.width;
            const scaleY = (ch - 100) / canvasConfig.height;
            const newScale = Math.min(scaleX, scaleY, 0.9);
            setView({
                x: (cw - canvasConfig.width * newScale) / 2,
                y: (ch - canvasConfig.height * newScale) / 2,
                scale: newScale
            });
        }
    }, [canvasConfig]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(fitToScreen, 10);
            // 确保编辑器打开时立即触发一次渲染
            setPreviewVersion(v => v + 1);
        }
    }, [isOpen, fitToScreen]);

    // Initialize all regions with default white background
    useEffect(() => {
        if (regions.length > 0 && Object.keys(faceColors).length === 0) {
            const initialColors: Record<string, string> = {};
            regions.forEach(region => {
                initialColors[region.id] = '#ffffff'; // Default white background
            });
            setFaceColors(initialColors);
            setPreviewVersion(v => v + 1); // Trigger re-render
        }
    }, [regions, faceColors]);

    // 保存历史记录
    const saveHistory = useCallback((newLayers: Layer[]) => {
        if (isUndoRedoRef.current) return; // 如果正在执行撤销/重做，不保存历史
        
        setHistory(prev => {
            // 移除当前索引之后的所有历史记录（如果有重做历史）
            const newHistory = prev.slice(0, historyIndex + 1);
            // 添加新的历史记录
            newHistory.push(newLayers.map(l => ({ ...l, imgElement: null }))); // 移除不能序列化的imgElement
            // 限制历史记录数量（最多50条）
            if (newHistory.length > 50) {
                newHistory.shift();
            }
            return newHistory;
        });
        
        // 更新索引
        setHistoryIndex(prev => {
            const newIndex = prev + 1;
            // 如果历史记录被截断，调整索引
            return newIndex >= 50 ? 49 : newIndex;
        });
    }, [historyIndex]);

    // 更新layers并保存历史
    const updateLayersWithHistory = useCallback((updater: (prev: Layer[]) => Layer[]) => {
        setLayers(prev => {
            const newLayers = updater(prev);
            saveHistory(newLayers);
            return newLayers;
        });
        setPreviewVersion(v => v + 1);
    }, [saveHistory]);

    // 从历史记录恢复图层（包括重新加载图片）
    const restoreLayersFromHistory = useCallback((historyLayers: Layer[]) => {
        const nonImageLayers = historyLayers.filter(l => l.type !== 'image');
        const imageLayers = historyLayers.filter(l => l.type === 'image' && l.src);
        
        if (imageLayers.length === 0) {
            // 没有图片图层，直接恢复
            setLayers(historyLayers);
            setPreviewVersion(v => v + 1);
            return;
        }
        
        // 异步加载图片
        const restoredLayers: Layer[] = [...nonImageLayers];
        let loadedCount = 0;
        
        imageLayers.forEach(layer => {
            const img = new Image();
            img.src = layer.src;
            img.onload = () => {
                restoredLayers.push({ ...layer, imgElement: img } as Layer);
                loadedCount++;
                if (loadedCount === imageLayers.length) {
                    setLayers(restoredLayers);
                    setPreviewVersion(v => v + 1);
                }
            };
            img.onerror = () => {
                restoredLayers.push(layer as Layer);
                loadedCount++;
                if (loadedCount === imageLayers.length) {
                    setLayers(restoredLayers);
                    setPreviewVersion(v => v + 1);
                }
            };
        });
    }, []);

    // 撤销
    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            isUndoRedoRef.current = true;
            const newIndex = historyIndex - 1;
            const historyLayers = history[newIndex];
            
            restoreLayersFromHistory(historyLayers);
            setHistoryIndex(newIndex);
            
            setTimeout(() => {
                isUndoRedoRef.current = false;
            }, 100);
        }
    }, [history, historyIndex, restoreLayersFromHistory]);

    // 重做
    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            isUndoRedoRef.current = true;
            const newIndex = historyIndex + 1;
            const historyLayers = history[newIndex];
            
            restoreLayersFromHistory(historyLayers);
            setHistoryIndex(newIndex);
            
            setTimeout(() => {
                isUndoRedoRef.current = false;
            }, 100);
        }
    }, [history, historyIndex, restoreLayersFromHistory]);

    // 初始化历史记录
    useEffect(() => {
        if (layers.length === 0 && history.length === 1 && history[0].length === 0) {
            // 初始化时保存空状态
            setHistory([[]]);
            setHistoryIndex(0);
        }
    }, []);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            
            // 撤销 (Ctrl+Z 或 Cmd+Z)
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
                return;
            }
            
            // 重做 (Ctrl+Shift+Z 或 Cmd+Shift+Z 或 Ctrl+Y)
            if (((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) || 
                ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
                e.preventDefault();
                handleRedo();
                return;
            }
            
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLayerId) {
                updateLayersWithHistory(prev => prev.filter(l => l.id !== selectedLayerId));
                setSelectedLayerId(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selectedLayerId, handleUndo, handleRedo, updateLayersWithHistory]);

    // Load Custom UVs
    useEffect(() => {
        if (config.shape === 'custom' && config.customModelUrl) {
            setIsLoadingUVs(true);
            const loader = new GLTFLoader();
            loader.load(config.customModelUrl, (gltf) => {
                const allUvs: Float32Array[] = [];
                const parts: { name: string; uvs: Float32Array; boundaries: Float32Array; svgData?: any }[] = [];
                const newDynamicPaths: Record<string, { d: string, w: number, h: number }> = {};
                let targetMesh: THREE.Mesh | null = null;

                // Helper to extract UVs
                const getUVs = (mesh: THREE.Mesh) => {
                    const uvAttr = mesh.geometry.getAttribute('uv');
                    const idxAttr = mesh.geometry.getIndex();
                    let uvData: Float32Array | null = null;

                    if (uvAttr) {
                        if (idxAttr) {
                            uvData = new Float32Array(idxAttr.count * 2);
                            for (let i = 0; i < idxAttr.count; i++) {
                                const idx = idxAttr.getX(i);
                                uvData[i * 2] = uvAttr.getX(idx);
                                uvData[i * 2 + 1] = uvAttr.getY(idx);
                            }
                        } else {
                            uvData = uvAttr.array as Float32Array;
                        }
                    }
                    return uvData;
                };

                const buildUvWireframe = (
                    uvAttr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
                    indexAttr: THREE.BufferAttribute | null
                ) => {
                    const segments: number[] = [];
                    const edgeSet = new Set<string>();
                    const PRE = 10000;
                    const keyPoint = (u: number, v: number) => `${Math.round(u * PRE)}_${Math.round(v * PRE)}`;
                    const keyEdge = (u1: number, v1: number, u2: number, v2: number) => {
                        const k1 = keyPoint(u1, v1);
                        const k2 = keyPoint(u2, v2);
                        return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
                    };
                    const addEdge = (a: number, b: number) => {
                        const u1 = uvAttr.getX(a);
                        const v1 = uvAttr.getY(a);
                        const u2 = uvAttr.getX(b);
                        const v2 = uvAttr.getY(b);
                        const key = keyEdge(u1, v1, u2, v2);
                        if (edgeSet.has(key)) return;
                        edgeSet.add(key);
                        segments.push(u1, v1, u2, v2);
                    };
                    const count = indexAttr ? indexAttr.count : uvAttr.count;
                    for (let i = 0; i < count; i += 3) {
                        const a = indexAttr ? indexAttr.getX(i) : i;
                        const b = indexAttr ? indexAttr.getX(i + 1) : i + 1;
                        const c = indexAttr ? indexAttr.getX(i + 2) : i + 2;
                        addEdge(a, b);
                        addEdge(b, c);
                        addEdge(c, a);
                    }
                    return new Float32Array(segments);
                };

                // Helper: Calculate Boundary Edges (edges used only once)
                const getBoundaryEdges = (uvs: Float32Array): Float32Array => {
                    const edges = new Map<string, number>();
                    const PRE = 10000; // Precision for hashing (handling float drift)

                    // Helper to create edge key
                    const hashIdx = (u: number, v: number) => `${Math.round(u * PRE)}_${Math.round(v * PRE)}`;
                    const edgeKey = (u1: number, v1: number, u2: number, v2: number) => {
                        const h1 = hashIdx(u1, v1);
                        const h2 = hashIdx(u2, v2);
                        return h1 < h2 ? `${h1}|${h2}` : `${h2}|${h1}`;
                    };

                    // 1. Count edge occurrences
                    for (let i = 0; i < uvs.length; i += 6) {
                        // Triangle vertices: (0,1), (2,3), (4,5)
                        const k1 = edgeKey(uvs[i], uvs[i + 1], uvs[i + 2], uvs[i + 3]);
                        const k2 = edgeKey(uvs[i + 2], uvs[i + 3], uvs[i + 4], uvs[i + 5]);
                        const k3 = edgeKey(uvs[i + 4], uvs[i + 5], uvs[i], uvs[i + 1]);

                        edges.set(k1, (edges.get(k1) || 0) + 1);
                        edges.set(k2, (edges.get(k2) || 0) + 1);
                        edges.set(k3, (edges.get(k3) || 0) + 1);
                    }

                    // 2. Collect boundary edges (count === 1)
                    const boundarySegments: number[] = [];

                    // We need to reconstruct coordinates from keys?
                    // Or better: Iterate triangles again and check counts.
                    // Re-iteration is safer to retrieve exact float values.

                    for (let i = 0; i < uvs.length; i += 6) {
                        const checkEdge = (uA: number, vA: number, uB: number, vB: number) => {
                            const key = edgeKey(uA, vA, uB, vB);
                            if (edges.get(key) === 1) {
                                boundarySegments.push(uA, vA, uB, vB);
                            }
                        };

                        checkEdge(uvs[i], uvs[i + 1], uvs[i + 2], uvs[i + 3]);
                        checkEdge(uvs[i + 2], uvs[i + 3], uvs[i + 4], uvs[i + 5]);
                        checkEdge(uvs[i + 4], uvs[i + 5], uvs[i], uvs[i + 1]);
                    }

                    return new Float32Array(boundarySegments);
                };

                gltf.scene.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        const mesh = child as THREE.Mesh;
                        if (mesh.name === '贴图') {
                            targetMesh = mesh;
                        }
                    }
                });

                const processMesh = (mesh: THREE.Mesh) => {
                    const uvData = getUVs(mesh);
                    if (!uvData || uvData.length < 18) return;
                    let minU = 1, maxU = 0, minV = 1, maxV = 0;
                    for (let i = 0; i < uvData.length; i += 2) {
                        const u = uvData[i];
                        const v = uvData[i + 1];
                        if (Number.isFinite(u) && Number.isFinite(v)) {
                            minU = Math.min(minU, u);
                            maxU = Math.max(maxU, u);
                            minV = Math.min(minV, v);
                            maxV = Math.max(maxV, v);
                        }
                    }
                    const uvArea = (maxU - minU) * (maxV - minV);
                    const vertexCount = uvData.length / 2;
                    const isSignificant = uvArea > 0.01 || vertexCount > 1000;
                    if (!isSignificant) return;
                    allUvs.push(uvData);
                    if (mesh.name) {
                        const svgInfo = extractSVGPathFromMesh(mesh);
                        if (svgInfo) {
                            newDynamicPaths[mesh.name] = {
                                d: svgInfo.d,
                                w: svgInfo.width,
                                h: svgInfo.height
                            };
                        }
                        const boundsArr = getBoundaryEdges(uvData);
                        if (boundsArr.length > 0 || svgInfo) {
                            parts.push({
                                name: mesh.name,
                                uvs: uvData,
                                boundaries: boundsArr,
                                svgData: svgInfo
                            });
                        }
                    }
                };

                if (targetMesh) {
                    const uvAttr = targetMesh.geometry.getAttribute('uv');
                    const positionAttr = targetMesh.geometry.getAttribute('position');
                    const indexAttr = targetMesh.geometry.getIndex();
                    if (uvAttr && positionAttr) {
                        setUvMeshData({
                            uvs: uvAttr.array as Float32Array,
                            positions: positionAttr.array as Float32Array,
                            indices: indexAttr ? (indexAttr.array as Uint32Array | Uint16Array | Uint8Array) : null
                        });
                        setUvWireframe(buildUvWireframe(uvAttr, indexAttr));
                    } else {
                        setUvMeshData(null);
                        setUvWireframe(null);
                    }
                    processMesh(targetMesh);
                } else {
                    setUvMeshData(null);
                    setUvWireframe(null);
                    gltf.scene.traverse((child) => {
                        if ((child as THREE.Mesh).isMesh) {
                            const mesh = child as THREE.Mesh;
                            processMesh(mesh);
                        }
                    });
                }

                // Traverse entire scene graph
                if (parts.length === 0) {
                    setIsLoadingUVs(false);
                    return;
                }

                // Removed auto-packing logic since we now use a single canvas approach.
                // We keep customParts state but layouts are no longer used for region generation.
                const enhancedLayouts: UVLayout[] = [];

                setCustomUVs(allUvs);
                setCustomParts(parts);
                setCustomPartsLayout(enhancedLayouts);
                setDynamicPaths(newDynamicPaths);
                setIsLoadingUVs(false);
            });
        }
    }, [config.customModelUrl, config.shape]);

    // 加载初始图层数据
    useEffect(() => {
        if (initialLayers && initialLayers.length > 0 && layers.length === 0) {
            // 恢复图层数据
            const restoredLayers: Layer[] = [];
            const restoredImages: UploadedImage[] = [];
            const imageLayers: typeof initialLayers = [];
            const nonImageLayers: typeof initialLayers = [];
            
            // 分离图片图层和非图片图层
            initialLayers.forEach(layer => {
                if (layer.type === 'image' && layer.src) {
                    imageLayers.push(layer);
                } else {
                    nonImageLayers.push(layer);
                }
            });
            
            // 先添加非图片图层
            if (nonImageLayers.length > 0) {
                restoredLayers.push(...nonImageLayers as Layer[]);
            }
            
            // 异步加载图片图层
            if (imageLayers.length > 0) {
                // 先设置非图片图层，让它们立即显示
                if (restoredLayers.length > 0) {
                    setLayers([...restoredLayers]);
                    setPreviewVersion(v => v + 1);
                }
                
                let loadedCount = 0;
                imageLayers.forEach(layer => {
                    const img = new Image();
                    img.src = layer.src;
                    img.onload = () => {
                        const restoredLayer: Layer = {
                            ...layer,
                            imgElement: img,
                        } as Layer;
                        
                        // 添加到已上传图片列表
                        if (!restoredImages.find(img => img.src === layer.src)) {
                            restoredImages.push({
                                id: crypto.randomUUID(),
                                src: layer.src,
                                name: `图片 ${restoredImages.length + 1}`,
                                createdAt: Date.now()
                            });
                        }
                        
                        loadedCount++;
                        
                        // 每次图片加载完成都更新图层列表，让已加载的图片立即显示
                        setLayers(prev => {
                            // 移除可能存在的旧图层（避免重复）
                            const filtered = prev.filter(l => l.id !== layer.id);
                            // 添加新加载的图层
                            return [...filtered, restoredLayer];
                        });
                        
                        // 立即触发画布重新渲染
                        setPreviewVersion(v => v + 1);
                        
                        // 当所有图片图层加载完成后，更新已上传图片列表
                        if (loadedCount === imageLayers.length) {
                            setUploadedImages(restoredImages);
                        }
                    };
                    img.onerror = () => {
                        // 如果图片加载失败，仍然添加图层（使用src作为fallback）
                        loadedCount++;
                        
                        setLayers(prev => {
                            const filtered = prev.filter(l => l.id !== layer.id);
                            return [...filtered, layer as Layer];
                        });
                        
                        // 立即触发画布重新渲染
                        setPreviewVersion(v => v + 1);
                        
                        if (loadedCount === imageLayers.length) {
                            setUploadedImages(restoredImages);
                            // 初始化历史记录（仅在首次加载时，所有图片加载完成后）
                            // 使用setLayers的回调获取最新的layers状态
                            setLayers(currentLayers => {
                                if (history.length === 1 && history[0].length === 0) {
                                    // 延迟保存，确保状态已更新
                                    setTimeout(() => {
                                        isUndoRedoRef.current = false; // 确保可以保存
                                        saveHistory(currentLayers);
                                    }, 0);
                                }
                                return currentLayers;
                            });
                        }
                    };
                });
            } else {
                // 如果没有图片图层，直接设置
                setLayers(restoredLayers);
                // 立即触发画布重新渲染
                setPreviewVersion(v => v + 1);
                // 初始化历史记录（仅在首次加载时）
                if (history.length === 1 && history[0].length === 0) {
                    // 延迟保存，确保状态已更新
                    setTimeout(() => {
                        isUndoRedoRef.current = false; // 确保可以保存
                        saveHistory(restoredLayers);
                    }, 0);
                }
            }
        } else if (initialImage && uploadedImages.length === 0 && layers.length === 0 && !initialLayers) {
            // 兼容旧逻辑：如果有初始图片但没有图层数据，使用旧方式
            const id = crypto.randomUUID();
            setUploadedImages([{ id, src: initialImage, name: '初始图片', createdAt: Date.now() }]);
            addLayer(initialImage);
        }
    }, [initialLayers, initialImage]);

    const addLayer = (src: string) => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            const newLayer: Layer = {
                id: crypto.randomUUID(),
                type: 'image',
                src,
                imgElement: img,
                x: canvasConfig.width / 2,
                y: canvasConfig.height / 2,
                width: img.width,
                height: img.height,
                rotation: 0,
                scale: Math.min(500 / img.width, 1),
            };
            updateLayersWithHistory(prev => [...prev, newLayer]);
            setSelectedLayerId(newLayer.id);
        };
    };

    // 将SVG字符串转换为data URL，并设置明确的尺寸
    const svgToDataUrl = (svg: string, width: number, height: number): string => {
        // 确保SVG有明确的width和height属性
        let svgWithSize = svg;
        if (!svg.includes('width=') || !svg.includes('height=')) {
            svgWithSize = svg.replace('<svg', `<svg width="${width}" height="${height}"`);
        }
        const blob = new Blob([svgWithSize], { type: 'image/svg+xml' });
        return URL.createObjectURL(blob);
    };

    // 添加包装素材到画布
    const handleAddAsset = (asset: PackagingAsset) => {
        const dataUrl = svgToDataUrl(asset.svg, asset.width, asset.height);
        const img = new Image();
        // 设置明确的尺寸，确保SVG按预期大小渲染
        img.width = asset.width;
        img.height = asset.height;
        img.src = dataUrl;
        img.onload = () => {
            // 使用asset定义的尺寸，而不是img的实际尺寸（SVG可能渲染很大）
            // 计算合适的缩放比例，使素材大小适中（约100-150像素）
            const targetSize = 120;
            const scale = targetSize / Math.max(asset.width, asset.height);
            
            const newLayer: Layer = {
                id: crypto.randomUUID(),
                type: 'image',
                src: dataUrl,
                imgElement: img,
                x: canvasConfig.width / 2,
                y: canvasConfig.height / 2,
                width: asset.width,
                height: asset.height,
                rotation: 0,
                scale: scale,
            };
            updateLayersWithHistory(prev => [...prev, newLayer]);
            setSelectedLayerId(newLayer.id);
        };
    };

    const addColorBlock = () => {
        const size = 300;
        const newLayer: Layer = {
            id: crypto.randomUUID(),
            type: 'color',
            src: '#3b82f6',
            imgElement: null,
            x: canvasConfig.width / 2,
            y: canvasConfig.height / 2,
            width: size,
            height: size,
            rotation: 0,
            scale: 1,
        };
        updateLayersWithHistory(prev => [...prev, newLayer]);
        setSelectedLayerId(newLayer.id);
    };

    const addTextBlock = () => {
        const textProps = {
            fontSize: 24,
            fontFamily: 'Arial',
            color: '#000000',
            fontWeight: 'normal' as const,
            fontStyle: 'normal' as const,
            textAlign: 'center' as const,
            textDecoration: 'none' as const,
        };
        
        // 计算文字的实际大小
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        let textWidth = 200;
        let textHeight = 50;
        
        if (tempCtx) {
            tempCtx.font = `${textProps.fontStyle} ${textProps.fontWeight} ${textProps.fontSize}px ${textProps.fontFamily}`;
            const text = '文字';
            const metrics = tempCtx.measureText(text);
            textWidth = metrics.width;
            textHeight = textProps.fontSize * 1.2;
        }
        
        const newLayer: Layer = {
            id: crypto.randomUUID(),
            type: 'text',
            src: '文字',
            imgElement: null,
            x: canvasConfig.width / 2,
            y: canvasConfig.height / 2,
            width: textWidth,
            height: textHeight,
            rotation: 0,
            scale: 1,
            textProps,
        };
        updateLayersWithHistory(prev => [...prev, newLayer]);
        setSelectedLayerId(newLayer.id);
    };

    const updateColorLayer = (id: string, color: string) => {
        updateLayersWithHistory(prev => prev.map(l => l.id === id ? { ...l, src: color } : l));
    };

    const updateColorBlockLayer = (id: string, updates: { src?: string; width?: number; height?: number; rotation?: number; scale?: number }) => {
        updateLayersWithHistory(prev => prev.map(l => {
            if (l.id === id && l.type === 'color') {
                return {
                    ...l,
                    ...updates,
                };
            }
            return l;
        }));
    };

    const updateTextLayer = (id: string, updates: Partial<Layer['textProps']> & { src?: string }) => {
        updateLayersWithHistory(prev => prev.map(l => {
            if (l.id === id && l.type === 'text') {
                const newTextProps = {
                    ...l.textProps,
                    ...updates,
                };
                const newSrc = updates.src !== undefined ? updates.src : l.src;
                
                // 计算文字的实际大小并更新图层尺寸
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                let newWidth = l.width;
                let newHeight = l.height;
                
                if (tempCtx) {
                    const fontWeight = newTextProps.fontWeight || 'normal';
                    const fontStyle = newTextProps.fontStyle || 'normal';
                    const fontSize = newTextProps.fontSize || 24;
                    const fontFamily = newTextProps.fontFamily || 'Arial';
                    tempCtx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
                    
                    const text = newSrc || '文字';
                    const metrics = tempCtx.measureText(text);
                    newWidth = metrics.width;
                    newHeight = fontSize * 1.2;
                }
                
                return {
                    ...l,
                    src: newSrc,
                    width: newWidth,
                    height: newHeight,
                    textProps: newTextProps,
                };
            }
            return l;
        }));
    };

    // Math helpers...
    const screenToCanvas = (sx: number, sy: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const relX = sx - rect.left - view.x;
        const relY = sy - rect.top - view.y;
        return { x: relX / view.scale, y: relY / view.scale };
    };

    const rotatePoint = (x: number, y: number, cx: number, cy: number, angleDeg: number) => {
        const rad = (angleDeg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const dx = x - cx;
        const dy = y - cy;
        return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
    };

    const isPointInRotatedRect = (px: number, py: number, layer: Layer) => {
        const p = rotatePoint(px, py, layer.x, layer.y, -layer.rotation);
        let w = layer.width * layer.scale;
        let h = layer.height * layer.scale;
        
        // 对于文字图层，根据文字实际大小计算尺寸
        if (layer.type === 'text') {
            const textProps = layer.textProps || {
                fontSize: 24,
                fontFamily: 'Arial',
                fontWeight: 'normal',
                fontStyle: 'normal',
            };
            
            // 创建临时canvas来测量文字
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
                const fontWeight = textProps.fontWeight || 'normal';
                const fontStyle = textProps.fontStyle || 'normal';
                const fontSize = textProps.fontSize || 24;
                const fontFamily = textProps.fontFamily || 'Arial';
                tempCtx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
                
                const text = layer.src || '文字';
                const metrics = tempCtx.measureText(text);
                const textWidth = metrics.width;
                const textHeight = fontSize * 1.2;
                
                w = textWidth * layer.scale;
                h = textHeight * layer.scale;
            }
        }
        
        return p.x >= layer.x - w / 2 && p.x <= layer.x + w / 2 &&
            p.y >= layer.y - h / 2 && p.y <= layer.y + h / 2;
    };

    // --- Render Logic (Split into Content and UI) ---

    // Helper: Check if a point is inside a region (using SVG path if available)
    const isPointInRegion = (x: number, y: number, region: Region): boolean => {
        // 先检查是否在矩形边界框内
        if (x < region.x || x > region.x + region.w || y < region.y || y > region.y + region.h) {
            return false;
        }

        // 如果有对应的 SVG 路径，使用路径来精确检测
        const pathData = config.dynamicSVGPaths?.[region.id];
        if (pathData && pathData.d) {
            try {
                // 获取 SVG 画布的原始尺寸
                const svgCanvasWidth = pathData.w || canvasConfig.width;
                const svgCanvasHeight = pathData.h || canvasConfig.height;
                
                // 将画布坐标转换回 SVG 坐标
                const scaleX = svgCanvasWidth / canvasConfig.width;
                const scaleY = svgCanvasHeight / canvasConfig.height;
                const svgX = x * scaleX;
                const svgY = y * scaleY;
                
                // 使用 Canvas API 检测点是否在路径内
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = svgCanvasWidth;
                tempCanvas.height = svgCanvasHeight;
                const tempCtx = tempCanvas.getContext('2d');
                if (tempCtx) {
                    const path = new Path2D(pathData.d);
                    return tempCtx.isPointInPath(path, svgX, svgY);
                }
            } catch (e) {
                console.warn('Failed to check point in SVG path:', e);
            }
        }

        // 回退到矩形检测
        return true;
    };

    // Helper: Get region for a layer (which region does this layer belong to)
    const getLayerRegion = (layer: Layer): Region | null => {
        // Check center point of layer
        const centerX = layer.x;
        const centerY = layer.y;

        // Find the region that contains this layer's center
        for (const region of regions) {
            if (isPointInRegion(centerX, centerY, region)) {
                return region;
            }
        }
        return null;
    };

    // 1. Render Content (The actual texture for the model)
    const renderContent = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Get category-specific SVG paths
        const category = config.category || 'custom';
        const categoryPaths = CATEGORY_SVG_PATHS[category] || REGION_SVG_PATHS;
        // console.log(categoryPaths, '9999');

        // Render each region independently
        regions.forEach(region => {
            ctx.save();

            // 1. Set Shape Clipping
            // Prioritize paths from config (loaded in App.tsx)
            const configDynamicPath = config.dynamicSVGPaths?.[region.id];
            const localDynamicPath = dynamicPaths[region.id];
            const staticPath = categoryPaths[region.id];
            // console.log(staticPath, region.id);
            const isTshirtShape = config.shape === 'mannequin' || category === 't-shirt' || category === 'hoodie';

            let pathToUse = null;
            if (configDynamicPath) {
                pathToUse = configDynamicPath;
            } else if (config.shape === 'custom' && localDynamicPath) {
                pathToUse = localDynamicPath;
            } else if (staticPath) {
                pathToUse = staticPath;
            }

            if (pathToUse) {
                // 获取 SVG 画布的原始尺寸
                const svgCanvasWidth = pathToUse.w || canvasConfig.width;
                const svgCanvasHeight = pathToUse.h || canvasConfig.height;
                
                // SVG 路径的坐标是相对于 SVG 画布的
                // 如果 SVG 画布尺寸和我们的画布尺寸相同，路径坐标可以直接使用
                // 如果不同，需要缩放路径坐标到画布坐标
                const scaleX = canvasConfig.width / svgCanvasWidth;
                const scaleY = canvasConfig.height / svgCanvasHeight;
                
                // 创建路径并应用 clip（不 restore，保持 clip 状态用于后续图层绘制）
                const p = new Path2D(pathToUse.d);
                
                // 如果尺寸不同，需要缩放路径
                if (scaleX !== 1 || scaleY !== 1) {
                    ctx.scale(scaleX, scaleY);
                    ctx.clip(p);
                    // 填充背景（在缩放后的 SVG 坐标系中）- 默认白色
                    ctx.fillStyle = faceColors[region.id] || '#ffffff';
                    ctx.fillRect(0, 0, svgCanvasWidth, svgCanvasHeight);
                } else {
                    // 尺寸相同，直接使用路径坐标
                    ctx.clip(p);
                    // 填充背景（在画布坐标系中）- 默认白色
                    ctx.fillStyle = faceColors[region.id] || '#ffffff';
                    ctx.fillRect(0, 0, canvasConfig.width, canvasConfig.height);
                }
            } else {
                ctx.beginPath();
                if (isTshirtShape || category === 'hat') {
                    const radius = Math.min(region.w, region.h) * 0.1;
                    ctx.roundRect(region.x, region.y, region.w, region.h, radius);
                } else {
                    ctx.rect(region.x, region.y, region.w, region.h);
                }
                ctx.clip();
                // 默认白色填充
                ctx.fillStyle = faceColors[region.id] || '#ffffff';
                ctx.fillRect(region.x, region.y, region.w, region.h);
            }

            // 2. Render Layers belonging to this region
            // 注意：此时 clip 状态已经应用，transform 可能已经缩放（如果 pathToUse 存在且尺寸不同）
            layers.forEach(layer => {
                const layerRegion = getLayerRegion(layer);
                if (layerRegion && layerRegion.id === region.id) {
                    ctx.save();
                    
                    // 计算缩放比例（如果存在）
                    let scaleX = 1;
                    let scaleY = 1;
                    if (pathToUse) {
                        const svgCanvasWidth = pathToUse.w || canvasConfig.width;
                        const svgCanvasHeight = pathToUse.h || canvasConfig.height;
                        scaleX = canvasConfig.width / svgCanvasWidth;
                        scaleY = canvasConfig.height / svgCanvasHeight;
                    }
                    
                    // 图层坐标始终在画布坐标系中
                    // 如果上面应用了缩放（scaleX, scaleY），需要将图层坐标转换到缩放后的空间
                    if (pathToUse && (scaleX !== 1 || scaleY !== 1)) {
                        // 当前 transform 已经是 scale(scaleX, scaleY)
                        // 所以图层坐标需要除以缩放比例
                        ctx.translate(layer.x / scaleX, layer.y / scaleY);
                    } else {
                        // 坐标系统相同，直接使用
                        ctx.translate(layer.x, layer.y);
                    }
                    
                    ctx.rotate((layer.rotation * Math.PI) / 180);
                    ctx.scale(layer.scale, layer.scale);

                    // 如果应用了SVG缩放，图层的尺寸也需要相应缩放
                    // 因为当前坐标系已经被scale(scaleX, scaleY)缩放，所以需要将图层尺寸除以缩放比例
                    const layerWidth = pathToUse && (scaleX !== 1 || scaleY !== 1) ? layer.width / scaleX : layer.width;
                    const layerHeight = pathToUse && (scaleX !== 1 || scaleY !== 1) ? layer.height / scaleY : layer.height;

                    if (layer.type === 'color') {
                        ctx.fillStyle = layer.src;
                        ctx.fillRect(-layerWidth / 2, -layerHeight / 2, layerWidth, layerHeight);
                    } else if (layer.type === 'text') {
                        const textProps = layer.textProps || { 
                            fontSize: 24, 
                            fontFamily: 'Arial', 
                            color: '#000000',
                            fontWeight: 'normal',
                            fontStyle: 'normal',
                            textAlign: 'center',
                            textDecoration: 'none',
                        };
                        ctx.fillStyle = textProps.color || '#000000';
                        ctx.strokeStyle = textProps.color || '#000000';
                        
                        // 构建字体字符串
                        const fontWeight = textProps.fontWeight || 'normal';
                        const fontStyle = textProps.fontStyle || 'normal';
                        // 字体大小也需要缩放
                        const fontSize = (pathToUse && (scaleX !== 1 || scaleY !== 1)) 
                            ? (textProps.fontSize || 24) / Math.min(scaleX, scaleY)
                            : (textProps.fontSize || 24);
                        const fontFamily = textProps.fontFamily || 'Arial';
                        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
                        
                        // 设置文本对齐
                        const textAlign = textProps.textAlign || 'center';
                        ctx.textAlign = textAlign === 'left' ? 'left' : textAlign === 'right' ? 'right' : 'center';
                        ctx.textBaseline = 'middle';
                        
                        const text = layer.src || '文字';
                        const x = textAlign === 'left' ? -layerWidth / 2 : textAlign === 'right' ? layerWidth / 2 : 0;
                        
                        // 绘制文本
                        if (textProps.textDecoration === 'underline') {
                            ctx.fillText(text, x, 0);
                            const metrics = ctx.measureText(text);
                            ctx.beginPath();
                            ctx.moveTo(x - (textAlign === 'center' ? metrics.width / 2 : textAlign === 'right' ? metrics.width : 0), fontSize / 3);
                            ctx.lineTo(x + (textAlign === 'center' ? metrics.width / 2 : textAlign === 'left' ? metrics.width : 0), fontSize / 3);
                            ctx.stroke();
                        } else if (textProps.textDecoration === 'line-through') {
                            ctx.fillText(text, x, 0);
                            const metrics = ctx.measureText(text);
                            ctx.beginPath();
                            ctx.moveTo(x - (textAlign === 'center' ? metrics.width / 2 : textAlign === 'right' ? metrics.width : 0), 0);
                            ctx.lineTo(x + (textAlign === 'center' ? metrics.width / 2 : textAlign === 'left' ? metrics.width : 0), 0);
                            ctx.stroke();
                        } else {
                            ctx.fillText(text, x, 0);
                        }
                    } else if (layer.imgElement) {
                        // 由于SVG区域的ctx.scale(scaleX, scaleY)仍然有效，
                        // 而我们已经将layerWidth和layerHeight除以了scaleX/scaleY，
                        // 所以drawImage的尺寸参数应该使用layerWidth和layerHeight
                        // 这样经过scaleX/scaleY缩放后，会得到正确的尺寸
                        ctx.drawImage(
                            layer.imgElement, 
                            -layerWidth / 2, 
                            -layerHeight / 2,
                            layerWidth,
                            layerHeight
                        );
                    }
                    ctx.restore();
                }
            });

            ctx.restore();
        });

        // Render layers that don't belong to any region (fallback)
        layers.forEach(layer => {
            const layerRegion = getLayerRegion(layer);
            if (!layerRegion) {
                ctx.save();
                ctx.translate(layer.x, layer.y);
                ctx.rotate((layer.rotation * Math.PI) / 180);
                ctx.scale(layer.scale, layer.scale);

                if (layer.type === 'color') {
                    ctx.fillStyle = layer.src;
                    ctx.fillRect(-layer.width / 2, -layer.height / 2, layer.width, layer.height);
                } else if (layer.type === 'text') {
                    const textProps = layer.textProps || { 
                        fontSize: 24, 
                        fontFamily: 'Arial', 
                        color: '#000000',
                        fontWeight: 'normal',
                        fontStyle: 'normal',
                        textAlign: 'center',
                        textDecoration: 'none',
                    };
                    ctx.fillStyle = textProps.color || '#000000';
                    ctx.strokeStyle = textProps.color || '#000000';
                    
                    // 构建字体字符串
                    const fontWeight = textProps.fontWeight || 'normal';
                    const fontStyle = textProps.fontStyle || 'normal';
                    const fontSize = textProps.fontSize || 24;
                    const fontFamily = textProps.fontFamily || 'Arial';
                    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
                    
                    // 设置文本对齐
                    const textAlign = textProps.textAlign || 'center';
                    ctx.textAlign = textAlign === 'left' ? 'left' : textAlign === 'right' ? 'right' : 'center';
                    ctx.textBaseline = 'middle';
                    
                    const text = layer.src || '文字';
                    const x = textAlign === 'left' ? -layer.width / 2 : textAlign === 'right' ? layer.width / 2 : 0;
                    
                    // 绘制文本
                    if (textProps.textDecoration === 'underline') {
                        ctx.fillText(text, x, 0);
                        const metrics = ctx.measureText(text);
                        ctx.beginPath();
                        ctx.moveTo(x - (textAlign === 'center' ? metrics.width / 2 : textAlign === 'right' ? metrics.width : 0), fontSize / 3);
                        ctx.lineTo(x + (textAlign === 'center' ? metrics.width / 2 : textAlign === 'left' ? metrics.width : 0), fontSize / 3);
                        ctx.stroke();
                    } else if (textProps.textDecoration === 'line-through') {
                        ctx.fillText(text, x, 0);
                        const metrics = ctx.measureText(text);
                        ctx.beginPath();
                        ctx.moveTo(x - (textAlign === 'center' ? metrics.width / 2 : textAlign === 'right' ? metrics.width : 0), 0);
                        ctx.lineTo(x + (textAlign === 'center' ? metrics.width / 2 : textAlign === 'left' ? metrics.width : 0), 0);
                        ctx.stroke();
                    } else {
                        ctx.fillText(text, x, 0);
                    }
                } else if (layer.imgElement) {
                    ctx.drawImage(layer.imgElement, -layer.width / 2, -layer.height / 2);
                }
                ctx.restore();
            }
        });

    }, [layers, config.color, config.shape, config.category, regions, faceColors, canvasConfig]);

    // 2. Render UI (Overlays, Guides, Gizmos - NOT on the model)
    const renderUI = useCallback(() => {
        const canvas = uiCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 只在 custom UV 模式下显示从 GLB 提取的 UV wireframe
        // SVG 模式（database）使用 SVG 路径，不需要显示 GLB 的 UV 网格
        if (uvMode === 'custom' && uvWireframe) {
            ctx.save();
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.lineWidth = 1 / view.scale;
            ctx.beginPath();
            for (let i = 0; i < uvWireframe.length; i += 4) {
                const x1 = uvWireframe[i] * canvasConfig.width;
                const y1 = (1 - uvWireframe[i + 1]) * canvasConfig.height;
                const x2 = uvWireframe[i + 2] * canvasConfig.width;
                const y2 = (1 - uvWireframe[i + 3]) * canvasConfig.height;
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
            }
            ctx.stroke();
            ctx.restore();
        }

        // Region borders removed for cleaner preview

        // Gizmos (Selection Box)
        if (selectedLayerId) {
            const layer = layers.find(l => l.id === selectedLayerId);
            if (layer) {
                let w = layer.width * layer.scale;
                let h = layer.height * layer.scale;
                
                // 对于文字图层，根据文字实际大小计算选择框尺寸
                if (layer.type === 'text') {
                    const textProps = layer.textProps || {
                        fontSize: 24,
                        fontFamily: 'Arial',
                        fontWeight: 'normal',
                        fontStyle: 'normal',
                    };
                    
                    // 设置字体以测量文字
                    const fontWeight = textProps.fontWeight || 'normal';
                    const fontStyle = textProps.fontStyle || 'normal';
                    const fontSize = textProps.fontSize || 24;
                    const fontFamily = textProps.fontFamily || 'Arial';
                    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
                    
                    // 测量文字实际宽度和高度
                    const text = layer.src || '文字';
                    const metrics = ctx.measureText(text);
                    const textWidth = metrics.width;
                    const textHeight = fontSize * 1.2; // 估算高度，通常为字体大小的1.2倍
                    
                    // 更新选择框尺寸
                    w = textWidth * layer.scale;
                    h = textHeight * layer.scale;
                }
                
                ctx.save();
                ctx.translate(layer.x, layer.y);
                ctx.rotate((layer.rotation * Math.PI) / 180);

                // 绘制选择框
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 1.5 / view.scale;
                const rectX = -w / 2;
                const rectY = -h / 2;
                ctx.strokeRect(rectX, rectY, w, h);

                const handleRadius = 6 / view.scale;
                const rotHandleDist = 30 / view.scale;
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 1.5 / view.scale;

                const drawHandle = (x: number, y: number) => {
                    // 绘制控制点，确保在角上
                    ctx.beginPath();
                    ctx.arc(x, y, handleRadius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                };

                // 四个角的控制点 - 确保在最外层四个角
                // 控制点中心直接位于矩形的四个角上
                drawHandle(rectX, rectY);           // 左上角
                drawHandle(rectX + w, rectY);       // 右上角
                drawHandle(rectX, rectY + h);       // 左下角
                drawHandle(rectX + w, rectY + h);   // 右下角
                
                // 旋转控制点（在顶部中心上方）
                ctx.beginPath(); 
                ctx.moveTo(rectX + w / 2, rectY); 
                ctx.lineTo(rectX + w / 2, rectY - rotHandleDist); 
                ctx.stroke();
                drawHandle(rectX + w / 2, rectY - rotHandleDist);

                ctx.restore();
            }
        }

        ctx.restore();

    }, [layers, selectedLayerId, config.shape, customUVs, customParts, uvWireframe, view.scale, canvasConfig, regions, uvMode]);

    // Trigger Renders
    useEffect(() => {
        renderContent();
    }, [renderContent]);

    useEffect(() => {
        renderUI();
    }, [renderUI]);
    
    // 当编辑器打开且regions准备好时，立即渲染SVG区域
    useEffect(() => {
        if (isOpen && regions.length > 0) {
            // 立即触发渲染，确保SVG区域可见
            const timer = setTimeout(() => {
                renderContent();
                renderUI();
                setPreviewVersion(v => v + 1);
            }, 50);
            
            return () => clearTimeout(timer);
        }
    }, [isOpen, regions.length, renderContent, renderUI]);

    // Hit testing & Interaction Handlers (same as before)
    const getHitInfo = (clientX: number, clientY: number) => {
        const canvasPt = screenToCanvas(clientX, clientY);
        if (selectedLayerId) {
            const layer = layers.find(l => l.id === selectedLayerId);
            if (layer) {
                let w = layer.width * layer.scale;
                let h = layer.height * layer.scale;
                
                // 对于文字图层，根据文字实际大小计算尺寸
                if (layer.type === 'text') {
                    const textProps = layer.textProps || {
                        fontSize: 24,
                        fontFamily: 'Arial',
                        fontWeight: 'normal',
                        fontStyle: 'normal',
                    };
                    
                    // 创建临时canvas来测量文字
                    const tempCanvas = document.createElement('canvas');
                    const tempCtx = tempCanvas.getContext('2d');
                    if (tempCtx) {
                        const fontWeight = textProps.fontWeight || 'normal';
                        const fontStyle = textProps.fontStyle || 'normal';
                        const fontSize = textProps.fontSize || 24;
                        const fontFamily = textProps.fontFamily || 'Arial';
                        tempCtx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
                        
                        const text = layer.src || '文字';
                        const metrics = tempCtx.measureText(text);
                        const textWidth = metrics.width;
                        const textHeight = fontSize * 1.2;
                        
                        w = textWidth * layer.scale;
                        h = textHeight * layer.scale;
                    }
                }
                
                const rotRad = (layer.rotation * Math.PI) / 180;
                const checkHandle = (lx: number, ly: number) => {
                    const gx = layer.x + lx * Math.cos(rotRad) - ly * Math.sin(rotRad);
                    const gy = layer.y + lx * Math.sin(rotRad) + ly * Math.cos(rotRad);
                    return Math.hypot(canvasPt.x - gx, canvasPt.y - gy) < (15 / view.scale);
                };
                const rotDist = 30 / view.scale;
                const halfW = w / 2;
                const halfH = h / 2;
                // 使用与绘制相同的角坐标进行检测（控制点中心在角上）
                if (checkHandle(0, -halfH - rotDist)) return { type: 'rotate', layer };
                if (checkHandle(halfW, halfH)) return { type: 'scale_br', layer };      // 右下角
                if (checkHandle(-halfW, -halfH)) return { type: 'scale_tl', layer };     // 左上角
                if (checkHandle(halfW, -halfH)) return { type: 'scale_tr', layer };      // 右上角
                if (checkHandle(-halfW, halfH)) return { type: 'scale_bl', layer };       // 左下角
            }
        }
        const labelPaddingX = 20 / view.scale;
        const labelPaddingY = 26 / view.scale;
        for (const region of regions) {
            const cx = region.x + region.w / 2;
            const cy = region.y + region.h / 2;
            if (Math.abs(canvasPt.x - cx) < 60 / view.scale && Math.abs(canvasPt.y - cy) < 15 / view.scale) {
                return { type: 'region', region };
            }
        }
        for (let i = layers.length - 1; i >= 0; i--) {
            if (isPointInRotatedRect(canvasPt.x, canvasPt.y, layers[i])) {
                return { type: 'body', layer: layers[i] };
            }
        }
        // 使用改进的 isPointInRegion 函数检测（包含 SVG 路径检测）
        for (const region of regions) {
            if (isPointInRegion(canvasPt.x, canvasPt.y, region)) {
                return { type: 'region', region };
            }
        }
        return null;
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const zoomSensitivity = 0.001;
            const newScale = Math.min(Math.max(0.1, view.scale - e.deltaY * zoomSensitivity), 5);
            const rect = containerRef.current!.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const wx = (mouseX - view.x) / view.scale;
            const wy = (mouseY - view.y) / view.scale;
            const newX = mouseX - wx * newScale;
            const newY = mouseY - wy * newScale;
            setView({ x: newX, y: newY, scale: newScale });
        } else {
            setView(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
        }
        setActiveFaceId(null);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && e.nativeEvent.getModifierState('Space'))) {
            interactionRef.current = {
                mode: 'pan',
                startMouse: { x: e.clientX, y: e.clientY },
                startView: { ...view },
                startLayer: null
            };
            setCursorStyle('grabbing');
            return;
        }
        if (e.button === 0) {
            const hit = getHitInfo(e.clientX, e.clientY);
            if (hit) {
                if (hit.type === 'rotate') {
                    // 保存操作开始时的历史（使用setLayers的回调获取最新状态）
                    setLayers(currentLayers => {
                        saveHistory(currentLayers);
                        return currentLayers;
                    });
                    interactionRef.current = { 
                        mode: 'rotate_layer', 
                        startMouse: { x: e.clientX, y: e.clientY }, 
                        startView: view, 
                        startLayer: { ...hit.layer },
                        historySaved: true
                    };
                    return;
                }
                if (hit.type.startsWith('scale')) {
                    // 保存操作开始时的历史（使用setLayers的回调获取最新状态）
                    setLayers(currentLayers => {
                        saveHistory(currentLayers);
                        return currentLayers;
                    });
                    interactionRef.current = { 
                        mode: 'scale_layer', 
                        activeHandle: hit.type, 
                        startMouse: { x: e.clientX, y: e.clientY }, 
                        startView: view, 
                        startLayer: { ...hit.layer },
                        historySaved: true
                    };
                    return;
                }
                if (hit.type === 'body') {
                    setSelectedLayerId(hit.layer.id);
                    setActiveFaceId(null);
                    setShowColorButton(null); // 关闭颜色按钮
                    setColorPickerPos(null); // 关闭颜色选择器
                    // 如果是文字图层，显示编辑工具栏
                    if (hit.layer.type === 'text' && containerRef.current) {
                        const rect = containerRef.current.getBoundingClientRect();
                        const canvasX = hit.layer.x * view.scale + view.x;
                        const canvasY = hit.layer.y * view.scale + view.y;
                        setTextEditorPos({
                            x: rect.left + canvasX + 20,
                            y: rect.top + canvasY - 200
                        });
                        setColorBlockEditorPos(null);
                    } else if (hit.layer.type === 'color' && containerRef.current) {
                        // 如果是色块图层，显示编辑工具栏
                        const rect = containerRef.current.getBoundingClientRect();
                        const canvasX = hit.layer.x * view.scale + view.x;
                        const canvasY = hit.layer.y * view.scale + view.y;
                        setColorBlockEditorPos({
                            x: rect.left + canvasX + 20,
                            y: rect.top + canvasY - 200
                        });
                        setTextEditorPos(null);
                    } else {
                        setTextEditorPos(null);
                        setColorBlockEditorPos(null);
                    }
                    // 保存操作开始时的历史（使用setLayers的回调获取最新状态）
                    setLayers(currentLayers => {
                        saveHistory(currentLayers);
                        return currentLayers;
                    });
                    interactionRef.current = {
                        mode: 'move_layer',
                        startMouse: { x: e.clientX, y: e.clientY },
                        startView: view,
                        startLayer: { ...hit.layer },
                        historySaved: true
                    };
                    return;
                }
                if (hit.type === 'region') {
                    setSelectedLayerId(null);
                    setActiveFaceId(null); // 先不激活，等点击颜色按钮后再激活
                    const rect = containerRef.current!.getBoundingClientRect();
                    // 计算region顶部中心位置（在画布坐标系中）
                    const regionTopX = hit.region.x + hit.region.w / 2;
                    const regionTopY = hit.region.y;
                    // 转换为屏幕坐标
                    const screenX = rect.left + regionTopX * view.scale + view.x;
                    const screenY = rect.top + regionTopY * view.scale + view.y;
                    // 显示颜色按钮，始终在region顶部
                    setShowColorButton({
                        regionId: hit.region.id,
                        position: {
                            x: screenX - rect.left - 40, // 按钮宽度的一半，使其居中
                            y: screenY - rect.top - 50
                        }
                    });
                    setColorPickerPos(null); // 清除颜色选择器位置
                    return;
                }
            }
            setSelectedLayerId(null);
            setActiveFaceId(null);
            setShowColorButton(null); // 关闭颜色按钮
            setColorPickerPos(null); // 关闭颜色选择器
            setTextEditorPos(null); // 关闭文字编辑工具栏
            setColorBlockEditorPos(null); // 关闭色块编辑工具栏
            interactionRef.current = { mode: 'pan', startMouse: { x: e.clientX, y: e.clientY }, startView: view, startLayer: null };
            setCursorStyle('grabbing');
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const state = interactionRef.current;
        if (state.mode === 'none') {
            if (e.nativeEvent.getModifierState('Space')) {
                setCursorStyle('grab');
                return;
            }
            const hit = getHitInfo(e.clientX, e.clientY);
            if (hit) {
                if (hit.type === 'rotate') setCursorStyle('grab');
                else if (hit.type.startsWith('scale')) setCursorStyle('nwse-resize');
                else if (hit.type === 'body') setCursorStyle('move');
                else if (hit.type === 'region') setCursorStyle('pointer');
            } else {
                setCursorStyle('default');
            }
            return;
        }

        const dx = e.clientX - state.startMouse.x;
        const dy = e.clientY - state.startMouse.y;

        if (state.mode === 'pan') {
            setView({ ...view, x: state.startView.x + dx, y: state.startView.y + dy });
            setCursorStyle('grabbing');
        }
        else if (state.mode === 'move_layer' && state.startLayer) {
            const cdx = dx / view.scale;
            const cdy = dy / view.scale;
            setLayers(prev => prev.map(l => l.id === state.startLayer!.id ? {
                ...l,
                x: state.startLayer!.x + cdx,
                y: state.startLayer!.y + cdy
            } : l));
            setCursorStyle('move');
        }
        else if (state.mode === 'rotate_layer' && state.startLayer) {
            const rect = containerRef.current!.getBoundingClientRect();
            const cx = rect.left + view.x + state.startLayer.x * view.scale;
            const cy = rect.top + view.y + state.startLayer.y * view.scale;
            const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
            setLayers(prev => prev.map(l => l.id === state.startLayer!.id ? { ...l, rotation: angle + 90 } : l));
            setCursorStyle('grabbing');
        }
        else if (state.mode === 'scale_layer' && state.startLayer) {
            const rect = containerRef.current!.getBoundingClientRect();
            const cx = rect.left + view.x + state.startLayer.x * view.scale;
            const cy = rect.top + view.y + state.startLayer.y * view.scale;
            const startDist = Math.hypot(state.startMouse.x - cx, state.startMouse.y - cy);
            const currDist = Math.hypot(e.clientX - cx, e.clientY - cy);
            const scaleFactor = currDist / startDist;
            setLayers(prev => prev.map(l => l.id === state.startLayer!.id ? { ...l, scale: state.startLayer!.scale * scaleFactor } : l));
            setCursorStyle('nwse-resize');
        }
    };

    const handleMouseUp = () => {
        if (interactionRef.current.mode !== 'none') {
            const mode = interactionRef.current.mode;
            // 如果是图层操作（移动、旋转、缩放），保存最终状态到历史
            if ((mode === 'move_layer' || mode === 'rotate_layer' || mode === 'scale_layer') && 
                interactionRef.current.historySaved) {
                // 操作完成，保存最终状态（使用setLayers的回调获取最新值）
                setLayers(currentLayers => {
                    saveHistory(currentLayers);
                    return currentLayers;
                });
            }
            setPreviewVersion(v => v + 1);
            interactionRef.current = { 
                mode: 'none', 
                startMouse: { x: 0, y: 0 }, 
                startView: view, 
                startLayer: null,
                historySaved: false
            };
            setCursorStyle('default');
        }
    };

    const handleSave = () => {
        if (canvasRef.current) {
            // 保存画布为图片（用于预览和3D渲染）
            const imageUrl = canvasRef.current.toDataURL('image/png');
            // 同时保存图层数据（用于后续编辑）
            // 清理imgElement，因为不能序列化
            const layersToSave = layers.map(layer => ({
                ...layer,
                imgElement: null, // 移除不能序列化的imgElement
            }));
            onSave(imageUrl, layersToSave);
            onClose();
        }
    };

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = ev => {
                if (ev.target?.result) {
                    const src = ev.target.result as string;
                    const id = crypto.randomUUID();
                    setUploadedImages(prev => [
                        { id, src, name: file.name, createdAt: Date.now() },
                        ...prev,
                    ]);
                    addLayer(src);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddImageToCanvas = (image: UploadedImage) => {
        addLayer(image.src);
    };

    const handleDeleteUploadedImage = (imageId: string) => {
        const image = uploadedImages.find(img => img.id === imageId);
        setUploadedImages(prev => prev.filter(img => img.id !== imageId));
        if (image) {
            updateLayersWithHistory(prev => prev.filter(l => !(l.type === 'image' && l.src === image.src)));
            if (selectedLayerId && !layers.find(l => l.id === selectedLayerId)) {
                setSelectedLayerId(null);
            }
        }
    };

    const handleReorderLayers = (fromId: string, toId: string, insertPosition: 'above' | 'below' = 'below') => {
        updateLayersWithHistory(prev => {
            const fromIndex = prev.findIndex(l => l.id === fromId);
            const toIndex = prev.findIndex(l => l.id === toId);
            if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return prev;
            
            const next = [...prev];
            const [moved] = next.splice(fromIndex, 1);
            
            // 计算目标索引
            // 由于UI中图层列表是反向显示的（使用reverse()），需要转换视觉位置到数组索引
            // 数组索引：0（底层）... n-1（顶层）
            // UI显示（reverse后）：n-1（顶层）... 0（底层）
            // 
            // 视觉上的"above"（上方）= 数组中的更大索引（更靠后）
            // 视觉上的"below"（下方）= 数组中的更小索引（更靠前）
            let targetIndex: number;
            
            // 先计算移除源元素后的新toIndex
            const newToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
            
            if (insertPosition === 'above') {
                // 视觉上的"above"（上方）= 插入到目标元素之后 = 数组索引 +1
                targetIndex = newToIndex + 1;
            } else {
                // 视觉上的"below"（下方）= 插入到目标元素之前 = 数组索引
                targetIndex = newToIndex;
            }
            
            // 确保索引在有效范围内
            if (targetIndex < 0) targetIndex = 0;
            if (targetIndex > next.length) targetIndex = next.length;
            
            next.splice(targetIndex, 0, moved);
            return next;
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex bg-[#f3f4f6]">
            {/* 1. Sidebar - Upload & Layers */}
            <div className="flex bg-white border-r border-gray-200 z-20 shadow-sm">
                {/* 左侧一级菜单导航栏 */}
                <div className="w-16 bg-white border-r border-gray-100 flex flex-col py-4">
                    <button
                        onClick={() => setActivePanel('upload')}
                        className={`flex flex-col items-center justify-center gap-1 py-3 px-2 transition-colors relative ${
                            activePanel === 'upload'
                                ? 'bg-gray-100 text-black'
                                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                        }`}
                        title={t('uploadImage')}
                    >
                        {activePanel === 'upload' && (
                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-black"></div>
                        )}
                        <Upload size={20} />
                        <span className="text-[10px] font-medium">{t('uploadImage')}</span>
                    </button>
                    <button
                        onClick={() => setActivePanel('layers')}
                        className={`flex flex-col items-center justify-center gap-1 py-3 px-2 transition-colors relative ${
                            activePanel === 'layers'
                                ? 'bg-gray-100 text-black'
                                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                        }`}
                        title={t('layerManagement')}
                    >
                        {activePanel === 'layers' && (
                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-black"></div>
                        )}
                        <Layers size={20} />
                        <span className="text-[10px] font-medium">{t('layerManagement')}</span>
                    </button>
                    <button
                        onClick={() => setActivePanel('assets')}
                        className={`flex flex-col items-center justify-center gap-1 py-3 px-2 transition-colors relative ${
                            activePanel === 'assets'
                                ? 'bg-gray-100 text-black'
                                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                        }`}
                        title={t('packagingAssets')}
                    >
                        {activePanel === 'assets' && (
                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-black"></div>
                        )}
                        <Package size={20} />
                        <span className="text-[10px] font-medium">{t('packagingAssets')}</span>
                    </button>
                </div>

                {/* 右侧内容区域 */}
                <div className="flex-1 w-64 flex flex-col">
                    <div className="p-4 border-b border-gray-100">
                        <h2 className="font-bold text-gray-800 text-sm">
                            {activePanel === 'upload' ? t('uploadImage') : activePanel === 'layers' ? t('layerManagement') : t('packagingAssets')}
                        </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {activePanel === 'upload' && (
                        <div className="space-y-3">
                            <label className="w-full py-3 px-3 bg-white border border-gray-200 hover:border-black hover:bg-gray-50 text-gray-600 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs font-medium shadow-sm">
                                <Upload size={14} />
                                <span>{t('clickToUpload')}</span>
                                <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
                            </label>
                            
                            {/* 添加色块按钮 */}
                            <button
                                onClick={addColorBlock}
                                className="w-full py-2.5 px-3 bg-white border border-gray-200 hover:border-black hover:bg-gray-50 text-gray-600 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs font-medium shadow-sm"
                                title={t('addColorBlock')}
                            >
                                <Square size={14} fill="currentColor" className="text-gray-400" />
                                <span>{t('addColorBlock')}</span>
                            </button>

                            {/* 新增文字按钮 */}
                            <button
                                onClick={addTextBlock}
                                className="w-full py-2.5 px-3 bg-white border border-gray-200 hover:border-black hover:bg-gray-50 text-gray-600 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs font-medium shadow-sm"
                                title={t('addText')}
                            >
                                <Type size={14} />
                                <span>{t('addText')}</span>
                            </button>
                            {uploadedImages.length === 0 ? (
                                <div className="text-center text-gray-400 text-xs py-10 flex flex-col items-center">
                                    <ImageIcon size={32} className="mb-2 opacity-50" />
                                    <p>{t('noUploadedImages')}</p>
                                    <p>{t('uploadToUse')}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {uploadedImages.map(image => (
                                        <div key={image.id} className="group border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:border-brand-300 transition-all flex flex-col">
                                            <div
                                                className="relative w-full pt-[70%] bg-gray-50"
                                                style={{ backgroundImage: `url(${image.src})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}
                                            />
                                            <div className="px-2 py-1.5 flex items-center justify-between gap-1">
                                                <button
                                                    onClick={() => handleAddImageToCanvas(image)}
                                                    className="flex-1 text-[11px] text-black hover:text-gray-800 hover:bg-gray-50 px-2 py-1 rounded-md font-medium transition-colors"
                                                >
                                                    {language === 'zh' ? '添加到画布' : 'Add to Canvas'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUploadedImage(image.id)}
                                                    className="text-[11px] text-gray-400 hover:text-red-500 px-1 py-1 rounded-md transition-colors"
                                                    title={t('delete')}
                                                >
                                                    {t('delete')}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activePanel === 'assets' && (
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                {PACKAGING_ASSETS.map(asset => (
                                    <button
                                        key={asset.id}
                                        onClick={() => handleAddAsset(asset)}
                                        className="group border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:border-brand-300 hover:shadow-md transition-all flex flex-col items-center justify-center p-3 aspect-square"
                                        title={asset.name}
                                    >
                                        <div
                                            className="w-full h-full flex items-center justify-center"
                                            dangerouslySetInnerHTML={{ __html: asset.svg }}
                                        />
                                        <span className="text-[10px] text-gray-600 mt-1 font-medium">{asset.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {activePanel === 'layers' && (
                        <div className="space-y-2">
                            {layers.length === 0 ? (
                                <div className="text-center text-gray-400 text-xs py-10 flex flex-col items-center">
                                    <ImageIcon size={32} className="mb-2 opacity-50" />
                                    <p>暂无图层</p>
                                    <p>先在“上传”中添加图片</p>
                                </div>
                            ) : (
                                [...layers].reverse().map((layer, index) => {
                                    const isDragging = draggingLayerIdRef.current === layer.id;
                                    const isDragOver = dragOverLayerId === layer.id;
                                    const showInsertAbove = isDragOver && insertPosition === 'above';
                                    const showInsertBelow = isDragOver && insertPosition === 'below';
                                    
                                    return (
                                    <div key={layer.id} className="relative">
                                        {/* 插入位置指示线 - 上方 */}
                                        {showInsertAbove && !isDragging && (
                                            <div className="absolute -top-1 left-0 right-0 h-0.5 bg-black rounded-full z-10 shadow-sm">
                                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-black rounded-full"></div>
                                            </div>
                                        )}
                                        
                                        <div
                                            draggable
                                            onDragStart={(e) => { 
                                                draggingLayerIdRef.current = layer.id;
                                                setDragOverLayerId(null);
                                                setInsertPosition(null);
                                                // 设置拖拽预览
                                                if (e.dataTransfer) {
                                                    e.dataTransfer.effectAllowed = 'move';
                                                    e.dataTransfer.setDragImage(e.currentTarget.cloneNode(true) as Element, 0, 0);
                                                }
                                                // 阻止点击事件在拖拽时触发
                                                e.stopPropagation();
                                            }}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (draggingLayerIdRef.current && draggingLayerIdRef.current !== layer.id) {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const mouseY = e.clientY;
                                                    const elementCenterY = rect.top + rect.height / 2;
                                                    
                                                    // 判断鼠标在元素的上半部分还是下半部分
                                                    if (mouseY < elementCenterY) {
                                                        setDragOverLayerId(layer.id);
                                                        setInsertPosition('above');
                                                    } else {
                                                        setDragOverLayerId(layer.id);
                                                        setInsertPosition('below');
                                                    }
                                                }
                                            }}
                                            onDragEnter={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                            }}
                                            onDragLeave={(e) => {
                                                // 只有当鼠标真正离开元素时才清除状态
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const mouseY = e.clientY;
                                                if (mouseY < rect.top || mouseY > rect.bottom) {
                                                    setDragOverLayerId(null);
                                                    setInsertPosition(null);
                                                }
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (draggingLayerIdRef.current && draggingLayerIdRef.current !== layer.id && insertPosition) {
                                                    handleReorderLayers(draggingLayerIdRef.current, layer.id, insertPosition);
                                                }
                                                draggingLayerIdRef.current = null;
                                                setDragOverLayerId(null);
                                                setInsertPosition(null);
                                            }}
                                            onDragEnd={(e) => {
                                                draggingLayerIdRef.current = null;
                                                setDragOverLayerId(null);
                                                setInsertPosition(null);
                                                e.stopPropagation();
                                            }}
                                        onClick={(e) => {
                                            // 如果正在拖拽，不触发点击事件
                                            if (draggingLayerIdRef.current) {
                                                return;
                                            }
                                            setSelectedLayerId(layer.id);
                                            if (containerRef.current) {
                                                const rect = containerRef.current.getBoundingClientRect();
                                                const canvasX = layer.x * view.scale + view.x;
                                                const canvasY = layer.y * view.scale + view.y;
                                                
                                                // 如果是文字图层，显示编辑工具栏
                                                if (layer.type === 'text') {
                                                    setTextEditorPos({
                                                        x: rect.left + canvasX + 20,
                                                        y: rect.top + canvasY - 200
                                                    });
                                                    setColorBlockEditorPos(null);
                                                } else if (layer.type === 'color') {
                                                    // 如果是色块图层，显示编辑工具栏
                                                    setColorBlockEditorPos({
                                                        x: rect.left + canvasX + 20,
                                                        y: rect.top + canvasY - 200
                                                    });
                                                    setTextEditorPos(null);
                                                } else {
                                                    setTextEditorPos(null);
                                                    setColorBlockEditorPos(null);
                                                }
                                            }
                                        }}
                                        className={`group flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all ${
                                            isDragging 
                                                ? 'opacity-50 cursor-grabbing' 
                                                : selectedLayerId === layer.id 
                                                    ? 'bg-brand-50 border-brand-200 shadow-sm' 
                                                    : isDragOver
                                                        ? 'bg-gray-50/50 border-black'
                                                        : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        <div 
                                            className="cursor-grab text-gray-300 hover:text-gray-500"
                                            onMouseDown={(e) => {
                                                // 确保拖拽手柄可以正常拖动
                                                e.stopPropagation();
                                            }}
                                        >
                                            <GripVertical size={14} />
                                        </div>
                                        <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden border border-gray-200 shrink-0 relative flex items-center justify-center">
                                            {layer.type === 'color' ? (
                                                <>
                                                    <div className="w-full h-full" style={{ backgroundColor: layer.src }}></div>
                                                    <input
                                                        type="color"
                                                        value={layer.src}
                                                        onChange={(e) => updateColorLayer(layer.id, e.target.value)}
                                                        onMouseDown={(e) => {
                                                            // 阻止拖放事件在颜色选择器上触发
                                                            e.stopPropagation();
                                                        }}
                                                        onClick={(e) => {
                                                            // 阻止点击事件冒泡，避免触发图层选择
                                                            e.stopPropagation();
                                                        }}
                                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                    />
                                                </>
                                            ) : layer.type === 'text' ? (
                                                <div className="text-xs font-medium text-gray-700" style={{ color: layer.textProps?.color || '#000000' }}>
                                                    {layer.src || '文字'}
                                                </div>
                                            ) : (
                                                <div
                                                    className="w-full h-full bg-contain bg-center bg-no-repeat"
                                                    style={{ backgroundImage: `url(${layer.src})` }}
                                                />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium text-gray-700 truncate">
                                                {layer.type === 'color' ? t('colorLayer') : layer.type === 'text' ? t('textLayer') : `${t('imageLayer')} ${layers.length - index}`}
                                            </div>
                                            <div className="text-[10px] text-gray-400 capitalize">
                                                {layer.type}
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                updateLayersWithHistory(prev => prev.filter(l => l.id !== layer.id));
                                                if (selectedLayerId === layer.id) {
                                                    setSelectedLayerId(null);
                                                    setTextEditorPos(null);
                                                    setColorBlockEditorPos(null);
                                                }
                                            }}
                                            onMouseDown={(e) => {
                                                // 阻止拖放事件在删除按钮上触发
                                                e.stopPropagation();
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    
                                    {/* 插入位置指示线 - 下方 */}
                                    {showInsertBelow && !isDragging && (
                                        <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-black rounded-full z-10 shadow-sm">
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-black rounded-full"></div>
                                        </div>
                                    )}
                                </div>
                                );
                                })
                            )}
                        </div>
                    )}
                    </div>
                    <div className="p-3 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-400 text-center">Tips: 点击画布背景可设置底色<br />添加色块可覆盖局部区域</div>
                </div>
            </div>

            {/* 2. Main Canvas */}
            <div className="flex-1 flex flex-col relative overflow-hidden bg-[#f3f4f6]">
                <div className="h-14 border-b border-gray-200 flex items-center justify-between px-6 bg-white z-20 shadow-sm">
                    <div className="flex items-center gap-4">
                        <span className="font-bold text-gray-800 text-lg">2D 平面设计</span>
                        <div className="h-4 w-px bg-gray-200"></div>
                        {/* UV 模式筛选按钮 */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setUvMode(uvMode === 'database' ? 'custom' : 'database')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    uvMode === 'database'
                                        ? 'bg-brand-100 text-brand-700 border border-brand-300'
                                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                                }`}
                                title="切换 UV 模式"
                            >
                                <Filter size={14} />
                                <span>{uvMode === 'database' ? '数据库 SVG' : '自定义 UV'}</span>
                            </button>
                        </div>
                        <div className="h-4 w-px bg-gray-200"></div>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleUndo}
                                disabled={historyIndex <= 0}
                                className={`p-2 rounded-full transition-colors ${
                                    historyIndex <= 0 
                                        ? 'text-gray-300 cursor-not-allowed' 
                                        : 'text-gray-500 hover:bg-gray-100'
                                }`}
                                title={historyIndex <= 0 ? '无法撤销' : '撤销 (Ctrl+Z)'}
                            >
                                <Undo2 size={16} />
                            </button>
                            <button 
                                onClick={handleRedo}
                                disabled={historyIndex >= history.length - 1}
                                className={`p-2 rounded-full transition-colors ${
                                    historyIndex >= history.length - 1 
                                        ? 'text-gray-300 cursor-not-allowed' 
                                        : 'text-gray-500 hover:bg-gray-100'
                                }`}
                                title={historyIndex >= history.length - 1 ? '无法重做' : '重做 (Ctrl+Shift+Z)'}
                            >
                                <Redo2 size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">{t('cancel')}</button>
                        <button onClick={handleSave} className="px-6 py-2 text-sm font-medium bg-black hover:bg-gray-800 text-white rounded-lg shadow-sm">{t('completeDesign')}</button>
                    </div>
                </div>
                <div ref={containerRef} className="flex-1 relative overflow-hidden" style={{ cursor: cursorStyle }} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onContextMenu={e => e.preventDefault()}>
                    <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: '0 0', width: canvasConfig.width, height: canvasConfig.height }}>
                        {/* Bottom: Content Canvas (Used for Texture) */}
                        <canvas ref={canvasRef} width={canvasConfig.width} height={canvasConfig.height} className="absolute inset-0 w-full h-full block" />

                        {/* Top: UI Canvas (Overlays, Guides - Invisible to Model) */}
                        <canvas ref={uiCanvasRef} width={canvasConfig.width} height={canvasConfig.height} className="absolute inset-0 w-full h-full block pointer-events-none" />

                        {/* SVG Regions Layer - Independent clickable regions */}
                        <svg
                            width={canvasConfig.width}
                            height={canvasConfig.height}
                            className="absolute inset-0 w-full h-full block pointer-events-auto"
                            style={{ overflow: 'visible' }}
                        >
                            {regions.map((region) => {
                                const isSelected = selectedRegionId === region.id;
                                const isHovered = selectedRegionId === region.id;
                                const hasColor = faceColors[region.id] !== null && faceColors[region.id] !== undefined;

                                return (
                                    <g
                                        key={region.id}
                                        onMouseEnter={() => setSelectedRegionId(region.id)}
                                        onMouseLeave={() => {
                                            // Keep selected if clicked, otherwise clear on leave
                                            if (!isSelected) {
                                                // setSelectedRegionId(null);
                                            }
                                        }}
                                    >
                                        {/* Region Background (if has color) */}
                                        {hasColor && (
                                            <rect
                                                x={region.x}
                                                y={region.y}
                                                width={region.w}
                                                height={region.h}
                                                fill={faceColors[region.id] || 'transparent'}
                                                opacity={0.3}
                                                className="transition-opacity pointer-events-none"
                                            />
                                        )}

                                        {/* Region Border/Shape - Use actual SVG path if available */}
                                        {(() => {
                                            const pathData = config.dynamicSVGPaths?.[region.id];
                                            if (pathData && pathData.d) {
                                                // 使用实际的 SVG 路径作为可点击区域
                                                const svgCanvasWidth = pathData.w || canvasConfig.width;
                                                const svgCanvasHeight = pathData.h || canvasConfig.height;
                                                const scaleX = canvasConfig.width / svgCanvasWidth;
                                                const scaleY = canvasConfig.height / svgCanvasHeight;
                                                
                                                return (
                                                    <g transform={`scale(${scaleX}, ${scaleY})`}>
                                                        <path
                                                            d={pathData.d}
                                                            fill="transparent"
                                                            stroke="transparent"
                                                            strokeWidth={0}
                                                            className="cursor-pointer transition-all"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedRegionId(region.id);
                                                                setActiveFaceId(null); // 先不激活，等点击颜色按钮后再激活
                                                                const rect = containerRef.current?.getBoundingClientRect();
                                                                if (rect) {
                                                                    // 计算region顶部中心位置（在画布坐标系中）
                                                                    const regionTopX = region.x + region.w / 2;
                                                                    const regionTopY = region.y;
                                                                    // 转换为屏幕坐标
                                                                    const screenX = rect.left + regionTopX * view.scale + view.x;
                                                                    const screenY = rect.top + regionTopY * view.scale + view.y;
                                                                    // 显示颜色按钮，始终在region顶部
                                                                    setShowColorButton({
                                                                        regionId: region.id,
                                                                        position: {
                                                                            x: screenX - rect.left - 40, // 按钮宽度的一半，使其居中
                                                                            y: screenY - rect.top - 50
                                                                        }
                                                                    });
                                                                    setColorPickerPos(null); // 清除颜色选择器位置
                                                                }
                                                            }}
                                                        />
                                                    </g>
                                                );
                                            }
                                            
                                            // 回退到矩形（如果没有 SVG 路径）
                                            return (
                                                <rect
                                                    x={region.x}
                                                    y={region.y}
                                                    width={region.w}
                                                    height={region.h}
                                                    fill="transparent"
                                                    stroke="transparent"
                                                    strokeWidth={0}
                                                    className="cursor-pointer transition-all"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedRegionId(region.id);
                                                        setActiveFaceId(null); // 先不激活，等点击颜色按钮后再激活
                                                        const rect = containerRef.current?.getBoundingClientRect();
                                                        if (rect) {
                                                            // 计算region顶部中心位置（在画布坐标系中）
                                                            const regionTopX = region.x + region.w / 2;
                                                            const regionTopY = region.y;
                                                            // 转换为屏幕坐标
                                                            const screenX = rect.left + regionTopX * view.scale + view.x;
                                                            const screenY = rect.top + regionTopY * view.scale + view.y;
                                                            // 显示颜色按钮，始终在region顶部
                                                            setShowColorButton({
                                                                regionId: region.id,
                                                                position: {
                                                                    x: screenX - rect.left - 40, // 按钮宽度的一半，使其居中
                                                                    y: screenY - rect.top - 50
                                                                }
                                                            });
                                                            setColorPickerPos(null); // 清除颜色选择器位置
                                                        }
                                                    }}
                                                />
                                            );
                                        })()}

                                        {/* Region Label - Simple Text */}
                                        <g transform={`translate(${region.x + region.w / 2}, ${region.y + region.h / 2})`}>
                                            <text
                                                x={0}
                                                y={0}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fill="#666"
                                                fontSize="12"
                                                fontWeight="500"
                                                className="pointer-events-none select-none opacity-60"
                                            >
                                                {region.label}
                                            </text>
                                        </g>
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                    {/* 颜色按钮 - 第一步交互 */}
                    {showColorButton && !colorPickerPos && (
                        <ColorButton
                            position={showColorButton.position}
                            onClick={() => {
                                // 点击颜色按钮后，显示颜色选择器
                                setActiveFaceId(showColorButton.regionId);
                                // 颜色选择器也显示在region顶部
                                setColorPickerPos(showColorButton.position);
                                setShowColorButton(null);
                            }}
                            onClose={() => {
                                setShowColorButton(null);
                                setSelectedRegionId(null);
                            }}
                        />
                    )}
                    {/* 颜色选择器 - 第二步交互 */}
                    {activeFaceId && colorPickerPos && (
                        <ColorPickerPopup
                            color={faceColors[activeFaceId]}
                            position={colorPickerPos}
                            onChange={(c) => {
                                setFaceColors(prev => ({ ...prev, [activeFaceId]: c }));
                                setPreviewVersion(v => v + 1);
                            }}
                            onClose={() => {
                                setActiveFaceId(null);
                                setColorPickerPos(null);
                                setSelectedRegionId(null);
                            }}
                        />
                    )}
                    {/* 文字编辑工具栏 */}
                    {selectedLayerId && textEditorPos && (() => {
                        const textLayer = layers.find(l => l.id === selectedLayerId && l.type === 'text');
                        return textLayer ? (
                            <TextEditorToolbar
                                layer={textLayer}
                                position={textEditorPos}
                                onUpdate={(updates) => updateTextLayer(selectedLayerId, updates)}
                                onClose={() => {
                                    setTextEditorPos(null);
                                    // 不取消选中图层，只是关闭工具栏
                                }}
                            />
                        ) : null;
                    })()}
                    {/* 色块编辑工具栏 */}
                    {selectedLayerId && colorBlockEditorPos && (() => {
                        const colorLayer = layers.find(l => l.id === selectedLayerId && l.type === 'color');
                        return colorLayer ? (
                            <ColorBlockEditorToolbar
                                layer={colorLayer}
                                position={colorBlockEditorPos}
                                onUpdate={(updates) => updateColorBlockLayer(selectedLayerId, updates)}
                                onClose={() => {
                                    setColorBlockEditorPos(null);
                                    // 不取消选中图层，只是关闭工具栏
                                }}
                            />
                        ) : null;
                    })()}
                    <div className="absolute bottom-6 left-6 flex gap-2">
                        <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm flex items-center gap-1"><button onClick={() => setView(v => ({ ...v, scale: Math.max(0.1, v.scale - 0.1) }))} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition-colors"><ZoomOut size={14} /></button><span className="text-xs font-medium text-gray-600 w-10 text-center select-none">{Math.round(view.scale * 100)}%</span><button onClick={() => setView(v => ({ ...v, scale: Math.min(5, v.scale + 0.1) }))} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition-colors"><ZoomIn size={14} /></button></div>
                        <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm flex items-center gap-1">{[0.25, 0.5, 1.0].map(s => (<button key={s} onClick={() => setView(prev => ({ ...prev, scale: s }))} className="px-2 py-1.5 hover:bg-gray-100 rounded text-[10px] font-medium text-gray-500 hover:text-gray-900 transition-colors">{s * 100}%</button>))}<div className="w-px h-3 bg-gray-200 mx-1"></div><button onClick={fitToScreen} className="px-2 py-1.5 hover:bg-gray-100 rounded text-[10px] font-medium text-gray-500 hover:text-brand-600 transition-colors flex items-center gap-1" title="Fit to Screen"><Maximize size={10} /> Fit</button></div>
                    </div>
                </div>
            </div>

            {/* 3. 3D Preview */}
            <div className="absolute top-20 right-8 w-80 h-80 bg-white rounded-2xl border border-white/50 shadow-2xl overflow-hidden z-30 ring-1 ring-gray-100">
                <div className="relative w-full h-full bg-gray-50">
                    <Canvas
                        shadows
                        camera={{ position: [0, 0, 50], fov: 50 }}
                        gl={{
                            antialias: true,
                            toneMapping: THREE.ACESFilmicToneMapping,
                            toneMappingExposure: 1.0
                        }}
                    >
                        <React.Suspense fallback={null}>
                            <PreviewScene config={config} canvasRef={canvasRef} version={previewVersion} />
                        </React.Suspense>
                    </Canvas>
                    <div className="absolute top-3 left-3 bg-white/80 backdrop-blur px-2 py-1 rounded-md text-[10px] font-bold text-gray-500 shadow-sm uppercase tracking-wider border border-white">Live Preview</div>
                </div>
            </div>
        </div>
    );
};

export default TextureEditor;
