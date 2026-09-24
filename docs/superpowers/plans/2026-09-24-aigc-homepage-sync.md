# AIGC Homepage Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一首页与详情页的“AIGC 实战”命名，用两支现有 AIGC 视频替换首页作品 02、03，并把全站年级身份更新为大二。

**Architecture:** 继续使用现有静态 HTML 卡片和 `openAIPage()` 入口，只调整 `index.html` 中对应文案、封面资源和日期。新增一个 Node/Playwright 测试，验证内容映射、点击行为和桌面/手机布局。

**Tech Stack:** HTML、Node.js `node:test`、Playwright

## Global Constraints

- 首页 02、03 点击后仅打开 AIGC 详情页顶部。
- 不自动播放视频，不直接跳转抖音。
- 不改变现有视频弹窗实现和其他作品板块。
- 删除页面中的“大一”与 `FRESHMAN` 身份文字，统一为大二身份。

---

### Task 1: 首页 AIGC 内容与点击行为

**Files:**
- Modify: `index.html`
- Create: `tests/aigc-homepage.cjs`

**Interfaces:**
- Consumes: 现有全局函数 `openAIPage()` 与本地封面 `assets/ai/aigc-campus-film.jpg`、`assets/ai/aigc-event-promo.jpg`
- Produces: 三处统一的“AIGC 实战”名称，以及仍由 `openAIPage()` 打开的首页 02、03 卡片

- [ ] **Step 1: 写失败测试**

在 `tests/aigc-homepage.cjs` 中断言三处名称、02/03 内容与封面、全站大二身份，并用 Playwright 点击两个首页卡片，确认 `#ai-portfolio-page` 打开且 `scrollTop === 0`。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/aigc-homepage.cjs`

Expected: 因旧名称和旧 02/03 内容仍存在而失败。

- [ ] **Step 3: 写最小实现**

只在 `index.html` 中替换已确认的三处名称、首页 02/03 的标题、说明、日期和 `data-hover-img`，并把三处大一身份改为大二；保留三个卡片的 `onclick="openAIPage()"`。

- [ ] **Step 4: 运行专项测试**

Run: `node --test tests/aigc-homepage.cjs`

Expected: 全部通过。

- [ ] **Step 5: 运行完整验证**

Run: `node --test tests/*.cjs`

Expected: 全部测试通过，0 失败。

Run: `git diff --check`

Expected: 无输出，退出码为 0。

- [ ] **Step 6: 检查变更范围**

Run: `git diff -- index.html tests/aigc-homepage.cjs docs/superpowers/specs/2026-09-24-aigc-homepage-sync-design.md docs/superpowers/plans/2026-09-24-aigc-homepage-sync.md`

Expected: 只有本需求涉及的文案、封面映射、测试和文档。
