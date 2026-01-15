# SVG 区域映射文件

这个目录包含了用于定义 3D 模型可编辑区域的 SVG 文件。

## 文件说明

### 完整的映射文件
- **`complete-region-map.svg`** - 包含所有5个区域的完整映射文件，可以直接在编辑器中使用

### 单独的部件文件
- **`Front Bod.svg`** - 前身区域的原始 SVG 文件
- **`Back Body.svg`** - 后身区域的原始 SVG 文件  
- **`Left Sleeve.svg`** - 左袖区域的原始 SVG 文件
- **`Right Sleeve.svg`** - 右袖区域的原始 SVG 文件
- **`Collar.svg`** - 领口区域的原始 SVG 文件

## 使用方法

1. 上传自定义 3D 模型（GLB/GLTF 格式）
2. 点击"上传 SVG 区域映射"按钮
3. 选择 `complete-region-map.svg` 文件
4. 系统会自动识别并创建5个可编辑区域：
   - 前身 (Front Body)
   - 后身 (Back Body)
   - 左袖 (Left Sleeve)
   - 右袖 (Right Sleeve)
   - 领口 (Collar)

## 文件格式

每个区域路径都包含以下属性：
- `data-region-id`: 区域唯一标识符
- `data-region-label`: 显示在编辑器中的中文标签

## 编辑说明

如果需要修改区域：
1. 编辑 `complete-region-map.svg` 文件
2. 调整路径数据 (`d` 属性) 来改变区域形状
3. 修改 `data-region-label` 来更改显示名称
4. 保存后重新上传即可
