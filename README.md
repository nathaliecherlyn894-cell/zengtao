# 邢增涛个人网站

这是一个使用原生 HTML、CSS 和 JavaScript 制作的静态个人网站，可以直接部署到 GitHub Pages，不需要安装框架或执行构建命令。

## 从哪里开始看

- `index.html`：网站首页入口，主要保存页面文字和结构。
- `css/base.css`：全站公共样式和主页样式。
- `css/ai-portfolio.css`：AI 作品页样式。
- `css/ppt-portfolio.css`：PPT 页面、作品墙、DRAG 边框和大图预览样式。
- `css/media-portfolio.css`：自媒体作品页样式。
- `js/main.js`：打开和关闭各个作品页。
- `js/home.js`：主页滚动、鼠标跟随和轮播效果。
- `js/ai-portfolio.js`：AI 页面动画。
- `js/media-portfolio.js`：自媒体页面动画。
- `js/ppt-wall.js`：PPT 作品墙的拖动、缩放、循环和预览。
- `assets/`：按页面用途分类保存图片。

如果要修改 PPT 作品墙，优先查看 `css/ppt-portfolio.css` 和 `js/ppt-wall.js`；如果只改个人资料或页面文字，查看 `index.html`。

## 本地查看

在项目根目录启动本地服务，确保首页和 3D 书架都能正常访问：

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

然后访问 `http://127.0.0.1:4173/`。服务已运行时直接访问即可，不必重复启动。不要用 `file://` 打开图书馆，否则模块和素材可能无法加载。

线上首页：[邢增涛个人网站](https://nathaliecherlyn894-cell.github.io/zengtao/)；书架入口：[我的书架](https://nathaliecherlyn894-cell.github.io/zengtao/library.html)。GitHub Pages 从 `main` 分支根目录发布，推送后应核对部署状态与线上资源。当前功能以本 README 和实现代码为准，`docs/superpowers/plans/` 中的书架方案属于历史过程。此前收尾审计见 [收尾记录](docs/closeout-2026-10-03.md)。

## 无尽书架

首页 AIGC 实战与 PPT 作品展示之间新增“我的书架”实景封面卡片，点击整卡进入 `library.html`；顶部“我的图书馆”入口仍可使用。封面为 `assets/library/entry-cover.jpg`，首页仅加载静态图片。图书馆包含本地 Three.js、宇航员模型和 56 张书籍封面，需要通过上面的本地 HTTP 服务或网站地址访问，不能直接双击 HTML。

- 底部仅保留小巧的「长按 · 加速」按钮，按住显示「松开 · 减速」。长按场景同样可加速，键盘可按住空格；标题介绍、暂停按钮和底部状态/速度栏已移除。
- 长按约 0.2 秒后，镜头平滑后退并略向上看，露出人物上方更多书架；桌面人物缩小约 29%，手机约 17%，视角保持不变。镜头按倾斜通道的截面限制在内部，避免宽屏时退入侧面书架。松手约一秒后基本回到原构图，重复按压从当前位置平滑衔接。
- 五面书架围合通道，现有 NASA Z2 宇航员在普通漂浮时保持背部朝向镜头、头朝右上、脚朝左下的舒展斜漂姿态，双臂与收腿幅度不对称；空间朝画面右下方深入。长按触发后约 1.6 秒平滑转为横向平放，躯干平行通道横截面、胸腹朝深处、后背朝镜头；松手约两秒恢复，重复按压连续衔接；身体转动独立于镜头拉远和加速节奏。原丝带已改为带亮芯和柔边的冷白光束。长按时光带增亮、分出弯曲光丝，松开后随减速收回。
- 外围增加两层错位格架、细梁和光窗；完整结构经过镜头后才循环回收。清晨淡金、略带桃色的阳光从主窗口透出，窗面、局部光晕、薄光束和实际照明统一为暖色，外围小窗与之协调，通道暗部与光丝仍为冷色；宇航员经过窗口时受光，暂停时光影同步停留。
- 系统设置“减少动态效果”时默认暂停，底部按钮显示「点击 · 开始」，可用点击或键盘开始漂浮。
- `js/library.js` 负责渲染与交互，`js/library-space.js` 负责五面书架、条带和光窗，`js/library-cinematic-assets.js` 负责现有模型的加载与静态身位，`js/library-motion.mjs` 负责加减速，`css/library.css` 负责界面。
- `js/library-daylight.js` 将日光固定在窗口上；人物与书架共享场景深度、光源及阴影，窗光以渐淡的斜向光束进入通道。
- 写实升级沿用静态样片的 NASA Z2 宇航服、真实木纹/法线/粗糙度、金属包边与内层书架倒角。`js/library-cinematic-assets.js` 集中加载本地素材；手脚保持固定造型，整体在斜漂与长按平放姿态间平滑旋转，尚无骨骼动画。
- 场景使用 HDR 离屏渲染、冷色暗部和克制的高光柔化。长按运动模糊主要作用于远景，近处人物保持清晰；进入时先编译材质，再退去加载遮罩。
- 长按时外围径向模糊强度由 0.14 提至 0.18，采样增至 16 次；模糊中心跟随镜头消失点，人物清晰区域随镜头距离调整。循环回收与远端渐隐按整段镜头路径预留。
- `js/library-depth-reveal.js` 随长按将雾浓度从 0.024 平缓降到 0.0144，远处照明沿通道推进；右下消失点附近减轻运动模糊。书架、光丝和窗光另有统一远端渐隐，根据镜头与回收边界计算，避免提高可视度后露出循环接缝。松手后恢复原来的雾与光线。
- 远端雾与背景同色，隐藏循环边界；离屏渲染使用多重采样抗锯齿，远处光芯按像素宽度柔化。
- `assets/library/books.json` 保存书名、封面路径与来源，未包含阅读笔记正文。
- 素材来源与许可见 `assets/library/credits.html`。
- 配乐为用户提供视频中分离的《Cornfield Chase》，网页使用裁掉前 8 秒的 `assets/library/cornfield-chase-trimmed.m4a`，时长约 1 分 56 秒；原始分离音轨 `assets/library/cornfield-chase.m4a` 保留。裁切版精确解码后以 AAC 256 kbps 重新编码。进入页面尝试有声自动播放；浏览器限制时，首次点击或长按页面后开始。右上角仅保留音符图标，中文提示，亮暗区分播放与暂停；自动循环，离开页面停止。手动暂停后操作场景不会重新开启。

图书馆逻辑检查：`node --test tests/library-motion.test.mjs tests/project-structure.cjs`。
浏览器检查：启动本地服务后运行 `node tests/library-browser.cjs`，需已安装 Playwright 与 Edge；截图与检查结果保存在 `artifacts/library/`。音频实播、暂停、续播、循环和手机触摸检查：`node tests/library-audio.cjs`。
光丝散射、增亮与松开回落检查：`node tests/library-scatter.cjs`；远端连续性、帧间隔与几何回收检查：`node tests/library-horizon.cjs`、`node tests/library-depth.cjs`。
简洁控件、桌面和手机长按、减少动态效果下开始入口检查：`node tests/library-controls.cjs`。
写实素材、共享深度、斜漂姿态、桌面/手机模拟和帧间隔检查：`node tests/library-cinematic.cjs`；结果与截图在 `artifacts/library-cinematic/`。手机性能数据来自本机浏览器模拟，不能代替真机测试。
长按显露远景、松手回落、深层实际像素与高可视度循环末端检查：`node tests/library-depth-reveal.cjs`，对比截图在 `artifacts/library-depth-reveal/`。
长按镜头拉远、向上取景、松手/失焦恢复、人物清晰范围及镜头路径循环边界检查：`node tests/library-camera.cjs`；桌面与手机模拟截图和结果在 `artifacts/library-camera/`。
人物遮挡回归：`node tests/library-camera-occlusion.cjs`，覆盖五种屏幕尺寸、五个镜头位置和完整循环内的书架位置，按实际渲染像素比较人物可见轮廓；证据在 `artifacts/library-camera-occlusion/`。
长按平放姿态、背部朝向、短按、松手恢复、再次按压连续性与失焦恢复检查：`node tests/library-pose.cjs`；桌面与手机模拟前后截图在 `artifacts/library-pose/`。遮挡回归同时覆盖整个转身过程、手脚取景范围和人物清晰深度。
按用户最新决定继续使用现有 Z2 模型，仅调整身位，不再等待替换模型。此前的 `library-astronaut-options.html` 保留为独立参考页，未接入主页。

## 写实静态样片

通过本地 HTTP 服务打开 `http://127.0.0.1:4173/library-study.html`，验收宇航服、木纹、金属及斜向窗光。样片独立于现有互动版，只在加载和调整窗口时渲染，不包含漂浮动画、长按加速或音乐。

该页保留早期外观验收构图；NASA Z2 和木纹素材已接入互动页，原始模型仍没有骨骼或动画。互动页的身位、清晨窗光及长按效果以 `library.html` 为准。`assets/library-study/` 是两页共用的运行素材，不能当作临时样片目录删除。素材与许可记录见 [素材说明](assets/library-study/README.md)。

浏览器检查：`node tests/library-study.cjs`；实际渲染的全景、人物细节和手机模拟截图保存在 `artifacts/library-study/`。互动页验证见上面的图书馆检查命令。

## 检查

结构和资源路径检查：

```powershell
node --test tests/project-structure.cjs
```

浏览器检查需要 Node.js 能解析已安装的 `playwright`（必要时设置 `NODE_PATH` 指向安装目录）。图书馆脚本使用本机 Edge，并需要本地 4173 服务；建议串行运行，避免后台标签影响帧率与等待。

PPT 作品墙检查：`node --test tests/ppt-wall.cjs`，需要 Playwright 的 Chromium 或通过 `CHROMIUM_EXECUTABLE` 指定本机浏览器。覆盖手机横竖屏、拖动缩放、四边 DRAG 和 16 张作品预览。

`scripts/prepare-library.py` 是初版封面与依赖准备脚本，会读取它指定的本地知识库目录并重写 `books.json`，不是网站启动步骤，也不会准备当前 Z2、木纹和音乐素材。已有素材可直接运行网站。
