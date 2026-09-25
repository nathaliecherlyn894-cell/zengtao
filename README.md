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
- `js/music.js`：背景音乐、右上角开关、板块切歌及视频避让。
- `assets/`：按页面用途分类保存图片和音乐；音乐来源见 `assets/music/CREDITS.md`。

如果要修改 PPT 作品墙，优先查看 `css/ppt-portfolio.css` 和 `js/ppt-wall.js`；如果只改个人资料或页面文字，查看 `index.html`。

## 本地查看

最简单的方式是直接用浏览器打开 `index.html`。也可以在项目目录运行：

```powershell
python -m http.server 4173
```

然后访问 `http://127.0.0.1:4173/`。

## 音乐行为

首次访问尝试有声自动播放；浏览器拒绝时只显示右上角小巧的“开启音乐”按钮，由访客点击开启。首页使用 Carefree，AIGC 使用 Bit Quest，自媒体使用 Funk Game Loop，PPT 使用 Wallpaper。首页横向滑动不换曲，进入详情页才切换。

访客主动关闭后，本次标签页会话（包括刷新）保持关闭。打开 AIGC 视频弹窗或隐藏标签页时暂停，关闭弹窗或回到标签页时仅在原先开启音乐的情况下恢复。音频加载失败不影响作品页面。手机系统对音量控制的支持可能不同，因此音频文件也已统一为较低响度。

音乐交互测试：`node --test tests/music.cjs`（使用与其他浏览器测试相同的 Playwright 环境）。自动播放允许和拒绝分别验证；拒绝策略由测试模拟，播放解码使用真实本地 MP3。标签页隐藏/恢复通过 visibilitychange 事件验证。

## 检查

结构和资源路径检查：

```powershell
node --test tests/project-structure.cjs
```

PPT 作品墙浏览器检查需要本机已有 Playwright。测试覆盖桌面、手机横竖屏、拖动缩放、一列半布局、四边 DRAG 和 16 张作品预览。
