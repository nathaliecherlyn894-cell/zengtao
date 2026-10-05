import * as THREE from 'three';
import { FlightMotion } from './library-motion.mjs?v=20261005-slow-pose';
import { createLibrarySpace, getRecycleZ, LIBRARY_FOG_DENSITY } from './library-space.js';
import { createDaylight } from './library-daylight.js';
import { loadCinematicAssets } from './library-cinematic-assets.js';
import { createDepthReveal } from './library-depth-reveal.js';

const canvas = document.querySelector('#space');
const hold = document.querySelector('#hold');
const motion = new FlightMotion();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let paused = reducedMotion.matches;
let activePointer = null;
let ready = false;
let time = 0;

function release() {
    activePointer = null;
    motion.release();
    updateHold();
}

function press(event) {
    if (!ready || paused || activePointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    activePointer = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    motion.press();
    updateHold();
}

for (const element of [canvas, hold]) {
    element.addEventListener('pointerdown', press);
    element.addEventListener('contextmenu', event => event.preventDefault());
    element.addEventListener('lostpointercapture', release);
}
window.addEventListener('pointerup', event => { if (event.pointerId === activePointer) release(); });
window.addEventListener('pointercancel', release);
window.addEventListener('blur', release);
document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
window.addEventListener('keydown', event => {
    if (event.code !== 'Space' || event.repeat || ![document.body, canvas, hold].includes(document.activeElement)) return;
    event.preventDefault();
    if (!ready) return;
    if (paused) {
        if (document.activeElement === hold) { paused = false; release(); }
        return;
    }
    motion.press(); updateHold();
});
window.addEventListener('keyup', event => {
    if (event.code !== 'Space') return;
    if ([document.body, canvas, hold].includes(document.activeElement)) event.preventDefault();
    release();
});

function updateHold() {
    hold.classList.toggle('active', motion.pressed);
    hold.textContent = paused ? '点击 · 开始' : motion.pressed ? '松开 · 减速' : '长按 · 加速';
    hold.setAttribute('aria-label', paused ? '开始漂浮' : '按住加速，松开减速；也可按住空格键');
}
hold.addEventListener('click', () => { if (ready && paused) { paused = false; release(); } });
reducedMotion.addEventListener('change', event => { paused = event.matches; release(); });
updateHold();

async function start() {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.5 : 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.autoClear = false;
    renderer.info.autoReset = false;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#080d14');
    scene.fog = new THREE.FogExp2(scene.background, LIBRARY_FOG_DENSITY);
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 150);
    camera.position.set(0, 0.65, 12);
    camera.lookAt(0, 0.8, -30);
    scene.add(new THREE.HemisphereLight('#c1d5e7', '#171a20', .22));
    const light = new THREE.DirectionalLight('#a6c4df', .45);
    light.position.set(-5, 8, 3); scene.add(light);
    // 斜向冷白光只照亮部分书架，保留通道的明暗层次。
    const pool = new THREE.SpotLight('#dae7f2', 35, 48, .6, .85, 1.5);
    pool.position.set(2, 6, 9); pool.target.position.set(-3, 0, -14);
    scene.add(pool, pool.target);
    const distantLight = new THREE.PointLight('#9bacbd', 16, 26, 1.5);
    distantLight.position.set(5, -1, -20); scene.add(distantLight);

    const assets = await loadCinematicAssets(renderer);
    scene.environment = assets.environment;
    scene.environmentIntensity = .28;
    const response = await fetch('assets/library/books.json');
    if (!response.ok) throw new Error('书籍清单加载失败');
    const books = await response.json();
    const atlasCanvas = document.createElement('canvas');
    const columns = 8, rows = Math.ceil(books.length / columns);
    atlasCanvas.width = columns * 192; atlasCanvas.height = rows * 288;
    const ctx = atlasCanvas.getContext('2d');
    await Promise.all(books.map(async (book, index) => {
        const picture = new Image(); picture.src = book.cover;
        const x = (index % columns) * 192, y = Math.floor(index / columns) * 288;
        try { await picture.decode(); ctx.drawImage(picture, x + 2, y + 2, 188, 284); }
        catch { ctx.fillStyle = '#aab5bf'; ctx.fillRect(x, y, 192, 288); ctx.fillStyle = '#17212b'; ctx.font = '18px sans-serif'; ctx.fillText(book.title.slice(0, 9), x + 9, y + 70); }
    }));
    const atlas = new THREE.CanvasTexture(atlasCanvas);
    atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const coverMaterial = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.8 });
    coverMaterial.onBeforeCompile = shader => {
        shader.vertexShader = 'attribute vec2 atlasOffset;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\n vMapUv = (vMapUv * vec2(0.979, 0.986) + vec2(0.0105, 0.007)) / vec2(${columns.toFixed(1)}, ${rows.toFixed(1)}) + atlasOffset;`);
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
            float coverGray = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
            diffuseColor.rgb = mix(vec3(coverGray), diffuseColor.rgb, .48) * .85;`);
    };
    const space = createLibrarySpace(coverMaterial, columns, rows, books.length, assets);
    const sections = space.sections;
    scene.add(space.root);
    const sectionLength = 9;
    motion.length = sections.length * sectionLength;
    let recycleZ = 9;

    // 人物与书架共享深度与窗口阴影，近处格架可以自然遮挡人物。
    const astronaut = assets.astronaut;
    scene.add(astronaut);
    // 模型前方为 +Z；让胸腹朝通道深处、后背朝入口，躯干平放在横截面内。
    const flatPose = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, -Math.PI / 2, 'ZYX'))
        .multiply(astronaut.children[0].quaternion.clone().invert());
    const fallingPose = new THREE.Quaternion();
    const rim = new THREE.SpotLight('#c8e2f6', 85, 30, .7, 1, 1.6);
    rim.position.set(3, 4, -5); rim.target = astronaut; scene.add(rim);
    const daylight = createDaylight(space, scene);
    const depthReveal = createDepthReveal(scene, space);
    astronaut.position.set(-.55, -.1, 3);
    const projected = vector => {
        const point = vector.clone().project(camera);
        return { x: point.x, y: point.y };
    };
    const vanishing = new THREE.Vector3();
    const personView = new THREE.Vector3();
    let pullDistance = 4.5, aimRise = 2.4;

    // 背景在离屏画布渲染，需在这里开启抗锯齿，避免远处细梁逐像素跳动。
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true, samples: Math.min(innerWidth < 700 ? 2 : 4, renderer.capabilities.maxSamples) });
    target.depthTexture = new THREE.DepthTexture(1, 1);
    const postScene = new THREE.Scene();
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const postMaterial = new THREE.ShaderMaterial({
        uniforms: { image: { value: target.texture }, depthMap: { value: target.depthTexture }, resolution: { value: new THREE.Vector2() }, strength: { value: 0 }, clearDepth: { value: 11 }, center: { value: new THREE.Vector2(.5, .5) } },
        vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader: `uniform sampler2D image; uniform sampler2D depthMap; uniform vec2 resolution; uniform float strength; uniform float clearDepth; uniform vec2 center; varying vec2 vUv;
            float viewDepth(vec2 uv){float d=texture2D(depthMap,uv).r;return 30./(150.1-(d*2.-1.)*149.9);}
            void main(){vec2 ray=vUv-center;float distance=viewDepth(vUv);
            float edge=smoothstep(.10,.48,length(ray))*smoothstep(clearDepth,clearDepth+8.,distance);
            edge*=mix(1.,.3,smoothstep(35.,75.,distance));
            vec3 base=texture2D(image,vUv).rgb, color=base;float weight=1.;vec3 glow=vec3(0.);
            for(int i=1;i<17;i++){float t=float(i)/16.;vec2 uv=vUv-ray*t*strength*edge;
                float valid=step(clearDepth,viewDepth(uv));color+=mix(base,texture2D(image,uv).rgb,valid);weight+=1.;
                float a=float(i)*.392699;glow+=max(vec3(0.),texture2D(image,vUv+vec2(cos(a),sin(a))*5./resolution).rgb-vec3(1.6))/16.;}
            color=color/weight+glow*.1;
            color*=mix(vec3(.84,.93,1.06),vec3(1.),smoothstep(.02,.45,dot(color,vec3(.2126,.7152,.0722))));
            gl_FragColor=vec4(color,1.);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            }`,
        depthTest: false, depthWrite: false
    });
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial));

    function updateAstronautPose(pull = motion.posePull) {
        astronaut.rotation.set(.7, Math.sin(time * .3) * .025, -1.03 + Math.sin(time * .52) * .025);
        fallingPose.copy(space.root.quaternion).multiply(flatPose);
        astronaut.quaternion.slerp(fallingPose, pull);
    }

    function updateCamera(pull = motion.cameraPull) {
        camera.position.set(0, .65, 12 + pullDistance * pull);
        // 通道带有倾角：在通道截面内留出余量，避免宽屏后退时穿进侧面书架。
        space.root.worldToLocal(camera.position);
        const radius = Math.hypot(camera.position.x, camera.position.y);
        if (radius > 3.1) {
            camera.position.x *= 3.1 / radius;
            camera.position.y *= 3.1 / radius;
        }
        space.root.localToWorld(camera.position);
        camera.lookAt(0, .8 + aimRise * pull, -30);
        camera.updateMatrixWorld(true);
        vanishing.set(0, 0, -10000).applyMatrix4(space.root.matrixWorld).project(camera);
        postMaterial.uniforms.center.value.set((vanishing.x + 1) / 2, (vanishing.y + 1) / 2);
        personView.copy(astronaut.position).applyMatrix4(camera.matrixWorldInverse);
        postMaterial.uniforms.clearDepth.value = -personView.z + 2.5;
    }

    function resize() {
        const width = canvas.clientWidth, height = canvas.clientHeight;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.fov = width < 700 ? 76 : 60;
        pullDistance = width < 700 ? 2.6 : 4.5;
        aimRise = width < 700 ? 1.3 : 2.4;
        camera.updateProjectionMatrix();
        // 以屏幕比例确定右下消失点，手机也能看到完整的通道方向。
        const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        space.root.rotation.set(-Math.atan(.23 * tangent), -Math.atan(.30 * tangent * camera.aspect), .035);
        space.root.updateMatrixWorld(true);
        astronaut.position.z = width < 700 ? -.2 : 3;
        astronaut.position.x = width < 700 ? -.22 : -.55;
        // 按整段镜头路径预留回收与渐隐范围，长按中不重新排列循环书架。
        const cameraPath = [0, .25, .5, .75, 1];
        recycleZ = Math.max(...cameraPath.map(pull => { updateCamera(pull); return getRecycleZ(space, camera); })) + 1;
        let fadeEnd = Infinity;
        for (const pull of cameraPath) {
            updateCamera(pull); depthReveal.resize(camera, recycleZ, motion.length);
            fadeEnd = Math.min(fadeEnd, depthReveal.fade.y);
        }
        depthReveal.fade.set(fadeEnd - 24, fadeEnd);
        updateCamera();
        const resolution = new THREE.Vector2(); renderer.getDrawingBufferSize(resolution);
        target.setSize(resolution.x, resolution.y);
        postMaterial.uniforms.resolution.value.copy(resolution);
    }
    window.addEventListener('resize', resize); resize();
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); paused = true; release(); document.querySelector('#error').hidden = false; });
    // 先编译新材质，避免加载遮罩退去后第一帧长时间停顿。
    await renderer.compileAsync(scene, camera);
    await renderer.compileAsync(postScene, postCamera);
    ready = true;
    document.querySelector('#loading').classList.add('done');
    setTimeout(() => { document.querySelector('#loading').hidden = true; }, 850);
    const clock = new THREE.Clock();
    // 只读诊断用于浏览器验收，不包含个人笔记内容。
    window.libraryDiagnostics = () => ({
        ready, paused, speed: motion.speed, offset: motion.offset, pressed: motion.pressed,
        books: books.length, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, sections: sections.map(section => section.position.z),
        model: 'NASA Z2 Spacesuit', sharedDepth: astronaut.parent === scene,
        woodMaps: Boolean(assets.wood.map && assets.wood.normalMap && assets.wood.roughnessMap),
        polygonSides: space.faces.length, ribbons: space.ribbonCount, windows: space.windowCount,
        recycleZ, loopLength: motion.length, fogDensity: scene.fog.density, daylight: daylight.diagnostics(), reveal: depthReveal.diagnostics(),
        scatter: space.scatterMaterial.uniforms.scatter.value, ribbonOpacity: space.ribbonMaterial.uniforms.opacity.value,
        camera: { pull: motion.cameraPull, z: camera.position.z, fov: camera.fov, clearDepth: postMaterial.uniforms.clearDepth.value, blur: postMaterial.uniforms.strength.value },
        vanishing: { x: vanishing.x, y: vanishing.y }, blurCenter: { x: postMaterial.uniforms.center.value.x, y: postMaterial.uniforms.center.value.y },
        pose: { head: projected(astronaut.localToWorld(new THREE.Vector3(0, 1, 0))), feet: projected(astronaut.localToWorld(new THREE.Vector3(0, -1, 0))) }
    });
    renderer.setAnimationLoop(() => {
        const dt = Math.min(clock.getDelta(), .05);
        if (document.hidden) return;
        renderer.info.reset();
        if (!paused) { motion.update(dt); time += dt; }
        const boost = (motion.speed - 1) / 3;
        sections.forEach((section, index) => {
            section.position.z = recycleZ - THREE.MathUtils.euclideanModulo(recycleZ - 9 + index * sectionLength - motion.offset, motion.length);
        });
        astronaut.position.y = -.1 + Math.sin(time * .7) * .075;
        updateAstronautPose();
        updateCamera();
        depthReveal.update(boost);
        daylight.update(astronaut, scene.fog.density, depthReveal.fade);
        space.ribbonMaterial.uniforms.opacity.value = .18 + boost * .46;
        space.scatterMaterial.uniforms.opacity.value = .45 + boost * .35;
        space.scatterMaterial.uniforms.scatter.value = boost;
        space.scatterMaterial.uniforms.time.value = time;
        postMaterial.uniforms.strength.value = boost * .18;
        renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera);
        renderer.setRenderTarget(null); renderer.clear(); renderer.render(postScene, postCamera);
    });
}

start().catch(error => {
    console.error('图书馆加载失败', error);
    document.querySelector('#loading').hidden = true;
    document.querySelector('#error').hidden = false;
});
