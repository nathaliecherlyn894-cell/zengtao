const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const folder = 'artifacts/library-camera-occlusion', reports = [];
    fs.mkdirSync(folder, { recursive: true });
    try {
        const page = await browser.newPage({ reducedMotion: 'reduce' });
        await page.route('**/js/library.js*', async route => {
            const response = await route.fetch();
            await route.fulfill({ response, body: (await response.text()).replace('window.libraryDiagnostics =', 'window.__occlusionTest = { renderer, scene, camera, space, motion, astronaut, postMaterial, updateCamera, updateAstronautPose }; window.libraryDiagnostics =') });
        });
        await page.goto('http://127.0.0.1:4173/library.html');
        await page.waitForFunction(() => window.libraryDiagnostics?.().ready && getComputedStyle(document.querySelector('#loading')).opacity === '0');
        for (const [width, height] of [[1910, 974], [1440, 900], [390, 844], [844, 390], [2560, 1080]]) {
            await page.setViewportSize({ width, height });
            await page.waitForTimeout(100);
            const report = await page.evaluate(async () => {
                const THREE = await import('three');
                const { renderer, scene, camera, space, motion, astronaut, postMaterial, updateCamera, updateAstronautPose } = __occlusionTest;
                const target = new THREE.WebGLRenderTarget(384, 216);
                const pixels = new Uint8Array(384 * 216 * 4);
                const white = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
                const black = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
                const saved = [], background = scene.background;
                const people = new Set(); astronaut.traverse(object => people.add(object));
                scene.traverse(object => {
                    if (!object.isMesh) return;
                    saved.push([object, object.material, object.visible]);
                    if (object.material.transparent) object.visible = false;
                    object.material = people.has(object) ? white : black;
                });
                scene.background = new THREE.Color(0);
                const count = () => {
                    renderer.clear(); renderer.render(scene, camera);
                    renderer.readRenderTargetPixels(target, 0, 0, 384, 216, pixels);
                    let result = 0;
                    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 128) result++;
                    return result;
                };
                let worst = { visible: 1, pull: 0, offset: 0 };
                try {
                    renderer.setRenderTarget(target);
                    for (const pull of [0, .25, .5, .75, 1]) {
                      for (const cameraPull of [pull * pull, 1 - (1 - pull) ** 2]) {
                        updateAstronautPose(pull);
                        updateCamera(cameraPull);
                        const bodyBounds = new THREE.Box3().setFromObject(astronaut);
                        const viewBounds = bodyBounds.clone().applyMatrix4(camera.matrixWorldInverse);
                        if (-viewBounds.min.z >= postMaterial.uniforms.clearDepth.value) throw new Error('旋转中的人物必须保持在清晰区域内');
                        const screenBounds = bodyBounds.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
                        if (Math.max(Math.abs(screenBounds.min.x), Math.abs(screenBounds.max.x), Math.abs(screenBounds.min.y), Math.abs(screenBounds.max.y)) >= .98) throw new Error('旋转中的手脚不应出画');
                        space.root.visible = false;
                        const full = count();
                        if (full < 100) throw new Error('人物必须完整留在取景范围中');
                        space.root.visible = true;
                        for (let offset = 0; offset < motion.length; offset += 1.5) {
                            const recycleZ = libraryDiagnostics().recycleZ;
                            space.sections.forEach((section, index) => {
                                section.position.z = recycleZ - THREE.MathUtils.euclideanModulo(recycleZ - 9 + index * 9 - offset, motion.length);
                            });
                            const visible = count() / full;
                            if (visible < worst.visible) worst = { visible, pull, cameraPull, offset };
                        }
                      }
                    }
                    const localCamera = space.root.worldToLocal(camera.position.clone());
                    return { width: innerWidth, height: innerHeight, worst, localCamera: localCamera.toArray() };
                } finally {
                    for (const [object, material, visible] of saved) { object.material = material; object.visible = visible; }
                    scene.background = background;
                    renderer.setRenderTarget(null); target.dispose(); white.dispose(); black.dispose();
                    updateCamera();
                    updateAstronautPose();
                }
            });
            reports.push(report);
            await page.evaluate(worst => { __occlusionTest.motion.posePull = worst.pull; __occlusionTest.motion.cameraPull = worst.cameraPull ?? worst.pull; __occlusionTest.motion.offset = worst.offset; __occlusionTest.motion.speed = 1 + 3 * worst.pull; }, report.worst);
            await page.waitForTimeout(100);
            await page.screenshot({ path: `${folder}/${width}-worst.png` });
            await page.evaluate(() => { __occlusionTest.motion.posePull = 1; __occlusionTest.motion.cameraPull = 1; __occlusionTest.motion.offset = 3; __occlusionTest.motion.speed = 4; });
            await page.waitForTimeout(100);
            await page.screenshot({ path: `${folder}/${width}-held.png` });
        }
        fs.writeFileSync(`${folder}/checks.json`, JSON.stringify(reports, null, 2));
        console.log(JSON.stringify(reports, null, 2));
        for (const report of reports) assert.ok(report.worst.visible >= .98, `镜头路径与完整循环中人物不应被书架遮挡：${JSON.stringify(report)}`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
