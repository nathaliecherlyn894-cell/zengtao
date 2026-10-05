# 图书馆与静态样片共用素材

本目录供 `library.html` 与 `library-study.html` 共用；页面运行时从本地加载素材。虽然目录名保留 library-study，但它已是互动页的运行依赖，不能随样片截图一起清理。

## 宇航服

- 文件：`z2-spacesuit.glb`
- 来源：[NASA Z2 Spacesuit](https://science.nasa.gov/3d-resources/z2-spacesuit/)，NASA / LaRC / Advanced Concepts Lab。
- 原始下载：[Z2 Spacesuit.glb](https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/z2-spacesuit/Z2%20Spacesuit.glb)。
- 使用依据：NASA 3D Resources 提供的可下载模型；使用时遵循 [NASA 媒体使用指南](https://www.nasa.gov/nasa-brand-center/images-and-media/)，不表示 NASA 对本站的认可。
- 原始 GLB 保留；页面内调整静态肢体姿态、共享顶点法线、布料粗糙度和凹凸贴图。原模型没有骨骼和动画，当前互动页继续使用该模型，通过静态变形和整体漂浮呈现动作。

## 木材

- 来源：[Poly Haven / Dark Wood](https://polyhaven.com/a/dark_wood)。
- 许可：[CC0](https://polyhaven.com/license)。
- `wood-color.jpg`：2K 色彩贴图；`wood-normal.jpg`：2K OpenGL 法线贴图；`wood-roughness.jpg`：1K 粗糙度贴图。
- 页面根据书架尺寸映射木纹，调整颜色和粗糙度；未修改原始贴图文件。

## 渲染支持

- `RoundedBoxGeometry.js`、`DRACOLoader.js`：Three.js r169 官方附加组件；MIT 许可见 `../library/vendor/LICENSE-three.txt`。
- `draco/`：Three.js r169 分发的 Google Draco glTF 解码器；Apache 2.0 许可见 `draco/LICENSE`。
- 书籍封面沿用现有图书馆，来源记录见 `../library/credits.html`。
