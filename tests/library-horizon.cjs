const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        // 仅测试请求注入场景引用，正式页面不增加可修改的调试入口。
        await page.route('**/js/library.js*', async route => {
            const response = await route.fetch();
            const body = (await response.text()).replace('window.libraryDiagnostics =', 'window.__horizonTest = { scene, renderer, camera, space }; window.libraryDiagnostics =');
            await route.fulfill({ response, body });
        });
        await page.goto('http://127.0.0.1:4173/library.html');
        await page.waitForFunction(() => window.libraryDiagnostics?.().ready);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => libraryDiagnostics().paused);
        const fog = await page.evaluate(async () => {
            const THREE = await import('three');
            const { renderer, scene: actual } = window.__horizonTest;
            const scene = new THREE.Scene(); scene.background = actual.background.clone(); scene.fog = actual.fog.clone();
            const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 400);
            const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 2), new THREE.MeshBasicMaterial({ color: 'white' }));
            plane.position.x = -.5; scene.add(plane);
            const target = new THREE.WebGLRenderTarget(4, 2);
            const pixels = new Uint8Array(4 * 2 * 4);
            const sample = depth => {
                plane.position.z = -depth;
                renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera);
                renderer.readRenderTargetPixels(target, 0, 0, 4, 2, pixels);
                return { surface: Array.from(pixels.slice(0, 3)), background: Array.from(pixels.slice(12, 15)) };
            };
            const far = sample(300), middle = sample(50);
            renderer.setRenderTarget(null); target.dispose(); plane.geometry.dispose(); plane.material.dispose();
            return { far, middle, density: actual.fog.density };
        });
        console.log(JSON.stringify(fog, null, 2));
        assert.ok(fog.far.surface.every((v, i) => Math.abs(v - fog.far.background[i]) <= 1), '完全隐入雾的书架必须与背景同色，不能露出跳动的五边形边界');
        assert.ok(fog.middle.surface[0] - fog.middle.background[0] > 35, '中远处书架应保留足够的可见对比度');
        const boundary = await page.evaluate(async () => {
            const THREE = await import('three');
            const { renderer, scene, camera, space } = window.__horizonTest;
            const farthest = space.sections.reduce((a, b) => a.position.z < b.position.z ? a : b);
            const target = new THREE.WebGLRenderTarget(320, 200);
            const before = new Uint8Array(320 * 200 * 4), after = new Uint8Array(before.length);
            renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera);
            renderer.readRenderTargetPixels(target, 0, 0, 320, 200, before);
            farthest.visible = false;
            renderer.clear(); renderer.render(scene, camera);
            renderer.readRenderTargetPixels(target, 0, 0, 320, 200, after);
            farthest.visible = true; renderer.setRenderTarget(null); target.dispose();
            let maxDifference = 0;
            for (let i = 0; i < before.length; i++) maxDifference = Math.max(maxDifference, Math.abs(before[i] - after[i]));
            return { maxDifference, checkedPixels: 320 * 200 };
        });
        assert.ok(boundary.maxDifference <= 1, '最远一排出现或消失时不应产生可见的轮廓跳变');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.waitForFunction(() => !libraryDiagnostics().paused);
        await page.mouse.move(750, 600); await page.mouse.down(); await page.waitForTimeout(1500);
        const motion = await page.evaluate(() => new Promise(resolve => {
            const frames = []; let previous; const start = performance.now();
            function sample(now) {
                const state = libraryDiagnostics();
                const current = { at: now, tail: Math.min(...state.sections), offset: state.offset };
                if (previous) frames.push({ dt: now - previous.at, shift: current.tail - previous.tail });
                previous = current;
                if (now - start < 6500) requestAnimationFrame(sample);
                else {
                    const times = frames.map(f => f.dt).sort((a, b) => a - b);
                    resolve({ frames: frames.length, medianMs: times[Math.floor(times.length * .5)], p95Ms: times[Math.floor(times.length * .95)], maxMs: times.at(-1), recycled: frames.filter(f => Math.abs(f.shift) > 8).length });
                }
            }
            requestAnimationFrame(sample);
        }));
        await page.mouse.up();
        assert.ok(motion.recycled >= 3, '需覆盖多次远端段落接入');
        assert.ok(motion.p95Ms < 34, '长按时绝大多数帧应在 34ms 内完成');
        const report = { fog, boundary, motion, result: 'PASS' };
        fs.writeFileSync(path.resolve(__dirname, '../artifacts/library/horizon-checks.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report, null, 2));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
