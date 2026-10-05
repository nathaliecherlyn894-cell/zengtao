const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    try {
        const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
        const errors = [], failed = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
        const response = await page.goto('http://127.0.0.1:4173/library-study.html');
        assert.equal(response.status(), 200);
        await page.waitForFunction(() => window.studyDiagnostics?.().ready, null, { timeout: 60000 });
        const state = await page.evaluate(() => studyDiagnostics());
        await page.waitForTimeout(500);
        assert.equal(await page.evaluate(() => studyDiagnostics().renders), state.renders, '静态样片不应持续更新动画');
        assert.deepEqual(errors, []); assert.deepEqual(failed, []);
        fs.mkdirSync('artifacts/library-study', { recursive: true });
        await page.screenshot({ path: 'artifacts/library-study/desktop.png' });
        await page.screenshot({ path: 'artifacts/library-study/detail.png', clip: { x: 600, y: 300, width: 580, height: 550 } });
        await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(800);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({ path: 'artifacts/library-study/mobile.png' });
        assert.deepEqual(errors, []); assert.deepEqual(failed, []);
        const report = { state, errors, failed, result: 'PASS' };
        fs.writeFileSync('artifacts/library-study/checks.json', JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report, null, 2));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
