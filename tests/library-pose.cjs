const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const folder = 'artifacts/library-pose', reports = [];
    fs.mkdirSync(folder, { recursive: true });
    try {
        for (const mobile of [false, true]) {
            const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1910, height: 974 }, isMobile: mobile, hasTouch: mobile });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/js/library.js*', async route => {
                const response = await route.fetch();
                await route.fulfill({ response, body: (await response.text()).replace('window.libraryDiagnostics =', 'window.__poseTest = { astronaut, space, motion, camera, postMaterial }; window.libraryDiagnostics =') });
            });
            await page.goto('http://127.0.0.1:4173/library.html');
            await page.waitForFunction(() => window.libraryDiagnostics?.().ready && getComputedStyle(document.querySelector('#loading')).opacity === '0');
            const state = () => page.evaluate(async () => {
                const THREE = await import('three');
                const { astronaut, space, motion, camera } = __poseTest;
                const body = astronaut.children[0].getWorldQuaternion(new THREE.Quaternion());
                const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(space.root.quaternion);
                const back = new THREE.Vector3(0, 0, -1).applyQuaternion(body);
                const head = new THREE.Vector3(0, 1, 0).applyQuaternion(body);
                const toCamera = camera.position.clone().sub(astronaut.position).normalize();
                return { pull: motion.posePull, alignment: back.dot(normal), backToCamera: back.dot(toCamera), bodyNormal: Math.abs(head.dot(normal)), q: astronaut.quaternion.toArray() };
            });
            const initial = await state();
            await page.screenshot({ path: `${folder}/${mobile ? 'mobile' : 'desktop'}-before.png` });
            const hold = await page.locator('#hold').boundingBox();
            const x = hold.x + hold.width / 2, y = hold.y + hold.height / 2;
            const session = mobile ? await page.context().newCDPSession(page) : null;
            const press = async () => mobile ? session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }) : (await page.mouse.move(x, y), page.mouse.down());
            const release = async () => mobile ? session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) : page.mouse.up();
            await press(); await page.waitForTimeout(70); await release();
            assert.equal((await state()).pull, 0, '短按不改变姿态');
            await press(); await page.waitForTimeout(2200);
            const held = await state();
            await page.screenshot({ path: `${folder}/${mobile ? 'mobile' : 'desktop'}-held.png` });
            assert.ok(held.alignment > .995 && held.bodyNormal < .06, '长按时躯干应平行下方横截面，胸腹朝深处');
            assert.ok(held.backToCamera > .85, '长按时后背必须朝镜头');
            await release(); await page.waitForTimeout(2100);
            const returned = await state();
            const angle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.reduce((sum, n, i) => sum + n * b[i], 0))));
            assert.ok(angle(initial.q, held.q) > .5, '姿态变化必须明显');
            assert.ok(angle(initial.q, returned.q) < .12, '松手约两秒恢复原姿态');
            await page.evaluate(() => {
                window.__poseSteps = [];
                const previous = __poseTest.astronaut.quaternion.clone(), start = performance.now();
                const sample = now => {
                    window.__poseSteps.push(previous.angleTo(__poseTest.astronaut.quaternion));
                    previous.copy(__poseTest.astronaut.quaternion);
                    if (now - start < 3600) requestAnimationFrame(sample);
                };
                requestAnimationFrame(sample);
            });
            await press(); await page.waitForTimeout(1000); await release(); await page.waitForTimeout(240);
            await page.evaluate(() => {
                window.addEventListener('pointerdown', () => {
                    const before = __poseTest.astronaut.quaternion.clone();
                    queueMicrotask(() => { window.__repressAngle = before.angleTo(__poseTest.astronaut.quaternion); });
                }, { capture: true, once: true });
            });
            await press();
            assert.ok(await page.evaluate(() => window.__repressAngle < .001), '再次长按从当前姿态衔接');
            await page.waitForTimeout(800);
            await page.evaluate(() => window.dispatchEvent(new Event('blur')));
            await release(); await page.waitForTimeout(2600);
            assert.ok(angle(initial.q, (await state()).q) < .12, '失焦后恢复原姿态');
            const maxStep = await page.evaluate(() => Math.max(...window.__poseSteps));
            assert.ok(maxStep < .3, '松手、再次按压及失焦后的渲染帧不能跳变');
            assert.deepEqual(errors, []);
            reports.push({ mobile, initial, held, returned, maxStep, errors, result: 'PASS' });
            await page.close();
        }
        fs.writeFileSync(`${folder}/checks.json`, JSON.stringify(reports, null, 2));
        console.log(JSON.stringify(reports, null, 2));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
