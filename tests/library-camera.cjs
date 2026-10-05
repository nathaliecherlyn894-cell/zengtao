const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const folder = 'artifacts/library-camera', reports = [];
    fs.mkdirSync(folder, { recursive: true });
    try {
        for (const mobile of [false, true]) {
            const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile });
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
            await page.route('**/js/library.js*', async route => {
                const response = await route.fetch();
                await route.fulfill({ response, body: (await response.text()).replace('window.libraryDiagnostics =', 'window.__cameraTest = { camera, motion, space, astronaut, postMaterial, updateAstronautPose }; window.libraryDiagnostics =') });
            });
            await page.goto('http://127.0.0.1:4173/library.html');
            await page.waitForFunction(() => window.libraryDiagnostics?.().ready && getComputedStyle(document.querySelector('#loading')).opacity === '0');
            const state = () => page.evaluate(() => ({ z: __cameraTest.camera.position.z, fov: __cameraTest.camera.fov, ...libraryDiagnostics() }));
            const initial = await state();
            await page.screenshot({ path: `${folder}/${mobile ? 'mobile' : 'desktop'}-before.png` });
            const hold = page.locator('#hold'), box = await hold.boundingBox();
            const x = box.x + box.width / 2, y = box.y + box.height / 2;
            const session = mobile ? await page.context().newCDPSession(page) : null;
            const press = async () => {
                if (mobile) await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
                else { await page.mouse.move(x, y); await page.mouse.down(); }
            };
            const release = async () => {
                if (mobile) await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                else await page.mouse.up();
            };
            await press(); await page.waitForTimeout(80); await release();
            assert.equal((await state()).z, initial.z, '短按不移动镜头');
            await press();
            await page.waitForTimeout(1100);
            const pulled = await state();
            assert.ok(pulled.z > initial.z + (mobile ? 2.4 : 3.8), '长按应比上一版进一步拉远镜头');
            assert.equal(pulled.fov, initial.fov, '保持视角，避免广角拉伸');
            assert.equal(pulled.recycleZ, initial.recycleZ, '移动镜头时不能重排书架循环边界');
            assert.ok(pulled.pose.head.y < initial.pose.head.y, '人物在屏幕中略下移，给上方书架留空间');
            assert.ok(Math.abs(pulled.blurCenter.x - (pulled.vanishing.x + 1) / 2) < .0001);
            assert.ok(Math.abs(pulled.blurCenter.y - (pulled.vanishing.y + 1) / 2) < .0001);
            assert.ok(pulled.camera.blur > .17, '满速模糊强度应增强');
            await page.screenshot({ path: `${folder}/${mobile ? 'mobile' : 'desktop'}-held.png` });
            await release(); await page.waitForTimeout(1050);
            assert.ok((await state()).z < initial.z + .22, '松手约一秒后基本恢复');
            await press(); await page.waitForTimeout(400);
            await page.evaluate(() => window.dispatchEvent(new Event('blur')));
            await release(); await page.waitForTimeout(1200);
            assert.ok((await state()).z < initial.z + .1, '失焦后镜头恢复');
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.waitForFunction(() => libraryDiagnostics().paused);
            const geometry = [];
            // 在同一人物姿态、同一书架位置比较构图，避免漂浮动作影响大小测量。
            for (const pull of [0, .25, .5, .75, 1]) {
                await page.evaluate(pull => { __cameraTest.motion.cameraPull = pull; __cameraTest.motion.speed = 1; __cameraTest.motion.offset = 6; }, pull);
                await page.waitForTimeout(50);
                geometry.push(await page.evaluate(async () => {
                    const THREE = await import('three');
                    const { camera, space, astronaut } = __cameraTest;
                    __cameraTest.updateAstronautPose(0);
                    const state = libraryDiagnostics();
                    const view = new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, space.root.matrixWorld);
                    const recycled = space.bounds.clone().applyMatrix4(view.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, state.recycleZ)));
                    const inserted = space.bounds.clone().applyMatrix4(view.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, state.recycleZ - state.loopLength)));
                    const person = new THREE.Box3().setFromObject(astronaut).applyMatrix4(camera.matrixWorldInverse);
                    return { pull: state.camera.pull, nearest: recycled.min.z, insertionDepth: -inserted.max.z, fadeEnd: state.reveal.farFade[1], personDepth: -person.min.z, clearDepth: state.camera.clearDepth,
                        size: Math.hypot(state.pose.head.x - state.pose.feet.x, state.pose.head.y - state.pose.feet.y), head: state.pose.head.y };
                }));
            }
            for (const sample of geometry) {
                assert.ok(sample.nearest > .1, '整个镜头路径中，书架经过镜头后才能回收');
                assert.ok(sample.insertionDepth > sample.fadeEnd, '循环插入的书架须在渐隐区域之外');
                assert.ok(sample.personDepth < sample.clearDepth, '人物完整轮廓应位于清晰区域内');
            }
            const ratio = geometry.at(-1).size / geometry[0].size;
            assert.ok(mobile ? ratio > .79 && ratio < .87 : ratio > .65 && ratio < .75, `人物缩小幅度：${ratio}`);
            assert.ok(geometry.at(-1).head < geometry[0].head);
            assert.deepEqual(errors, []);
            reports.push({ mobile, pullback: pulled.z - initial.z, sizeRatio: ratio, blur: pulled.camera.blur, geometry, errors, result: 'PASS' });
            await page.close();
        }
        fs.writeFileSync(`${folder}/checks.json`, JSON.stringify(reports, null, 2));
        console.log(JSON.stringify(reports, null, 2));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
