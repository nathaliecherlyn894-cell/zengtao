const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const reports = [], folder = 'artifacts/library-depth-reveal';
    fs.mkdirSync(folder, { recursive: true });
    try {
        for (const mobile of [false, true]) {
            const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile });
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
            await page.route('**/js/library.js*', async route => {
                const response = await route.fetch();
                await route.fulfill({ response, body: (await response.text()).replace('window.libraryDiagnostics =', 'window.__revealTest = { renderer, scene, camera, space, motion }; window.libraryDiagnostics =') });
            });
            await page.goto('http://127.0.0.1:4173/library.html');
            await page.waitForFunction(() => window.libraryDiagnostics?.().ready && document.querySelector('#loading').hidden, null, { timeout: 60000 });
            const initial = await page.evaluate(() => libraryDiagnostics());
            await page.locator('#space').focus(); await page.keyboard.down('Space');
            await page.waitForFunction(() => libraryDiagnostics().speed > 3.95);
            const boost = await page.evaluate(() => libraryDiagnostics());
            assert.ok(boost.fogDensity < initial.fogDensity * .8, '长按应降低远景雾浓度，提高可视距离');
            assert.ok(boost.reveal.guideIntensity > initial.reveal.guideIntensity, '远处光线应随长按增强');
            assert.ok(boost.camera.z > initial.camera.z, '长按时镜头平滑拉远');
            assert.ok(boost.vanishing.x > 0 && boost.vanishing.y < 0, '消失点保持在右下方');
            await page.keyboard.up('Space');
            await page.waitForFunction(() => libraryDiagnostics().speed < 1.01);
            const released = await page.evaluate(() => libraryDiagnostics());
            assert.ok(Math.abs(released.fogDensity - initial.fogDensity) < .0001, '松手后雾浓度应平缓恢复');
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.waitForFunction(() => libraryDiagnostics().paused);
            const measurements = [];
            for (const speed of [1, 4]) {
                await page.evaluate(speed => { __revealTest.motion.offset = 8; __revealTest.motion.speed = speed; __revealTest.motion.cameraPull = speed === 4 ? 1 : 0; }, speed);
                await page.waitForTimeout(120);
                await page.screenshot({ path: `${folder}/${mobile ? 'mobile' : 'desktop'}-${speed === 1 ? 'drift' : 'boost'}.png` });
                measurements.push(await page.evaluate(async () => {
                    const THREE = await import('three');
                    const { renderer, scene, camera, space } = __revealTest;
                    const distantCamera = camera.clone(); distantCamera.near = 36; distantCamera.updateProjectionMatrix();
                    const target = new THREE.WebGLRenderTarget(320, 200);
                    const before = new Uint8Array(320 * 200 * 4), after = new Uint8Array(before.length);
                    renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, distantCamera);
                    renderer.readRenderTargetPixels(target, 0, 0, 320, 200, before);
                    const farthest = space.sections.reduce((a, b) => a.position.z < b.position.z ? a : b);
                    farthest.visible = false;
                    renderer.clear(); renderer.render(scene, distantCamera);
                    renderer.readRenderTargetPixels(target, 0, 0, 320, 200, after);
                    farthest.visible = true; renderer.setRenderTarget(null); target.dispose();
                    let sum = 0, boundaryDifference = 0;
                    for (let i = 0; i < before.length; i += 4) for (let c = 0; c < 3; c++) {
                        sum += before[i + c]; boundaryDifference = Math.max(boundaryDifference, Math.abs(before[i + c] - after[i + c]));
                    }
                    return { mean: sum / (320 * 200 * 3), boundaryDifference, state: libraryDiagnostics().reveal };
                }));
            }
            assert.ok(measurements[1].mean > measurements[0].mean * 1.3, '实际渲染的深层书架应明显显露');
            assert.ok(measurements[1].boundaryDifference <= 1, '高可视度时远端回收不可出现轮廓跳变');
            assert.deepEqual(errors, []);
            reports.push({ mobile, normalFog: initial.fogDensity, boostFog: boost.fogDensity, measurements, errors, result: 'PASS' });
            await page.close();
        }
        fs.writeFileSync(`${folder}/checks.json`, JSON.stringify(reports, null, 2));
        console.log(JSON.stringify(reports, null, 2));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
