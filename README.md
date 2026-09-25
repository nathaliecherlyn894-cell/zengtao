# 邢增涛个人网站

这是一个使用原生 HTML、CSS 和 JavaScript 制作的静态个人网站，可以直接部署到 GitHub Pages，不需要安装框架或执行构建命令。

## 从哪里开始看

- `index.html`：网站唯一入口，主要保存页面文字和结构。
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

最简单的方式是直接用浏览器打开 `index.html`。也可以在项目目录运行：

```powershell
python -m http.server 4173
```

然后访问 `http://127.0.0.1:4173/`。

## 检查

结构和资源路径检查：

```powershell
node --test tests/project-structure.cjs
```

PPT 作品墙浏览器检查需要本机已有 Playwright。测试覆盖桌面、手机横竖屏、拖动缩放、一列半布局、四边 DRAG 和 16 张作品预览。
