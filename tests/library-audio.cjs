const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
    const results = [];
    for (const policy of ['no-user-gesture-required', 'user-gesture-required']) {
      const browser = await chromium.launch({ headless: true, channel: 'msedge', args: [`--autoplay-policy=${policy}`] });
      try {
        for (const mobile of [false, true]) {
            const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile });
            await page.goto('http://127.0.0.1:4173/library.html');
            await page.waitForFunction(() => window.libraryDiagnostics?.().ready);
            const button = page.locator('#music-toggle');
            assert.equal(await button.isEnabled(), true, '本地配乐开关应可用');
            const media = page.locator('#library-audio');
            assert.equal(await media.count(), 1);
            if (policy === 'no-user-gesture-required') {
                await page.waitForFunction(() => document.querySelector('#library-audio').currentTime > .2);
            } else {
                assert.equal(await media.evaluate(audio => audio.paused), true, '浏览器限制有声自动播放时等待交互');
                if (mobile) await page.locator('#space').tap(); else await page.locator('#space').click();
            }
            await page.waitForFunction(() => document.querySelector('#library-audio').currentTime > .2);
            const state = await media.evaluate(audio => ({ duration: audio.duration, paused: audio.paused, loop: audio.loop, volume: audio.volume, ready: audio.readyState }));
            const expectedDuration = 123.786009 - 8;
            assert.ok(Math.abs(state.duration - expectedDuration) < .05, '配乐应裁掉前 8 秒，允许 50 毫秒编码容差');
            assert.equal(state.paused, false);
            assert.equal(state.loop, true);
            assert.equal(await button.getAttribute('aria-pressed'), 'true');
            if (mobile) await button.tap(); else await button.click();
            const pausedAt = await media.evaluate(audio => audio.currentTime);
            await page.waitForTimeout(300);
            assert.equal(await media.evaluate(audio => audio.currentTime), pausedAt);
            assert.equal(await button.getAttribute('aria-pressed'), 'false');
            await page.locator('#space').click();
            assert.equal(await media.evaluate(audio => audio.paused), true, '手动暂停后长按场景不应重新开启音乐');
            await button.click();
            await media.evaluate(audio => { audio.currentTime = audio.duration - .25; });
            await page.waitForFunction(() => {
                const audio = document.querySelector('#library-audio');
                return !audio.paused && audio.currentTime > .05 && audio.currentTime < 2;
            });
            await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
            assert.equal(await media.evaluate(audio => audio.paused), true, '离开页面应停止播放');
            results.push({ policy, device: mobile ? '手机触摸模拟' : '桌面', ...state, playbackPauseResumeLoop: 'PASS' });
            await page.close();
        }
      } finally { await browser.close(); }
    }
    fs.writeFileSync(path.resolve(__dirname, '../artifacts/library/audio-checks.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
