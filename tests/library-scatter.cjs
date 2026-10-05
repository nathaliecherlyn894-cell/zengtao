const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        await page.route('**/js/library.js*', async route => {
            const response = await route.fetch();
            const body = (await response.text()).replace('window.libraryDiagnostics =',
                'window.__scatterTest = { renderer, scene, camera, space }; window.libraryDiagnostics =');
            await route.fulfill({ response, body });
        });
        await page.goto('http://127.0.0.1:4173/library.html');
        await page.waitForFunction(() => window.libraryDiagnostics?.().ready);
        await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('#loading')).opacity) === 0);
        const mirrorCount = await page.evaluate(() => {
            let count = 0; window.__scatterTest.scene.traverse(object => { if (object.isReflector) count++; }); return count;
        });
        assert.equal(mirrorCount, 0, '场景中应已移除两面镜子');
        const initial = await page.evaluate(() => libraryDiagnostics());
        assert.equal(initial.daylight.windows, 6, '保留窗口光源');
        await page.screenshot({ path: 'artifacts/library/scatter-desktop.png' });
        await page.keyboard.down('Space'); await page.waitForTimeout(1800);
        const boosted = await page.evaluate(() => libraryDiagnostics());
        assert.ok(boosted.scatter > .95, '长按应充分展开光丝');
        assert.ok(boosted.ribbonOpacity > initial.ribbonOpacity * 1.5, '长按光带应显著增亮');
        await page.screenshot({ path: 'artifacts/library/scatter-boost.png' });
        const scatterPixels = await page.evaluate(async () => {
            const THREE = await import('three');
            const { renderer, scene, camera, space } = window.__scatterTest;
            const target = new THREE.WebGLRenderTarget(360, 225);
            const read = () => {
                renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera);
                const pixels = new Uint8Array(360 * 225 * 4);
                renderer.readRenderTargetPixels(target, 0, 0, 360, 225, pixels); return pixels;
            };
            const before = read(), amount = space.scatterMaterial.uniforms.scatter.value;
            space.scatterMaterial.uniforms.scatter.value = 0; const after = read();
            space.scatterMaterial.uniforms.scatter.value = amount;
            renderer.setRenderTarget(null); target.dispose();
            let changed = 0;
            for (let i = 0; i < before.length; i += 4) if ([0, 1, 2].some(c => Math.abs(before[i + c] - after[i + c]) > 3)) changed++;
            return changed;
        });
        assert.ok(scatterPixels > 100, '展开的光丝必须在实际画面中可见');
        await page.keyboard.up('Space'); await page.waitForTimeout(1600);
        assert.ok((await page.evaluate(() => libraryDiagnostics())).scatter < .02, '松开后光丝应收回');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => libraryDiagnostics().paused);
        const paused = await page.evaluate(() => libraryDiagnostics());
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => libraryDiagnostics().offset), paused.offset, '暂停后通道应静止');
        await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
        await page.screenshot({ path: 'artifacts/library/scatter-mobile.png' });
        assert.deepEqual(errors, []);
        const report = { mirrorCount, scatterPixels, windows: initial.daylight.windows, errors, result: 'PASS' };
        fs.writeFileSync(path.join(__dirname, '../artifacts/library/scatter-checks.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report, null, 2));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
