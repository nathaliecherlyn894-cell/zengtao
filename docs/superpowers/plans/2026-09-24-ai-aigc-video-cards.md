# AI+编程页面 AIGC 视频卡片 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI+编程专属页面的第二、第三个项目替换为两支 AIGC 视频，并同时提供站内播放和前往抖音观看。

**Architecture:** 保留现有静态站点结构，在 `index.html` 中添加两张视频项目卡片和一个复用弹窗；由 `js/ai-portfolio.js` 按需创建抖音官方 iframe，关闭时销毁 iframe；视觉与响应式样式继续放在 `css/ai-portfolio.css`。播放器只有在访客点击时加载，两个视频共用一个弹窗。

**Tech Stack:** 原生 HTML、CSS、JavaScript、Node.js `node:test`、Playwright、抖音官方 iframe 播放器。

## Global Constraints

- 第一张 `Gemini Dynamic Visual Website` 项目卡片保持不变。
- 只修改 AI+编程专属页面，不调整首页三个横向入口、自媒体页面和 PPT 页面。
- 视频不自动播放；只有点击封面或“站内播放”后才创建 iframe。
- “去抖音观看”必须使用用户提供的分享链接，并在新标签页打开。
- 弹窗关闭后必须移除 iframe，确保声音停止。
- 不引入新的框架或运行时依赖。
- 当前工作区包含用户已确认的未提交网站改动，执行期间不提交混合了这些历史改动的生产文件。

---

### Task 1: 为视频卡片和弹窗行为建立失败测试

**Files:**
- Create: `tests/ai-videos.cjs`

**Interfaces:**
- Consumes: 页面函数 `openAIPage()`，以及新页面元素 `.ai-video-trigger`、`.ai-video-modal`、`#ai-video-frame-slot`。
- Produces: 对两个视频链接、按需 iframe、关闭清理、键盘关闭和响应式布局的行为约束。

- [ ] **Step 1: 写入静态结构和浏览器交互测试**

创建 `tests/ai-videos.cjs`。静态测试读取 `index.html`，要求第一张卡片标题仍存在，并且后两张分别包含视频 ID `7639984858277661987`、`7661531748085603508` 和两个分享链接。浏览器测试打开 AI 页面，确认初始没有 iframe；点击第二张卡片后出现只含第一个视频 ID 的 iframe；关闭后 iframe 被移除；第三张卡片打开第二个视频；按 `Escape` 后关闭并移除 iframe。分别使用 `1440×900` 和 `390×844` 验证弹窗没有横向溢出、关闭按钮在视口内。

测试中的抖音播放器请求使用 Playwright 路由返回一段空 HTML，避免网络状态影响 DOM 行为验证：

```js
await page.route('https://open.douyin.com/player/video**', route => {
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Douyin player</title>' });
});
```

- [ ] **Step 2: 运行测试并确认因功能缺失而失败**

Run:

```powershell
$env:NODE_PATH='C:\Users\xingz\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:CHROMIUM_EXECUTABLE='C:\Users\xingz\AppData\Local\ms-playwright\chromium-1228\chrome-win64\chrome.exe'
node --test tests/ai-videos.cjs
```

Expected: FAIL，失败原因是找不到 `.ai-video-trigger` 或两个视频 ID，而不是测试语法错误。

---

### Task 2: 替换后两张项目卡片并实现按需播放弹窗

**Files:**
- Modify: `index.html:270-286`
- Modify: `css/ai-portfolio.css:80-100`
- Modify: `js/ai-portfolio.js`
- Create: `assets/ai/aigc-campus-film.png`
- Create: `assets/ai/aigc-event-promo.png`
- Test: `tests/ai-videos.cjs`

**Interfaces:**
- Consumes: `.ai-video-trigger` 上的 `data-video-id`、`data-video-title`、`data-douyin-url`。
- Produces: `window.openAIVideoModal(trigger)` 和 `window.closeAIVideoModal()`；弹窗 iframe 地址格式为 `https://open.douyin.com/player/video?vid=<id>&autoplay=0`。

- [ ] **Step 1: 生成两张本地视频封面**

使用 Playwright 打开两个已验证的抖音官方播放器，等待视频首帧出现，仅截图 `video` 元素并保存为：

```text
assets/ai/aigc-campus-film.png
assets/ai/aigc-event-promo.png
```

两支视频均为横屏，封面保持 `16:9`，不下载或保存视频文件。

- [ ] **Step 2: 替换第二、第三张项目卡片并添加复用弹窗**

第二张卡片使用：

```html
<button class="ai-video-trigger" type="button"
        data-video-id="7639984858277661987"
        data-video-title="AIGC Campus Film"
        data-douyin-url="https://v.douyin.com/CGacnA2wEh0/">
```

第三张卡片使用：

```html
<button class="ai-video-trigger" type="button"
        data-video-id="7661531748085603508"
        data-video-title="AIGC Event Promo"
        data-douyin-url="https://v.douyin.com/cgEyM1ExD3g/">
```

两张卡片各自包含本地封面、播放图标、`站内播放` 文案、项目说明和独立的“去抖音观看”链接。链接设置 `target="_blank" rel="noopener noreferrer"`。

在 `#ai-portfolio-page` 末尾添加一个默认 `aria-hidden="true"` 的 `.ai-video-modal`。弹窗包含关闭按钮、`#ai-video-frame-slot`、状态说明和 `#ai-video-douyin-link`，不在 HTML 中预先放置 iframe。

- [ ] **Step 3: 添加与现有 AI 页面一致的样式**

在 `css/ai-portfolio.css` 添加：

- `.ai-video-trigger`：完整宽度、无默认按钮边框、`16:9` 封面。
- `.ai-video-play`：居中圆形播放按钮，悬停与键盘聚焦时显示蓝绿色光效。
- `.ai-douyin-link`：清楚的外部跳转入口。
- `.ai-video-modal` 与 `.is-open`：全屏深色遮罩和居中播放器。
- `.ai-video-dialog`：桌面最大宽度 `900px`，播放器区域保持 `16:9`。
- 手机视口：弹窗内边距减小，关闭按钮不超出视口。
- `prefers-reduced-motion: reduce`：移除弹窗与播放按钮的变换动画。

- [ ] **Step 4: 实现按需 iframe、关闭清理和键盘操作**

在 `js/ai-portfolio.js` 中：

```js
window.openAIVideoModal = function(trigger) {
    const videoId = trigger.dataset.videoId;
    const iframe = document.createElement('iframe');
    iframe.src = `https://open.douyin.com/player/video?vid=${encodeURIComponent(videoId)}&autoplay=0`;
    iframe.title = `${trigger.dataset.videoTitle} 抖音播放器`;
    iframe.allow = 'fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    frameSlot.replaceChildren(iframe);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
};
```

`window.closeAIVideoModal()` 必须执行 `frameSlot.replaceChildren()`、移除 `.is-open`、恢复 `aria-hidden="true"` 和 AI 页面滚动，并把焦点还给触发按钮。为每个 `.ai-video-trigger` 注册点击事件；关闭按钮、遮罩和 `Escape` 调用同一个关闭函数。

- [ ] **Step 5: 运行视频功能测试并确认通过**

Run:

```powershell
$env:NODE_PATH='C:\Users\xingz\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:CHROMIUM_EXECUTABLE='C:\Users\xingz\AppData\Local\ms-playwright\chromium-1228\chrome-win64\chrome.exe'
node --test tests/ai-videos.cjs
```

Expected: PASS，静态结构与桌面、手机交互全部通过。

---

### Task 3: 回归验证完整网站

**Files:**
- Modify: `tests/site-smoke.cjs`，在关闭 AI 页面前确保调用 `closeAIVideoModal()` 不报错并清理 iframe。
- Test: `tests/project-structure.cjs`
- Test: `tests/site-smoke.cjs`
- Test: `tests/ppt-wall.cjs`

**Interfaces:**
- Consumes: Task 2 提供的 `window.closeAIVideoModal()`。
- Produces: 完整网站的资源、作品页打开关闭和 PPT 作品墙回归证据。

- [ ] **Step 1: 先添加关闭 AI 页面时清理播放器的回归断言**

在 `tests/site-smoke.cjs` 的 AI 页面流程中打开第一张视频卡片，关闭 AI 页面后断言 `.ai-video-modal` 不含 `.is-open` 且 `#ai-video-frame-slot iframe` 数量为 `0`。

- [ ] **Step 2: 运行 smoke 测试并确认失败**

Run: `node --test tests/site-smoke.cjs`

Expected: 若 `closeAIPage()` 尚未调用播放器清理函数，则 FAIL 于弹窗仍打开或 iframe 仍存在。

- [ ] **Step 3: 在关闭 AI 页面时复用清理函数**

在 `js/main.js` 的 `closeAIPage()` 开头添加：

```js
if (typeof window.closeAIVideoModal === 'function') {
    window.closeAIVideoModal();
}
```

- [ ] **Step 4: 运行完整验证**

Run:

```powershell
node --test tests/project-structure.cjs
$env:NODE_PATH='C:\Users\xingz\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:CHROMIUM_EXECUTABLE='C:\Users\xingz\AppData\Local\ms-playwright\chromium-1228\chrome-win64\chrome.exe'
node --test tests/site-smoke.cjs tests/ai-videos.cjs tests/ppt-wall.cjs
git diff --check
```

Expected: 所有测试通过，`git diff --check` 无空白错误。

- [ ] **Step 5: 人工浏览器检查**

在 `1440×900` 和 `390×844` 下分别截图 AI 页面第二张卡片和打开后的播放器弹窗，检查封面清晰、标题未溢出、关闭按钮可见、外链入口清楚。验证后保留网站文件，不提交包含此前用户改动的混合生产文件。
