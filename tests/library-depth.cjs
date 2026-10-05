const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const report = [];
    try {
        const page = await browser.newPage();
        await page.goto('http://127.0.0.1:4173/library.html');
        await page.waitForFunction(() => window.libraryDiagnostics?.().ready);
        for (const [width, height] of [[1440, 900], [390, 844], [844, 390], [2560, 1080]]) {
            await page.setViewportSize({ width, height });
            await page.waitForTimeout(100);
            const result = await page.evaluate(async () => {
                const THREE = await import('three');
                const { createLibrarySpace } = await import('./js/library-space.js');
                const space = createLibrarySpace(new THREE.MeshBasicMaterial(), 8, 7, 56);
                const { createDaylight } = await import('./js/library-daylight.js');
                createDaylight(space, new THREE.Scene(), new THREE.Scene());
                const camera = new THREE.PerspectiveCamera(innerWidth < 700 ? 76 : 60, innerWidth / innerHeight, .1, 150);
                camera.position.set(0, .65, 12); camera.lookAt(0, .8, -30); camera.updateMatrixWorld(true);
                const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
                space.root.rotation.set(-Math.atan(.23 * tangent), -Math.atan(.30 * tangent * camera.aspect), .035);
                space.root.updateMatrixWorld(true);
                const recycleZ = libraryDiagnostics().recycleZ ?? 9;
                let nearest = Infinity, farthest = -Infinity;
                const vertex = new THREE.Vector3(), instance = new THREE.Matrix4(), matrix = new THREE.Matrix4();
                // 检查真实几何的每个顶点，包含书架末端、丝带和窗光。
                for (const section of space.sections) {
                    section.position.z = recycleZ; section.updateMatrixWorld(true);
                    section.traverse(mesh => {
                        if (!mesh.isMesh) return;
                        for (let i = 0; i < (mesh.isInstancedMesh ? mesh.count : 1); i++) {
                            if (mesh.isInstancedMesh) mesh.getMatrixAt(i, instance); else instance.identity();
                            matrix.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld).multiply(instance);
                            const positions = mesh.geometry.attributes.position;
                            for (let j = 0; j < positions.count; j++) {
                                vertex.fromBufferAttribute(positions, j).applyMatrix4(matrix);
                                nearest = Math.min(nearest, vertex.z);
                                farthest = Math.max(farthest, vertex.z);
                            }
                        }
                    });
                }
                const length = libraryDiagnostics().loopLength ?? 108;
                const advance = new THREE.Vector3(0, 0, 1).transformDirection(space.root.matrixWorld).transformDirection(camera.matrixWorldInverse);
                const insertionDepth = length * advance.z - farthest;
                space.root.traverse(mesh => { if (mesh.isMesh) mesh.geometry.dispose(); });
                return { recycleZ, nearest, insertionDepth, fogVisibility: Math.exp(-Math.pow(insertionDepth * libraryDiagnostics().fogDensity, 2)) };
            });
            report.push({ width, height, ...result });
            assert.ok(result.nearest >= .1, `回收时仍有书架位于镜头前方：${JSON.stringify(report.at(-1))}`);
            assert.ok(result.fogVisibility < .001, '远端重新出现的书架应被雾遮住');
        }
        fs.writeFileSync(path.resolve(__dirname, '../artifacts/library/depth-checks.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report, null, 2));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
