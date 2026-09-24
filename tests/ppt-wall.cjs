// 运行：NODE_PATH 指向已安装的 playwright，可用 CHROMIUM_EXECUTABLE 指定浏览器。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

async function withWall(size, run, mobile = false) {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || undefined });
    try {
        const page = await browser.newPage({ viewport: size, isMobile: mobile, hasTouch: mobile });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
        await page.evaluate(() => openPPTPage());
        await page.locator('#reveal-canvas-btn').click();
        await page.waitForTimeout(1500);
        await run(page);
        assert.deepEqual(errors, [], '页面无 JavaScript 错误');
    } finally {
        await browser.close();
    }
}

async function visibleCardPoint(page) {
    return page.evaluate(() => {
        const wall = document.querySelector('#dedicated-infinite-wrapper');
        const area = wall.querySelector('.canvas-viewport').getBoundingClientRect();
        for (const item of wall.querySelectorAll('.infinite-item')) {
            const r = item.getBoundingClientRect();
            const x = (Math.max(r.left, area.left + 50) + Math.min(r.right, area.right - 50)) / 2;
            const y = (Math.max(r.top, area.top + 110) + Math.min(r.bottom, area.bottom - 50)) / 2;
            if (x > r.left && x < r.right && y > r.top && y < r.bottom && document.elementFromPoint(x, y) === item) return { x, y };
        }
        throw new Error('没有可以实际点击的作品');
    });
}

test('桌面和手机在任意循环位置及缩放过渡中都没有超出正常间距的空洞', async () => {
    await withWall({ width: 1440, height: 900 }, async page => {
        for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740 }, { width: 844, height: 390 }]) {
            await page.setViewportSize(size);
            await page.waitForTimeout(150);
            const failures = await page.evaluate(async () => {
                const wall = document.querySelector('#dedicated-infinite-wrapper');
                const i = wall.__instance;
                const viewport = wall.querySelector('.canvas-viewport') || wall;
                const area = viewport.getBoundingClientRect();
                const failures = [];
                const largestGap = (intervals, min, max) => {
                    intervals.sort((a, b) => a[0] - b[0]);
                    let end = min, gap = 0;
                    for (const [a, b] of intervals) {
                        if (b < min || a > max) continue;
                        gap = Math.max(gap, a - end);
                        end = Math.max(end, b);
                    }
                    return Math.max(gap, max - end);
                };
                i.container.style.transition = 'none';
                for (const scale of [1, 0.85, 0.75]) {
                    i.container.style.transform = `scale(${scale})`;
                    for (let n = 0; n < 18; n++) {
                        i.currX = i.targetX = (n - 9) * 137.3;
                        i.currY = i.targetY = (n - 9) * 219.7;
                        await new Promise(requestAnimationFrame);
                        const rects = Array.from(i.container.children, el => el.getBoundingClientRect());
                        const xGap = largestGap(rects.map(r => [r.left, r.right]), area.left, area.right);
                        const columns = new Map();
                        for (const r of rects) {
                            if (r.right <= area.left || r.left >= area.right) continue;
                            const key = Math.round(r.left * 10);
                            if (!columns.has(key)) columns.set(key, []);
                            columns.get(key).push([r.top, r.bottom]);
                        }
                        const yGap = Math.max(...Array.from(columns.values(), col => largestGap(col, area.top, area.bottom)));
                        if (xGap > i.gapX * scale + 2 || yGap > i.gapY * scale + 2) failures.push({ scale, n, xGap, yGap });
                    }
                }
                return failures;
            });
            assert.deepEqual(failures, [], `${size.width}×${size.height} 不应有缺列或缺行`);
        }
    });
});

test('手机静止时为一列半，触摸时保留 75% 缩放和四边动画，取消手势后可再次点击', async () => {
    await withWall({ width: 390, height: 844 }, async page => {
        const layout = await page.evaluate(() => {
            const w = document.querySelector('#dedicated-infinite-wrapper');
            const i = w.__instance;
            const area = (w.querySelector('.canvas-viewport') || w).getBoundingClientRect();
            return { actual: i.itemW * 1.5 + i.gapX, expected: area.width };
        });
        assert.ok(Math.abs(layout.actual - layout.expected) < 2, JSON.stringify(layout));
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 160, y: 300 }] });
        for (let n = 1; n <= 12; n++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 160 + n * 5, y: 300 + n * 5 }] });
            await page.waitForTimeout(45);
        }
        const active = await page.evaluate(() => {
            const wall = document.querySelector('#dedicated-infinite-wrapper');
            return { scale: new DOMMatrix(getComputedStyle(wall.querySelector('.infinite-canvas-container')).transform).a,
                border: getComputedStyle(wall.querySelector('.drag-border-overlay')).opacity,
                sides: Array.from(wall.querySelectorAll('.drag-bar'), b => b.getBoundingClientRect().width > 0 && b.getBoundingClientRect().height > 0) };
        });
        assert.ok(Math.abs(active.scale - 0.75) < 0.01);
        assert.equal(active.border, '1');
        assert.deepEqual(active.sides, [true, true, true, true]);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        await page.waitForTimeout(900);
        assert.equal(await page.evaluate(() => document.querySelector('#dedicated-infinite-wrapper').__instance.isDragging), false);
        assert.equal(await page.locator('#ppt-lightbox').evaluate(el => el.classList.contains('active')), false);
        const point = await visibleCardPoint(page);
        await page.touchscreen.tap(point.x, point.y);
        assert.equal(await page.locator('#ppt-lightbox').isVisible(), true, '取消手势后仍能点击作品');
        await page.locator('#lightbox-close').tap();
        await page.setViewportSize({ width: 844, height: 390 });
        await page.waitForTimeout(300);
        const rotated = await page.evaluate(() => {
            const w = document.querySelector('#dedicated-infinite-wrapper');
            const i = w.__instance;
            return { columns: (w.querySelector('.canvas-viewport').clientWidth - i.gapX) / i.itemW,
                top: w.getBoundingClientRect().top, overflow: document.documentElement.scrollWidth > innerWidth };
        });
        assert.ok(Math.abs(rotated.columns - 1.5) < 0.01);
        assert.ok(Math.abs(rotated.top) < 1);
        assert.equal(rotated.overflow, false);
    }, true);
});

test('鼠标往返拖动不误开大图，滚轮、真实点击、Escape 和退出重进可用', async () => {
    await withWall({ width: 1440, height: 900 }, async page => {
        const point = await visibleCardPoint(page);
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
        await page.mouse.move(point.x + 140, point.y + 60, { steps: 10 });
        await page.mouse.move(point.x, point.y, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(900);
        assert.equal(await page.locator('#ppt-lightbox').isVisible(), false);
        const before = await page.evaluate(() => document.querySelector('#dedicated-infinite-wrapper').__instance.targetY);
        await page.mouse.wheel(120, 240);
        await page.waitForTimeout(900);
        const after = await page.evaluate(() => document.querySelector('#dedicated-infinite-wrapper').__instance.targetY);
        assert.ok(after < before, '滚轮继续移动作品墙');
        const next = await visibleCardPoint(page);
        await page.mouse.click(next.x, next.y);
        assert.equal(await page.locator('#ppt-lightbox').isVisible(), true);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#ppt-lightbox').isVisible(), false);
        await page.locator('.btn-close-ppt').click();
        await page.waitForTimeout(600);
        assert.equal(await page.evaluate(() => document.body.style.overflow), '');
        await page.evaluate(() => openPPTPage());
        await page.locator('#reveal-canvas-btn').click();
        await page.waitForTimeout(1500);
        const reopened = await visibleCardPoint(page);
        await page.mouse.click(reopened.x, reopened.y);
        assert.equal(await page.locator('#ppt-lightbox').isVisible(), true);
    });
});

test('全部 16 张素材均能完整预览并关闭，手机横屏也不超出屏幕', async () => {
    await withWall({ width: 844, height: 390 }, async page => {
        for (let n = 1; n <= 16; n++) {
            await page.locator(`.infinite-item[data-img$="/PPT${n}.jpg"]`).first().dispatchEvent('click');
            await page.waitForTimeout(80);
            const preview = await page.locator('#ppt-lightbox').evaluate(el => {
                const img = el.querySelector('img');
                const r = img.getBoundingClientRect();
                return { active: el.classList.contains('active'), position: getComputedStyle(el).position,
                    fits: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
                    loaded: img.complete && img.naturalWidth > 0, fit: getComputedStyle(img).objectFit };
            });
            assert.equal(preview.active, true);
            assert.equal(preview.position, 'fixed');
            assert.equal(preview.loaded, true);
            assert.equal(preview.fits, true);
            assert.equal(preview.fit, 'contain');
            await page.locator('#lightbox-close').click();
            assert.equal(await page.locator('#ppt-lightbox').isVisible(), false);
        }
    }, true);
});

test('手机纵向循环接缝不会连续显示同一张作品', async () => {
    await withWall({ width: 390, height: 844 }, async page => {
        const duplicates = await page.evaluate(async () => {
            const wall = document.querySelector('#dedicated-infinite-wrapper');
            const i = wall.__instance;
            i.container.style.transition = 'none';
            i.container.style.transform = 'scale(0.75)';
            i.currY = i.targetY = 50;
            await new Promise(requestAnimationFrame);
            const area = wall.querySelector('.canvas-viewport').getBoundingClientRect();
            const columns = new Map();
            for (const item of i.items) {
                const r = item.getBoundingClientRect();
                if (r.right <= area.left || r.left >= area.right || r.bottom <= area.top || r.top >= area.bottom) continue;
                const key = Math.round(r.left);
                if (!columns.has(key)) columns.set(key, []);
                columns.get(key).push({ top: r.top, src: item.dataset.img });
            }
            const duplicates = [];
            for (const col of columns.values()) {
                col.sort((a, b) => a.top - b.top);
                for (let n = 1; n < col.length; n++) if (col[n].src === col[n - 1].src) duplicates.push(col[n].src);
            }
            return duplicates;
        });
        assert.deepEqual(duplicates, []);
    }, true);
});
