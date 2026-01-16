# TextureEditor 技术实现原理深度解析

本文档详细解析了 `TextureEditor` 组件的核心技术实现。该组件是一个基于 React 和 Canvas API 的高性能 2D 纹理编辑器，集成了 SVG 矢量路径映射、无限画布视口、实时 3D 预览等高级特性。

## 1. 核心架构：三层渲染栈 (The 3-Layer Rendering Stack)

为了分离关注点并优化性能，编辑器采用了“三层叠加”的渲染架构：

| 层级 (Z-Index) | 组件/元素 | 技术栈 | 职责 |
| :--- | :--- | :--- | :--- |
| **底层 (Bottom)** | `canvasRef` (Content) | Canvas 2D API | **纹理生成**。负责渲染最终贴图，包括背景色、裁剪后的图片图层。此 Canvas 的内容直接作为纹理传给 3D 引擎。 |
| **中层 (Middle)** | `uiCanvasRef` (UI) | Canvas 2D API | **辅助绘制**。负责渲染用户界面的辅助线、选中框 (Gizmos)、控制手柄、虚线网格。此层对 3D 纹理无影响。 |
| **顶层 (Top)** | `<svg>` Overlay | SVG & DOM Events | **交互响应**。使用 SVG 路径精确渲染裁片轮廓，处理鼠标悬停 (Hover)、点击 (Click) 等区域级交互。 |

---

## 2. 2D 渲染引擎原理 (The Rendering Engine)

核心逻辑位于 `renderContent` 函数，它通过 **Clipping (剪裁)** 和 **Coordinate Transformation (坐标变换)** 实现了“所见即所得”的非矩形编辑体验。

### 2.1 真实的裁片映射 (SVG Path Mapping)
系统不再使用简单的矩形，而是基于 `REGION_SVG_PATHS` 常量定义了真实的 T 恤裁片路径（Front, Back, Sleeve, Collar）。每个区域都有其原始的 SVG Path Data (`d` 属性) 和标准宽高。

### 2.2 动态剪裁管线 (The Clipping Pipeline)
为了确保用户放置的图片只显示在衣服裁片内，渲染管线执行了以下严格步骤：

1.  **区域遍历**：遍历所有定义的 `Region` (如前片、袖子)。
2.  **建立剪裁区 (Setup Clipping)**：
    *   `ctx.save()`：保存当前状态。
    *   **计算变换矩阵**：根据 `Region` 在画布上的目标尺寸与 SVG 原始尺寸，计算 `scaleX`, `scaleY`。
    *   **应用变换**：`ctx.translate(r.x, r.y)` -> `ctx.scale(scaleX, scaleY)`。
    *   **创建路径与剪裁**：`const p = new Path2D(d); ctx.clip(p);`。此时，画布被物理限制在不规则的 SVG 形状内。
    *   **绘制背景**：在当前（已缩放的）坐标系下填充区域底色。
3.  **坐标系重置 (Coordinate Reset)**：
    *   **关键一步**：由于后续的图层 (Layers) 是基于全局画布坐标 (`layer.x`, `layer.y`) 存储的，我们需要在保持 Clip 生效的同时，将绘图坐标系恢复为全局坐标系。
    *   执行 `ctx.setTransform(1, 0, 0, 1, 0, 0)`。注意：Canvas 的 `clip()` 状态不受 `setTransform` 影响，因此**剪裁依然有效**，但后续绘图可以使用常规像素坐标。
4.  **绘制图层 (Draw Layers)**：
    *   筛选出中心点位于当前区域内的图层。
    *   对每个图层应用其自身的变换：Translate -> Rotate -> Scale。
    *   执行 `ctx.drawImage`。**结果：图层被正确绘制，且超出 SVG 边界的部分被自动隐藏。**
5.  **恢复状态**：`ctx.restore()`，准备绘制下一个区域。

---

## 3. 交互系统 (Interaction System)

### 3.1 无限画布视口 (Infinite Viewport)
通过 `view` 状态 (`x, y, scale`) 管理视口。交互层通过监听 `onWheel` 事件更新 `view`。
*   **坐标转换公式**：`Screen (Pixel) -> Canvas (Logic)`
    $$ CanvasX = (ScreenX - Rect.Left - View.X) / View.Scale $$

### 3.2 撞击检测 (Hit Testing)
`getHitInfo` 函数实现了复杂的几何检测算法：
*   **旋转矩形检测**：为了精准选中旋转后的图片，使用了逆向旋转法。
    *   将鼠标点 $P$ 绕图层中心 $C$ 逆时针旋转 $-\theta$ 度，得到 $P'$。
    *   检查 $P'$ 是否在未旋转的原始矩形宽/高范围内 (AABB检测)。
*   **优先级**：控制手柄 (Rotate/Scale) > 区域 (Region) > 图层本体 (Body) > 背景。

### 3.3 状态机 (Interaction State Machine)
`interactionRef` 维护了当前的拖拽模式 (`mode`)：
*   `pan`: 空格键或中键拖拽画布。
*   `move_layer`: 改变图层 `x, y`。
*   `rotate_layer`: 计算鼠标与图层中心的 `Math.atan2` 角度差。
*   `scale_layer`: 计算鼠标到中心距离的比例变化 (`currDist / startDist`)。

---

## 4. 3D 同步机制 (3D Synchronization)

编辑器实现了毫秒级的 2D 到 3D 纹理同步：

1.  **CanvasTexture**：`PreviewScene` 组件中创建一个 `THREE.CanvasTexture`，直接绑定到 2D 的 `canvasRef.current`。
2.  **色彩空间管理**：设置 `texture.colorSpace = THREE.SRGBColorSpace` 和 `texture.flipY = true` 以修正 WebGL 的坐标系差异。
3.  **实时更新**：
    *   当 React 状态 (`layers`, `config`) 变化触发重绘后，`version` 计数器加一。
    *   `useFrame` 或 `useEffect` 检测到变化，标记 `texture.needsUpdate = true`。
    *   Three.js 引擎在下一帧自动将 Canvas 像素上传至 GPU，这使得 3D 模型表面的图案也会随之“即时”移动。

## 5. 自定义模型适配 (Custom Model Support)

针对用户上传的任意 GLB 模型，系统实现了自动化的 UV 分析：
1.  **UV 聚类算法**：将复杂的 UV 坐标投射到 128x128 的网格上，使用**连通分量分析 (Connected Components)** 识别出独立的 UV 岛 (Islands)。
2.  **Simple Bin Packing**：计算出的 UV 岛通过简易的装箱算法 (`computeUVLayout`) 自动排列到画布上，防止重叠。
3.  **形状退回与兼容**：
    *   如果 `config.shape` 被识别为 `custom`，代码逻辑上与 `mannequin` (T恤) 共享 SVG 路径处理逻辑。
    *   这意味着只要用户上传的模型符合 T 恤的标准分片逻辑（或我们强制应用 T 恤模板），它就能享受到同样的 SVG 剪裁与渲染特性。

## 总结
`TextureEditor` 不仅仅是一个画板，它实际上是一个**基于矢量约束的光栅渲染引擎**。它巧妙地利用了 Canvas 的 `clip()` 特性解决了 3D 贴图中最困难的“边界溢出”问题，并通过矩阵变换将复杂的 SVG 路径坐标系与直观的图层操作坐标系无缝融合。
