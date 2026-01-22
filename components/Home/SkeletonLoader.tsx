import React from 'react';

// 骨架屏动画样式
const shimmer = `
  @keyframes shimmer {
    0% {
      background-position: -1000px 0;
    }
    100% {
      background-position: 1000px 0;
    }
  }
`;

// 骨架屏基础组件
export const SkeletonBox: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div
        className={`bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:1000px_100%] rounded ${className}`}
        style={{
            animation: 'shimmer 2s infinite linear'
        }}
    />
);

// 左侧分类骨架屏
export const SidebarSkeleton: React.FC = () => {
    return (
        <div className="w-64 h-full bg-white border-r border-gray-100 flex flex-col py-6 overflow-y-auto">
            <style>{shimmer}</style>

            {/* Logo 骨架 */}
            <div className="px-6 mb-6">
                <SkeletonBox className="h-8 w-32" />
            </div>

            {/* 分类列表骨架 */}
            <div className="space-y-1 px-3">
                {[...Array(8)].map((_, i) => (
                    <div
                        key={i}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
                    >
                        <div className="flex items-center gap-3 flex-1">
                            {/* 图标骨架 */}
                            <SkeletonBox className="w-9 h-9 rounded-lg" />
                            {/* 文字骨架 */}
                            <SkeletonBox className="h-4 flex-1 max-w-[120px]" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// 模型卡片骨架屏
export const ModelCardSkeleton: React.FC = () => {
    return (
        <div className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <style>{shimmer}</style>

            {/* 3D 预览区域骨架 */}
            <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                <SkeletonBox className="w-full h-full" />

                {/* 3D Badge 骨架 */}
                <div className="absolute top-3 left-3">
                    <SkeletonBox className="w-12 h-6 rounded-full" />
                </div>
            </div>

            {/* 信息区域骨架 */}
            <div className="p-4 border-t border-gray-50">
                <SkeletonBox className="h-4 w-3/4" />
            </div>
        </div>
    );
};

// 模型列表骨架屏
export const ModelListSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
    return (
        <div className="flex-1 h-full overflow-y-auto bg-gray-50/50 p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(count)].map((_, i) => (
                    <ModelCardSkeleton key={i} />
                ))}
            </div>
        </div>
    );
};
