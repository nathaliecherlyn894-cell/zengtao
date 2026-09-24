# 个人网站文件结构整理计划

**目标：** 在不改变网站视觉和交互的前提下，将 `index.html` 中的 CSS、JavaScript 和根目录图片整理为易理解、易维护的结构。

**技术约束：** 保持原生 HTML、CSS、JavaScript；不引入框架、打包工具或线上依赖；继续兼容 GitHub Pages 和本地静态预览。

## 文件边界

- `index.html`：只保留页面结构和外部资源引用。
- `css/base.css`：全站令牌、主页、公共组件、打印和基础响应式样式。
- `css/ai-portfolio.css`：AI 作品页样式。
- `css/ppt-portfolio.css`：PPT 页面、作品墙、DRAG 边框和预览样式。
- `css/media-portfolio.css`：自媒体作品页样式。
- `js/main.js`：三个作品页的打开和关闭入口。
- `js/home.js`：主页滚动、鼠标跟随和椭圆轮播。
- `js/ai-portfolio.js`：AI 页面矩阵背景和渐显观察器。
- `js/media-portfolio.js`：自媒体页面渐显和放映机状态。
- `js/ppt-wall.js`：PPT 作品墙揭示、二维拖动、缩放、循环和预览。
- `assets/`：按 `avatar`、`home`、`ai`、`ppt`、`media` 分类图片；保留 JPG/PNG 原文件，暂不删除未引用素材。
- `README.md`：用中文解释入口、目录和本地预览方法。

## 执行与验证

- [x] 新增结构检查并先确认旧结构不符合要求。
- [x] 机械拆分 CSS 和 JavaScript，更新 `index.html` 的引用。
- [x] 移动图片并更新 HTML、CSS 和 JavaScript 中所有资源路径。
- [x] 运行语法、引用、GitHub Pages 路径和浏览器回归检查。
- [x] 比较桌面、手机和横屏截图，确认整理前后视觉与交互一致。

**成功标准：** `index.html` 不再包含大段内联 CSS/JavaScript；所有资源路径有效；原有页面、PPT 75% 缩放、手机一列半、四边 DRAG 和全部大图预览保持可用。
