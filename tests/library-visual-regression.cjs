const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
let browser;
before(async () => { browser = await chromium.launch({ headless: true, channel: 'msedge' }); });
after(async () => { await browser?.close(); });

test('首页遇到缓存中的旧基础样式时仍能显示完整书架卡片', async () => {
    const oldStyle = fs.readFileSync(path.join(root, 'css/base.css'), 'utf8')
        .replace(/\.library-entry[^{]*\{[^}]*\}/g, '');
    const page = await browser.newPage();
    try {
        // 模拟旧 URL 命中旧缓存，新 URL 正常读取服务器。
        await page.route(url => url.pathname === '/css/base.css' && !url.search,
            route => route.fulfill({ contentType: 'text/css', body: oldStyle }));
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto('http://127.0.0.1:4173/');
            await page.locator('.library-entry').scrollIntoViewIfNeeded();
            await page.locator('.library-entry-cover').evaluate(image => image.decode());
            const state = await page.locator('.library-entry').evaluate(card => {
                const image = card.querySelector('img'), copy = card.querySelector('.library-entry-copy');
                const box = card.getBoundingClientRect(), imageBox = image.getBoundingClientRect(), copyBox = copy.getBoundingClientRect();
                return {
                    display: getComputedStyle(card).display,
                    fits: imageBox.left >= box.left && imageBox.right <= box.right && imageBox.bottom <= box.bottom,
                    textInside: copyBox.top >= box.top && copyBox.bottom <= box.bottom,
                    overflows: document.documentElement.scrollWidth > innerWidth,
                    href: card.getAttribute('href')
                };
            });
            assert.equal(state.display, 'flex', `${width}px：应应用书架卡片样式`);
            assert.ok(state.fits && state.textInside, `${width}px：封面和文案必须在卡片内`);
            assert.equal(state.overflows, false, `${width}px：页面不能横向溢出`);
            assert.equal(state.href, 'library.html');
        }
    } finally { await page.close(); }
});
