# 3D 服装 2D 裁片通用计算规则

当前系统通过一套“**模板映射 + 动态伸缩**”的算法，实现了 3D 模型 UV 空间到 2D 编辑器真实轮廓的转换。以下是核心规则：

## 1. 原始路径定义 (Template Definition)
我们在 `REGION_SVG_PATHS` 中为每一个标准分片定义了“原始参考系路径”。这些路径直接来源于 Blender 导出的标准 UV 打版图（存储在 `assets/svg-regions`）。

- **front (前片)**: 原始 ViewBox 为 `0 0 1065 1502.5`
- **back (后片)**: 原始 ViewBox 为 `0 0 1060.5 1502.5`
- **sleeve (袖子)**: 原始 ViewBox 为 `0 0 773 531`
- **collar (领口)**: 原始 ViewBox 为 `0 0 773 170`

## 2. 区域映射逻辑 (Region Mapping)
在编辑器启动时，系统会基于 2:1 的总画布比例 (`2048x1024`)，为各部位分配对应的“逻辑槽位” (Region)。

```javascript
// 示例：前片逻辑槽位定义
{ id: 'front', x: 0, y: 0, w: 2048 * 0.35, h: 1024 } 
```

## 3. 动态坐标变换 (Coordinate Transformation)
这是将“不规则路径”放入“逻辑矩形框”的关键。我们使用 `getRegionPathInfo` 函数计算缩放比例：

- **ScaleX** = `Region.Width` / `SVG_Template.Width` (例如: 716.8 / 1065 ≈ 0.67)
- **ScaleY** = `Region.Height` / `SVG_Template.Height` (例如: 1024 / 1502.5 ≈ 0.68)
- **Transform** = `translate(Region.X, Region.Y)` + `scale(ScaleX, ScaleY)`

**实现方式：**
- **SVG 层**：使用 SVG `g` 标签的 `transform` 属性，让浏览器自动处理矢量缩放。
- **Canvas 层**：在绘制前调用 `ctx.scale(scaleX, scaleY)`。

## 4. 2D 剪裁规则 (Canvas Clipping)
为了实现“图案不超出衣服边缘”的效果，我们在 `renderContent` 中执行以下逻辑：

1. **路径实例化**：使用 `new Path2D(d)` 创建裁片轮廓。
2. **环境变换**：平衡 Scale 和 Translate 矩阵。
3. **建立剪裁口**：调用 `ctx.clip(path)`。此时，所有后续的 `fillRect`（底色）或 `drawImage`（用户上传的 Logo）都只会在裁片内部可见。
4. **矩阵恢复**：由于贴图 layer 使用的是全局画布坐标，我们在进入 Layer 绘制前会通过 `ctx.setTransform(1,0,0,1,0,0)` 暂时回到全局坐标系，但 **Clipping 选区依然保持生效**。

## 5. 跨模型适配
- **逻辑开关**：`isTshirtShape = (shape === 'mannequin' || shape === 'custom')`。
- 如果条件成立，系统会寻找 `REGION_SVG_PATHS[region.id]`。如果找到对应路径，则由矩形渲染进化为路径渲染。
- 如果找不到对应路径（例如用户上传了一个带子的包包），系统会自动退化为矩形裁剪，确保基础功能不中断。
