import * as THREE from 'three';
import { GLTFLoader } from '../assets/library/vendor/GLTFLoader.js';
import { DRACOLoader } from '../assets/library-study/DRACOLoader.js';
import { RoundedBoxGeometry } from '../assets/library-study/RoundedBoxGeometry.js';

// 独立静态布光样片：所有实体共享深度和阴影，加载后仅在尺寸改变时重绘。
const canvas = document.querySelector('#study');
const status = document.querySelector('#study-status');
const folder = 'assets/library-study/';
let seed = 61;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

async function start() {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#080c12');
    scene.fog = new THREE.FogExp2('#080c12', .029);
    const camera = new THREE.PerspectiveCamera(49, 1, .1, 160);
    const root = new THREE.Group(); root.rotation.set(-.11, -.17, .14); scene.add(root);
    const loader = new THREE.TextureLoader();
    const [color, normal, roughness] = await Promise.all(['wood-color.jpg', 'wood-normal.jpg', 'wood-roughness.jpg'].map(name => loader.loadAsync(folder + name)));
    color.colorSpace = THREE.SRGBColorSpace;
    for (const map of [color, normal, roughness]) {
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    }
    const wood = new THREE.MeshStandardMaterial({ color: '#939b9f', map: color, normalMap: normal, normalScale: new THREE.Vector2(.48, .48), roughnessMap: roughness, roughness: .87 });
    const metal = new THREE.MeshStandardMaterial({ color: '#46525c', metalness: .76, roughness: .42 });
    const boltMaterial = new THREE.MeshStandardMaterial({ color: '#69717b', metalness: .8, roughness: .37 });
    const geometries = new Map();
    function box(w, h, d, material, parent, x, y, z, radius = .025) {
        const key = [w, h, d, radius].join(',');
        if (!geometries.has(key)) {
            const geometry = new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3));
            const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
            for (let i = 0; i < p.count; i++) {
                const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
                const a = Math.abs(n.getX(i)), b = Math.abs(n.getY(i));
                let u = a > .7 ? z : x, v = b > .7 ? z : y;
                if (w > h) [u, v] = [v, u];
                uv.setXY(i, u * .75, v * .75);
            }
            geometries.set(key, geometry);
        }
        const mesh = new THREE.Mesh(geometries.get(key), material);
        mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh);
        return mesh;
    }

    // 低亮度环境反射只提供材质层次；明亮矩形在玻璃、金属上形成窗口高光。
    const environment = new THREE.Scene();
    environment.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: '#283642', side: THREE.BackSide })));
    const softbox = new THREE.Mesh(new THREE.PlaneGeometry(7, 11), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.2, 1.9) }));
    softbox.position.set(-7, 5, 9); softbox.lookAt(0, 0, 0); environment.add(softbox);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(environment, .06).texture;
    scene.environmentIntensity = .28;
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight('#c1d5e7', '#171a20', .16));

    const books = await (await fetch('assets/library/books.json')).json();
    const atlasCanvas = document.createElement('canvas'); atlasCanvas.width = 1536; atlasCanvas.height = 2016;
    const context = atlasCanvas.getContext('2d');
    await Promise.all(books.map(async (book, index) => {
        const image = new Image(); image.src = book.cover; await image.decode();
        context.drawImage(image, index % 8 * 192, Math.floor(index / 8) * 288, 192, 288);
    }));
    const atlas = new THREE.CanvasTexture(atlasCanvas); atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 8;
    const cover = new THREE.MeshStandardMaterial({ map: atlas, roughness: .7 });
    cover.onBeforeCompile = shader => {
        shader.vertexShader = 'attribute vec2 atlasOffset;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vMapUv=(vMapUv*.98+.01)/vec2(8.,7.)+atlasOffset;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n float gray=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(vec3(gray),diffuseColor.rgb,.48)*.7;');
    };
    const paperCanvas = document.createElement('canvas'); paperCanvas.width = 64; paperCanvas.height = 512;
    const paperContext = paperCanvas.getContext('2d');
    for (let y = 0; y < 512; y++) {
        const value = Math.round(172 + random() * 60); paperContext.fillStyle = `rgb(${value},${value - 5},${value - 17})`; paperContext.fillRect(0, y, 64, 1);
    }
    const paperTexture = new THREE.CanvasTexture(paperCanvas); paperTexture.colorSpace = THREE.SRGBColorSpace;
    const paper = new THREE.MeshStandardMaterial({ map: paperTexture, roughness: .96 });
    const jackets = new THREE.MeshStandardMaterial({ color: '#a6a19a', roughness: .68 });
    const bodyMatrices = [], coverMatrices = [], coverOffsets = [], jacketMatrices = [], jacketColors = [];
    const dummy = new THREE.Object3D();
    const transform = (parent, x, y, z, sx, sy, sz, tilt = 0) => {
        dummy.position.set(x, y, z); dummy.rotation.set(0, .08, tilt); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
        return parent.matrix.clone().multiply(dummy.matrix);
    };
    let windowFrame;
    for (let section = 0; section < 10; section++) {
        for (let side = 0; side < 5; side++) {
            const angle = Math.PI / 2 - Math.PI / 5 - side * Math.PI * 2 / 5;
            const face = new THREE.Group();
            face.position.set(Math.cos(angle) * 3.85, Math.sin(angle) * 3.85, 4 - section * 7.8);
            face.rotation.z = angle - Math.PI / 2; face.updateMatrix(); root.add(face);
            for (const y of [0, 1.66, 3.32]) {
                box(5.68, .22, .85, wood, face, 0, y, 0, .04);
                box(5.65, .045, .055, metal, face, 0, y - .04, .46, .012);
            }
            for (const x of [-2.84, 0, 2.84]) {
                box(.24, 3.55, .88, wood, face, x, 1.66, 0, .04);
                for (const y of [.22, 3.15]) box(.045, .045, .016, boltMaterial, face, x, y, .455, .014);
            }
            for (const x of [-2.9, 2.9]) {
                box(.075, .095, 7.8, metal, face, x, 0, -3.9, .018);
                for (let strand = 0; strand < 4; strand++) box(.014, .02, 7.8, metal, face, x + strand * .048, .12, -3.9, .004);
            }
            const isWindow = side === 4 && (section === 0 || section === 3 || section === 6);
            if (isWindow) {
                const frame = new THREE.Group(); frame.position.set(1.38, 1.66, -.35); face.add(frame);
                const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 2.5, 1.95) })); frame.add(pane);
                for (const x of [-1.26, 0, 1.26]) box(.055, 3.13, .12, wood, frame, x, 0, .15, .012);
                for (const y of [-1.55, 0, 1.55]) box(2.55, .055, .12, wood, frame, 0, y, .15, .012);
                if (section === 0) windowFrame = frame;
            }
            for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
                if (isWindow && col >= 3) continue;
                if (random() < .12) continue;
                const index = (section * 17 + side * 9 + row * 5 + col) % books.length;
                const h = 1.24 + random() * .17, w = .82 + random() * .08, d = .12 + random() * .12;
                const x = -2.25 + col * 1.12, y = row * 1.66 + .12 + h / 2, z = .2 + random() * .08;
                const tilt = (random() - .5) * .09;
                bodyMatrices.push(transform(face, x, y, z, w * .94, h * .97, d, tilt));
                coverMatrices.push(transform(face, x, y, z + d / 2 + .015, w, h, 1, tilt));
                coverOffsets.push(index % 8 / 8, 1 - (Math.floor(index / 8) + 1) / 7);
                jacketMatrices.push(transform(face, x, y, z - d / 2 - .012, w, h, .024, tilt));
                jacketMatrices.push(transform(face, x - w / 2 + .015, y, z, .028, h, d + .04, tilt));
                const tint = new THREE.Color().setHSL(.05 + random() * .55, .12 + random() * .2, .18 + random() * .18);
                jacketColors.push(tint, tint);
            }
        }
    }
    function instances(geometry, material, matrices, colors) {
        const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
        matrices.forEach((matrix, index) => { mesh.setMatrixAt(index, matrix); if (colors) mesh.setColorAt(index, colors[index]); });
        mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
    }
    instances(new THREE.BoxGeometry(1, 1, 1), paper, bodyMatrices);
    instances(new THREE.BoxGeometry(1, 1, 1), jackets, jacketMatrices, jacketColors);
    const coverGeometry = new THREE.PlaneGeometry(1, 1);
    coverGeometry.setAttribute('atlasOffset', new THREE.InstancedBufferAttribute(new Float32Array(coverOffsets), 2));
    instances(coverGeometry, cover, coverMatrices);

    const draco = new DRACOLoader(); draco.setDecoderPath(folder + 'draco/');
    const model = (await new GLTFLoader().setDRACOLoader(draco).loadAsync(folder + 'z2-spacesuit.glb')).scene;
    model.updateMatrixWorld(true);
    const modelBounds = new THREE.Box3().setFromObject(model), size = modelBounds.getSize(new THREE.Vector3()), center = modelBounds.getCenter(new THREE.Vector3());
    model.traverse(mesh => {
        if (!mesh.isMesh) return;
        // 该资源没有骨骼；样片只做静态摆姿，不把几何变形当成动画绑定。
        const geometry = mesh.geometry.clone(); geometry.applyMatrix4(mesh.matrixWorld);
        mesh.position.set(0, 0, 0); mesh.quaternion.identity(); mesh.scale.setScalar(1);
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            let x = (positions.getX(i) - center.x) / size.y, y = (positions.getY(i) - modelBounds.min.y) / size.y, z = (positions.getZ(i) - center.z) / size.y;
            const side = Math.sign(x) || 1;
            const weight = THREE.MathUtils.smoothstep(Math.abs(x), .12, .17) * THREE.MathUtils.smoothstep(y, .37, .48) * (1 - THREE.MathUtils.smoothstep(y, .77, .86));
            const angle = side * .36 * weight, dx = x - side * .145, dy = y - .73;
            x = side * .145 + dx * Math.cos(angle) - dy * Math.sin(angle);
            y = .73 + dx * Math.sin(angle) + dy * Math.cos(angle);
            if (y < .42) {
                const angle = side * .15 * (1 - THREE.MathUtils.smoothstep(y, .3, .42));
                const dx = x - side * .075, dy = y - .4;
                x = side * .075 + dx * Math.cos(angle) - dy * Math.sin(angle);
                y = .4 + dx * Math.sin(angle) + dy * Math.cos(angle);
                z += (side > 0 ? .11 : -.04) * (1 - THREE.MathUtils.smoothstep(y, 0, .25));
            }
            positions.setXYZ(i, x * 3.5, (y - .5) * 3.5, z * 3.5);
        }
        geometry.computeVertexNormals();
        // 合并同一位置的法线，避免 UV 接缝和压缩拆点产生明显的三角形明暗块。
        const normals = geometry.attributes.normal, shared = new Map(), keys = [];
        for (let i = 0; i < positions.count; i++) {
            const key = [positions.getX(i), positions.getY(i), positions.getZ(i)].map(value => Math.round(value * 10000)).join(',');
            keys.push(key);
            if (!shared.has(key)) shared.set(key, new THREE.Vector3());
            shared.get(key).add(new THREE.Vector3().fromBufferAttribute(normals, i));
        }
        shared.forEach(normal => normal.normalize());
        keys.forEach((key, i) => { const normal = shared.get(key); normals.setXYZ(i, normal.x, normal.y, normal.z); });
        geometry.computeBoundingBox(); geometry.computeBoundingSphere(); mesh.geometry = geometry;
        mesh.castShadow = mesh.receiveShadow = true;
        const material = mesh.material;
        material.roughness = .79; material.envMapIntensity = .65;
        if (material.isMeshPhysicalMaterial) { material.sheen = .18; material.sheenColor.set('#bdc6ce'); material.sheenRoughness = .9; }
        if (material.normalMap) { material.bumpMap = material.normalMap; material.normalMap = null; material.bumpScale = .008; }
        if (material.map) material.map.anisotropy = 8;
    });
    const orientation = new THREE.Group(); orientation.rotation.y = 1.2; orientation.add(model);
    const astronaut = new THREE.Group(); astronaut.add(orientation); astronaut.position.set(-.55, -.12, 2.5);
    astronaut.rotation.set(.16, 0, -.93); scene.add(astronaut);
    draco.dispose();

    root.updateMatrixWorld(true);
    const source = windowFrame.localToWorld(new THREE.Vector3(0, 0, .7));
    const destination = new THREE.Vector3(.8, -1.8, -1.5);
    const key = new THREE.SpotLight('#fff0d9', 680, 36, .58, .75, 1.6);
    key.position.copy(source); key.target.position.copy(destination);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = .2; key.shadow.camera.far = 40;
    key.shadow.bias = -.00012; key.shadow.normalBias = .025;
    scene.add(key, key.target);
    const fill = new THREE.DirectionalLight('#a6c4df', .38); fill.position.set(3, 3, 9); scene.add(fill);
    const rim = new THREE.SpotLight('#c8e2f6', 100, 30, .7, 1, 1.6); rim.position.set(3, 4, -5); rim.target.position.copy(astronaut.position); scene.add(rim, rim.target);

    const beamLength = 14, beamDirection = destination.clone().sub(source).normalize();
    const haze = new THREE.ShaderMaterial({
        uniforms: { tint: { value: new THREE.Color('#fff0d6') } },
        vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `varying vec2 vUv;uniform vec3 tint;void main(){
            float edge=pow(max(0.,sin(vUv.x*3.14159)),2.);
            float streak=.35+.65*smoothstep(.08,.28,abs(fract(vUv.x*3.)-.5));
            float fade=smoothstep(0.,.04,vUv.y)*pow(1.-vUv.y,1.6);
            gl_FragColor=vec4(tint,edge*streak*fade*.075);
            #include <colorspace_fragment>
        }`, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
    const beam = new THREE.Group(); beam.position.copy(source); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDirection);
    for (let i = 0; i < 3; i++) {
        const geometry = new THREE.PlaneGeometry(3.2, beamLength); geometry.translate(0, beamLength / 2, 0);
        const plane = new THREE.Mesh(geometry, haze); plane.rotation.y = i * Math.PI / 3; beam.add(plane);
    }
    scene.add(beam);
    const dustPositions = [];
    for (let i = 0; i < 120; i++) {
        const along = 1 + random() * 10;
        const point = source.clone().addScaledVector(beamDirection, along);
        point.x += (random() - .5) * 2; point.y += (random() - .5) * 2; point.z += (random() - .5) * 2;
        dustPositions.push(point.x, point.y, point.z);
    }
    const dustGeometry = new THREE.BufferGeometry(); dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
    scene.add(new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: '#efdebc', size: .013, transparent: true, opacity: .32, depthWrite: false })));

    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Math.min(4, renderer.capabilities.maxSamples) });
    target.depthTexture = new THREE.DepthTexture(1, 1);
    const post = new THREE.Scene(), postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const grade = new THREE.ShaderMaterial({
        uniforms: { image: { value: target.texture }, depthMap: { value: target.depthTexture }, resolution: { value: new THREE.Vector2() } },
        vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader: `uniform sampler2D image;uniform sampler2D depthMap;uniform vec2 resolution;varying vec2 vUv;
            void main(){float raw=texture2D(depthMap,vUv).r;float distance=.2*160./(160.1-(raw*2.-1.)*159.9);
            float blur=smoothstep(16.,55.,distance)*1.6;vec3 c=texture2D(image,vUv).rgb*.2;vec3 glow=vec3(0.);
            for(int i=0;i<8;i++){float a=float(i)*.785398;vec2 dir=vec2(cos(a),sin(a));
                c+=texture2D(image,vUv+dir*blur/resolution).rgb*.1;
                glow+=max(vec3(0.),texture2D(image,vUv+dir*6./resolution).rgb-vec3(1.6))/8.;}
            c+=glow*.12;c*=mix(vec3(.84,.93,1.06),vec3(1.),smoothstep(.02,.45,dot(c,vec3(.2126,.7152,.0722))));
            c*=1.-.28*smoothstep(.25,.78,length((vUv-.5)*vec2(1.,.8)));
            gl_FragColor=vec4(c,1.);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
            gl_FragColor.rgb+=grain*.004;
            }`, depthTest: false, depthWrite: false
    });
    post.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), grade));
    let renders = 0, sceneCalls = 0, sceneTriangles = 0;
    function render() {
        const w = innerWidth, h = innerHeight;
        renderer.setSize(w, h); camera.aspect = w / h; camera.fov = w < 700 ? 53 : 49;
        camera.position.set(.1, .25, w < 700 ? 19 : 12.8); camera.lookAt(.4, -.3, -9); camera.updateProjectionMatrix();
        const pixels = renderer.getDrawingBufferSize(new THREE.Vector2()); target.setSize(pixels.x, pixels.y); grade.uniforms.resolution.value.copy(pixels);
        renderer.setRenderTarget(target); renderer.render(scene, camera);
        sceneCalls = renderer.info.render.calls; sceneTriangles = renderer.info.render.triangles;
        renderer.setRenderTarget(null); renderer.render(post, postCamera); renders++;
    }
    window.addEventListener('resize', render); render(); status.hidden = true;
    window.studyDiagnostics = () => ({ ready: true, renders, model: 'NASA Z2 Spacesuit', sourceSize: size.toArray(), books: bodyMatrices.length, calls: sceneCalls, triangles: sceneTriangles, materials: ['wood-color', 'wood-normal', 'wood-roughness'], shadows: renderer.shadowMap.enabled });
}

start().catch(error => { console.error(error); status.textContent = '样片加载失败，请通过本地预览地址打开并刷新。'; });
