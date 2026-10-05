const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const folder = 'artifacts/library-cinematic';
    fs.mkdirSync(folder, { recursive: true });
    const reports = [];
    try {
        for (const mobile of [false, true]) {
            const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile });
            const errors = [], failed = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
            page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
            await page.route('**/js/library.js*', async route => {
                const response = await route.fetch();
                const body = (await response.text()).replace('window.libraryDiagnostics =', 'window.__cinematicTest = { renderer, scene, astronaut, assets, space, motion, camera, target }; window.libraryDiagnostics =');
                await route.fulfill({ response, body });
            });
            await page.goto('http://127.0.0.1:4173/library.html');
            await page.waitForFunction(() => window.libraryDiagnostics?.().ready, null, { timeout: 60000 });
            await page.waitForFunction(() => document.querySelector('#loading').hidden);
            const assets = await page.evaluate(() => {
                const { astronaut, scene, assets, target } = __cinematicTest;
                let triangles = 0;
                astronaut.traverse(mesh => { if (mesh.isMesh) triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3; });
                return { astronautTriangles: triangles, sharedDepth: astronaut.parent === scene, maps: [assets.wood.map, assets.wood.normalMap, assets.wood.roughnessMap].every(Boolean), depth: Boolean(target.depthTexture), ...libraryDiagnostics() };
            });
            assert.ok(assets.astronautTriangles > 20000, '实际载入精细宇航服网格');
            assert.ok(assets.sharedDepth && assets.maps && assets.depth, '人物共享深度且木材贴图完整');
            assert.ok(assets.pose.head.x > assets.pose.feet.x && assets.pose.head.y > assets.pose.feet.y, '保持右上头部、左下脚部的斜漂姿态');
            await page.screenshot({ path: `${folder}/${mobile ? 'mobile' : 'desktop'}-drift.png` });
            const hold = page.locator('#hold'), box = await hold.boundingBox();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
            await page.waitForFunction(() => libraryDiagnostics().speed > 3.8);
            await page.screenshot({ path: `${folder}/${mobile ? 'mobile' : 'desktop'}-boost.png` });
            const frames = await page.evaluate(() => new Promise(resolve => {
                const samples = []; let previous; const start = performance.now();
                function sample(now) {
                    const state = libraryDiagnostics();
                    if (previous) samples.push({ dt: now - previous.at, shift: state.offset - previous.offset, light: state.daylight.illumination, calls: state.calls });
                    previous = { at: now, offset: state.offset };
                    if (now - start < 4000) requestAnimationFrame(sample); else resolve(samples);
                }
                requestAnimationFrame(sample);
            }));
            await page.mouse.up();
            await page.waitForFunction(() => libraryDiagnostics().speed < 1.05);
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.waitForFunction(() => libraryDiagnostics().paused);
            // 固定在窗光经过人物的时刻，供跨轮比较构图和材质。
            await page.evaluate(() => { __cinematicTest.motion.offset = 8; });
            await page.waitForTimeout(150);
            await page.screenshot({ path: `${folder}/${mobile ? 'mobile' : 'desktop'}-window.png` });
            const times = frames.map(f => f.dt).sort((a, b) => a - b);
            const report = { mobile, assets, medianMs: times[Math.floor(times.length * .5)], p95Ms: times[Math.floor(times.length * .95)], frames: frames.length, errors, failed };
            reports.push(report);
            fs.writeFileSync(`${folder}/checks.json`, JSON.stringify(reports, null, 2));
            assert.deepEqual(errors, []); assert.deepEqual(failed, []);
            assert.ok(report.p95Ms < 34, '长按时 95% 帧需在 34ms 内完成');
            await page.close();
        }
        console.log(JSON.stringify(reports, null, 2));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
