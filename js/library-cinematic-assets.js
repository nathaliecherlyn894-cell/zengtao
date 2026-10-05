import * as THREE from 'three';
import { GLTFLoader } from '../assets/library/vendor/GLTFLoader.js';
import { DRACOLoader } from '../assets/library-study/DRACOLoader.js';

export async function loadCinematicAssets(renderer) {
    const folder = 'assets/library-study/';
    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const loader = new THREE.TextureLoader();
    const [color, normal, roughness] = await Promise.all(['wood-color.jpg', 'wood-normal.jpg', 'wood-roughness.jpg'].map(name => loader.loadAsync(folder + name)));
    color.colorSpace = THREE.SRGBColorSpace;
    for (const map of [color, normal, roughness]) {
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.anisotropy = anisotropy;
    }
    const wood = new THREE.MeshStandardMaterial({ color: '#939b9f', map: color, normalMap: normal, normalScale: new THREE.Vector2(.48, .48), roughnessMap: roughness, roughness: .87 });
    // 单位立方体按实例实际尺寸铺纹；颜色、法线和粗糙度共用同一物理尺度。
    wood.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
            vec3 woodScale = vec3(1.);
            #ifdef USE_INSTANCING
                woodScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
            #endif
            vec3 woodPosition = position * woodScale;
            vec3 woodNormal = abs(normal);
            vec2 woodUv = woodNormal.x > .7 ? woodPosition.zy : (woodNormal.y > .7 ? woodPosition.xz : woodPosition.xy);
            if (woodScale.x > woodScale.y) woodUv = woodUv.yx;
            woodUv *= .75;
            #ifdef USE_MAP
                vMapUv = woodUv;
            #endif
            #ifdef USE_NORMALMAP
                vNormalMapUv = woodUv;
            #endif
            #ifdef USE_ROUGHNESSMAP
                vRoughnessMapUv = woodUv;
            #endif
        `);
    };
    wood.customProgramCacheKey = () => 'cinematic-wood-physical-uv-v1';
    const metal = new THREE.MeshStandardMaterial({ color: '#46525c', metalness: .76, roughness: .42 });
    const paperCanvas = document.createElement('canvas');
    paperCanvas.width = 64; paperCanvas.height = 512;
    const context = paperCanvas.getContext('2d');
    let seed = 61;
    for (let y = 0; y < 512; y++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const value = Math.round(172 + seed / 4294967296 * 60);
        context.fillStyle = `rgb(${value},${value - 5},${value - 17})`;
        context.fillRect(0, y, 64, 1);
    }
    const paperTexture = new THREE.CanvasTexture(paperCanvas);
    paperTexture.colorSpace = THREE.SRGBColorSpace;
    const paper = new THREE.MeshStandardMaterial({ map: paperTexture, roughness: .96 });

    const draco = new DRACOLoader();
    draco.setDecoderPath(folder + 'draco/');
    let model;
    try {
        model = (await new GLTFLoader().setDRACOLoader(draco).loadAsync(folder + 'z2-spacesuit.glb')).scene;
    } finally {
        draco.dispose();
    }
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
    const orientation = new THREE.Group(); orientation.rotation.y = 3.5;
    const originalGeometries = new Set();
    model.traverse(source => {
        if (!source.isMesh) return;
        const geometry = source.geometry.clone();
        originalGeometries.add(source.geometry);
        geometry.applyMatrix4(source.matrixWorld);
        const positions = geometry.attributes.position;
        // NASA 资源无骨骼：以平滑权重舒展双臂，并让一侧膝盖自然收起。
        for (let i = 0; i < positions.count; i++) {
            let x = (positions.getX(i) - center.x) / size.y, y = (positions.getY(i) - bounds.min.y) / size.y, z = (positions.getZ(i) - center.z) / size.y;
            const side = Math.sign(x) || 1;
            const weight = THREE.MathUtils.smoothstep(Math.abs(x), .12, .17) * THREE.MathUtils.smoothstep(y, .37, .48) * (1 - THREE.MathUtils.smoothstep(y, .77, .86));
            const elbow = (1 - THREE.MathUtils.smoothstep(y, .45, .63)) * weight;
            const angle = side * (side > 0 ? .9 : .65) * weight, dx = x - side * .145, dy = y - .73;
            x = side * .145 + dx * Math.cos(angle) - dy * Math.sin(angle);
            y = .73 + dx * Math.sin(angle) + dy * Math.cos(angle);
            z += (side > 0 ? .06 : .13) * elbow;
            if (y < .42) {
                const knee = (side > 0 ? .65 : .12) * (1 - THREE.MathUtils.smoothstep(y, .16, .3));
                const lowerY = y - .25;
                y = .25 + lowerY * Math.cos(knee);
                z += lowerY * Math.sin(knee);
                const angle = side * (side > 0 ? .24 : .1) * (1 - THREE.MathUtils.smoothstep(y, .3, .42));
                const dx = x - side * .075, dy = y - .4;
                x = side * .075 + dx * Math.cos(angle) - dy * Math.sin(angle);
                y = .4 + dx * Math.sin(angle) + dy * Math.cos(angle);
            }
            positions.setXYZ(i, x * 3.5, (y - .5) * 3.5, z * 3.5);
        }
        geometry.computeVertexNormals();
        const normals = geometry.attributes.normal, shared = new Map(), keys = [];
        const vector = new THREE.Vector3();
        for (let i = 0; i < positions.count; i++) {
            const key = [positions.getX(i), positions.getY(i), positions.getZ(i)].map(value => Math.round(value * 10000)).join(',');
            keys.push(key);
            if (!shared.has(key)) shared.set(key, new THREE.Vector3());
            shared.get(key).add(vector.fromBufferAttribute(normals, i));
        }
        shared.forEach(normal => normal.normalize());
        keys.forEach((key, i) => { const normal = shared.get(key); normals.setXYZ(i, normal.x, normal.y, normal.z); });
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const mesh = source.clone(false);
        mesh.geometry = geometry;
        mesh.position.set(0, 0, 0); mesh.quaternion.identity(); mesh.scale.setScalar(1);
        mesh.updateMatrix();
        mesh.castShadow = mesh.receiveShadow = true;
        for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) {
            material.roughness = .79; material.envMapIntensity = .65;
            if (material.isMeshPhysicalMaterial) { material.sheen = .18; material.sheenColor.set('#bdc6ce'); material.sheenRoughness = .9; }
            if (material.normalMap) { material.bumpMap = material.normalMap; material.normalMap = null; material.bumpScale = .008; }
            if (material.map) material.map.anisotropy = anisotropy;
        }
        orientation.add(mesh);
    });
    originalGeometries.forEach(geometry => geometry.dispose());
    const astronaut = new THREE.Group(); astronaut.add(orientation);

    const environmentScene = new THREE.Scene();
    environmentScene.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: '#283642', side: THREE.BackSide })));
    const softbox = new THREE.Mesh(new THREE.PlaneGeometry(7, 11), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.2, 1.9) }));
    softbox.position.set(-7, 5, 9); softbox.lookAt(0, 0, 0); environmentScene.add(softbox);
    const pmrem = new THREE.PMREMGenerator(renderer);
    let target;
    try {
        target = pmrem.fromScene(environmentScene, .06);
    } finally {
        pmrem.dispose();
        environmentScene.traverse(mesh => { if (mesh.isMesh) { mesh.geometry.dispose(); mesh.material.dispose(); } });
    }
    const environment = target.texture;
    // 调用者释放环境纹理时，同时释放 PMREM 渲染目标。
    environment.addEventListener('dispose', () => target.dispose());
    return { astronaut, wood, metal, paper, environment };
}
