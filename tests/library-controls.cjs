const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    try {
        for (const mobile of [false, true]) {
            const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto('http://127.0.0.1:4173/library.html');
            await page.waitForFunction(() => window.libraryDiagnostics?.().ready);
            assert.equal(await page.locator('.title-block, #pause, .coordinate, .speed').count(), 0, '移除标题、暂停和状态栏');
            const hold = page.locator('#hold'), music = page.locator('#music-toggle');
            assert.equal(await hold.innerText(), '长按 · 加速');
            assert.equal(await music.innerText(), '', '音乐按钮只保留图标');
            assert.match(await music.getAttribute('aria-label'), /配乐/);
            const holdBox = await hold.boundingBox(), musicBox = await music.boundingBox();
            assert.ok(holdBox.width <= 160 && holdBox.height >= 44, '长按按钮小巧且方便点击');
            assert.ok(musicBox.width <= 48 && musicBox.height >= 44, '音乐按钮保持小尺寸与触摸区域');
            const x = holdBox.x + holdBox.width / 2, y = holdBox.y + holdBox.height / 2;
            let session;
            if (mobile) {
                session = await page.context().newCDPSession(page);
                await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
            } else { await page.mouse.move(x, y); await page.mouse.down(); }
            await page.waitForTimeout(1500);
            assert.equal(await hold.innerText(), '松开 · 减速');
            assert.ok(await page.evaluate(() => libraryDiagnostics().speed > 3.5));
            if (mobile) await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            else await page.mouse.up();
            await page.waitForTimeout(1500);
            assert.equal(await hold.innerText(), '长按 · 加速');
            assert.ok(await page.evaluate(() => libraryDiagnostics().speed < 1.05));
            if (!mobile) {
                const playing = await music.getAttribute('aria-pressed');
                await music.focus(); await page.keyboard.press('Space');
                await page.waitForFunction(previous => document.querySelector('#music-toggle').getAttribute('aria-pressed') !== previous, playing, { timeout: 2000 });
            }
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.waitForFunction(() => libraryDiagnostics().paused);
            const offset = await page.evaluate(() => libraryDiagnostics().offset);
            await page.waitForTimeout(200);
            assert.equal(await page.evaluate(() => libraryDiagnostics().offset), offset);
            assert.equal(await hold.innerText(), '点击 · 开始');
            if (mobile) await hold.tap(); else { await hold.focus(); await page.keyboard.press('Space'); }
            await page.waitForFunction(() => !libraryDiagnostics().paused);
            assert.equal(await hold.innerText(), '长按 · 加速');
            await page.waitForTimeout(900);
            await page.screenshot({ path: `artifacts/library/controls-${mobile ? 'mobile' : 'desktop'}.png` });
            assert.deepEqual(errors, []);
            await page.close();
        }
        console.log('PASS：桌面与手机简洁控件、长按、松开、减少动态效果及恢复入口');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
