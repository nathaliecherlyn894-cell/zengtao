const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const folder = path.resolve(__dirname, '../artifacts/library');
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:4173/library.html');
        await page.waitForFunction(() => window.libraryDiagnostics?.().ready);
        assert.equal(await page.evaluate(() => libraryDiagnostics().daylight?.windows), 6, '主窗光应绑定在六处循环窗口上');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(folder, 'daylight-desktop.png') });
        await page.waitForFunction(() => libraryDiagnostics().daylight.illumination > 3);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => libraryDiagnostics().paused);
        await page.screenshot({ path: path.join(folder, 'daylight-suit.png') });
        const paused = await page.evaluate(() => libraryDiagnostics().daylight);
        await page.waitForTimeout(250);
        assert.deepEqual(await page.evaluate(() => libraryDiagnostics().daylight), paused, '暂停后窗口和受光应停留');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.waitForFunction(() => !libraryDiagnostics().paused);
        await page.mouse.move(750, 600); await page.mouse.down();
        const samples = await page.evaluate(() => new Promise(resolve => {
            const values = []; const start = performance.now();
            function sample(now) {
                const state = libraryDiagnostics();
                values.push({ offset: state.offset, ...state.daylight });
                if (now - start > 14000) resolve(values); else requestAnimationFrame(sample);
            }
            requestAnimationFrame(sample);
        }));
        await page.mouse.up();
        for (const sample of samples) for (const light of sample.lights) {
            assert.deepEqual(light.position, light.personPosition, '书架与人物的光源位置必须一致');
            assert.deepEqual(light.target, light.personTarget, '书架与人物的照射方向必须一致');
        }
        assert.ok(samples.some(s => s.illumination < .1), '离开光区后应恢复暗部');
        assert.ok(samples.some(s => s.illumination > 3), '经过窗口时应有明显受光');
        let motionChecks = 0;
        for (let i = 1; i < samples.length; i++) {
            const previous = samples[i - 1], current = samples[i];
            const delta = current.offset - previous.offset;
            if (delta <= 0 || delta > 1) continue;
            for (const light of current.lights) {
                const old = previous.lights.find(l => l.window === light.window);
                if (!old) continue;
                const distance = Math.hypot(...light.position.map((v, j) => v - old.position[j]));
                assert.ok(Math.abs(distance - delta) < .0001, '窗口光必须随实际书架移动');
                motionChecks++;
            }
        }
        assert.ok(motionChecks > 100);
        const maxStep = Math.max(...samples.slice(1).map((s, i) => Math.abs(s.illumination - samples[i].illumination)));
        assert.ok(maxStep < 2, '经过光区时应渐变，不应闪烁');
        assert.deepEqual(errors, []);
        const report = { min: Math.min(...samples.map(s => s.illumination)), max: Math.max(...samples.map(s => s.illumination)), maxStep, motionChecks, pause: 'PASS', errors, result: 'PASS' };
        fs.writeFileSync(path.join(folder, 'light-checks.json'), JSON.stringify(report, null, 2));
        console.log(report);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
