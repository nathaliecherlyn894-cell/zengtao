import * as THREE from 'three';
import { RoundedBoxGeometry } from '../assets/library-study/RoundedBoxGeometry.js';

export const LIBRARY_FOG_DENSITY = .024;

// 五面书架共享同一截面，纵向条带连接相邻截面。
export function createLibrarySpace(coverMaterial, columns, rows, bookCount, materials = {}) {
    const root = new THREE.Group();
    const sections = [];
    const daylightWindows = [];
    const faces = Array.from({ length: 5 }, (_, index) => {
        const angle = Math.PI / 2 - Math.PI / 5 - index * Math.PI * 2 / 5;
        const frame = new THREE.Object3D();
        frame.position.set(Math.cos(angle) * 4.3, Math.sin(angle) * 4.3, 0);
        frame.rotation.z = angle - Math.PI / 2;
        frame.updateMatrix();
        return frame.matrix.clone();
    });
    const wood = materials.wood ?? new THREE.MeshStandardMaterial({ color: '#30363c', roughness: .86, metalness: .06 });
    const paper = materials.paper ?? new THREE.MeshStandardMaterial({ color: '#a5adb2', roughness: .93 });
    const edge = materials.metal ?? new THREE.MeshStandardMaterial({ color: '#687582', roughness: .65, metalness: .2 });
    const jacket = new THREE.MeshStandardMaterial({ color: '#41434a', roughness: .72 });
    const windowMaterial = new THREE.MeshBasicMaterial({ color: '#b29b7b' });
    const ribbonMaterial = new THREE.ShaderMaterial({
        uniforms: { opacity: { value: .3 }, fogDensity: { value: LIBRARY_FOG_DENSITY }, farFade: { value: new THREE.Vector2(85, 109) } },
        vertexShader: `varying vec2 vUv; varying float depth;
            void main(){vUv=uv;vec4 p=modelViewMatrix*instanceMatrix*vec4(position,1.);depth=-p.z;gl_Position=projectionMatrix*p;}`,
        fragmentShader: `uniform float opacity; uniform float fogDensity; uniform vec2 farFade; varying vec2 vUv; varying float depth;
            void main(){float profile=max(0.,sin(vUv.x*3.14159));
            float detail=1.-smoothstep(.025,.16,fwidth(vUv.x));
            float halo=pow(profile,1.6), core=pow(profile,mix(4.,14.,detail))*mix(.3,1.,detail);
            float endFade=smoothstep(0.,.16,vUv.y)*smoothstep(0.,.16,1.-vUv.y);
            float distanceFade=exp(-pow(max(depth,0.)*fogDensity,2.))*(1.-smoothstep(farFade.x,farFade.y,depth));
            vec3 light=mix(vec3(.66,.81,1.),vec3(.95,.98,1.),core);
            gl_FragColor=vec4(light,opacity*(halo*.42+core)*endFade*distanceFade);
            #include <colorspace_fragment>
            }`,
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
    const scatterMaterial = ribbonMaterial.clone();
    scatterMaterial.uniforms.scatter = { value: 0 };
    scatterMaterial.uniforms.time = { value: 0 };
    scatterMaterial.vertexShader = `uniform float scatter; uniform float time; varying vec2 vUv; varying float depth;
        void main(){vUv=uv;vec3 local=position;local.x*=.23;
        vec4 p=instanceMatrix*vec4(local,1.);
        float seed=dot(instanceMatrix[3].xy,vec2(12.9898,78.233));
        vec2 radial=normalize(p.xy);vec2 tangent=vec2(-radial.y,radial.x);
        float arc=sin(uv.y*3.14159)*scatter;
        p.xy+=arc*(radial*(1.1+.35*sin(seed))+tangent*.4*sin(seed+uv.y*4.+time*.7));
        vec4 view=modelViewMatrix*p;depth=-view.z;gl_Position=projectionMatrix*view;}`;
    scatterMaterial.fragmentShader = 'uniform float scatter;\n' + ribbonMaterial.fragmentShader.replace('opacity*(halo*.42+core)', 'opacity*scatter*(halo*.7+core)');
    const cube = new THREE.BoxGeometry(1, 1, 1);
    const rounded = new RoundedBoxGeometry(1, 1, 1, 1, .035);
    const dummy = new THREE.Object3D();
    let ribbonCount = 0;
    let windowCount = 0;
    const transform = (face, x, y, z, sx, sy, sz, rx = 0, ry = 0) => {
        dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz);
        dummy.rotation.set(rx, ry, 0); dummy.updateMatrix();
        return new THREE.Matrix4().multiplyMatrices(face, dummy.matrix);
    };
    const instanced = (geometry, material, matrices) => {
        const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
        matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
        return mesh;
    };

    for (let sectionIndex = 0; sectionIndex < 18; sectionIndex++) {
        const group = new THREE.Group();
        const daylightSide = sectionIndex % 3 === 1 ? (sectionIndex % 6 === 1 ? 0 : 4) : -1;
        const beams = [], innerBeams = [], rails = [], bodies = [], covers = [], ribbons = [], windows = [], jackets = [];
        const offsets = [];
        faces.forEach((face, side) => {
            // 每面内部保持矩形格架，外围转角共同构成五边形。
            for (const y of [0, 1.8, 3.6]) {
                innerBeams.push(transform(face, 0, y, 0, 6.3, .22, .72));
                rails.push(transform(face, 0, y - .045, .37, 6.28, .035, .035));
            }
            for (let column = 0; column <= 5; column++) {
                const x = -3.125 + column * 1.25;
                innerBeams.push(transform(face, x, 1.8, 0, .15, 3.6, .65));
                beams.push(transform(face, x, 0, -4.5, .07, .1, 9));
            }
            for (let row = 0; row < 2; row++) {
                for (let column = 0; column < 5; column++) {
                    if (side === daylightSide && (column === 2 || column === 3)) continue;
                    const identity = sectionIndex * 23 + side * 11 + row * 5 + column;
                    const x = -2.5 + column * 1.25, y = .86 + row * 1.8;
                    // 留出暗槽、光窗和错开的空位，避免每个格子都填满。
                    if (identity % 19 === 4) {
                        windows.push(transform(face, x, y, -.23, .42, 1.43, .035));
                        continue;
                    }
                    if (identity % 7 === 0 || (row === 1 && identity % 3 === 0)) continue;
                    const book = identity % bookCount;
                    const height = 1.31 + (book % 3) * .06;
                    const z = .24 - (identity % 3) * .12;
                    bodies.push(transform(face, x, y, z, .89, height, .16, -.07));
                    jackets.push(transform(face, x, y - .006, z - .095, .92, height + .025, .025, -.07));
                    jackets.push(transform(face, x - .455, y, z, .025, height + .025, .2, -.07));
                    covers.push(transform(face, x, y + .006, z + .082, .91, height, 1, -.07));
                    offsets.push((book % columns) / columns, 1 - (Math.floor(book / columns) + 1) / rows);
                }
            }
            // 转角处细梁之间穿插软边光束，保留亮芯和渐淡的光晕。
            for (let strand = 0; strand < 20; strand++) {
                const sideSign = strand < 10 ? -1 : 1;
                const slot = strand % 10;
                const x = sideSign * (2.45 + slot * .083);
                const y = .07 + (slot % 4) * .065;
                const width = slot % 4 === 0 ? .052 : .016;
                rails.push(transform(face, x, y, -4.5, width, .025, 9));
                if (slot % 2 === 0) ribbons.push(transform(face, x - sideSign * .08, y + .025, -4.5, .36 + slot * .02, 8.9, 1, Math.PI / 2));
            }
            for (const y of [1.8, 3.6]) {
                for (let strand = 0; strand < 4; strand++) {
                    rails.push(transform(face, 0, y + strand * .045, -.18 - strand * .05, 6.25, .012, .035));
                }
            }
            // 外层格架错开角度与深度，透过内层空隙显出更远的空间。
            for (let layer = 0; layer < 2; layer++) {
                const frame = new THREE.Object3D();
                const angle = Math.PI / 2 - Math.PI / 5 - side * Math.PI * 2 / 5 + (layer ? -.1 : .07);
                const radius = layer ? 13 : 8.6;
                frame.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, -2 - layer * 3);
                frame.rotation.z = angle - Math.PI / 2; frame.updateMatrix();
                const outer = frame.matrix;
                const width = layer ? 16 : 12;
                for (const y of [0, 1.6, 3.2]) {
                    beams.push(transform(outer, 0, y, 0, width, .14, .45));
                    for (let strand = 0; strand < 4; strand++) {
                        rails.push(transform(outer, 0, y + strand * .055, -.15 - strand * .08, width, .018, .045));
                    }
                }
                for (let column = 0; column <= 8; column++) {
                    const x = (column / 8 - .5) * width;
                    beams.push(transform(outer, x, 1.6, 0, .1, 3.2, .5));
                    beams.push(transform(outer, x, 0, -4.5, .045, .08, 9));
                    for (let strand = 0; strand < 3; strand++) {
                        rails.push(transform(outer, x + strand * .075, .08, -4.5, .017, .025, 9));
                    }
                    if (column % 2 === 0) ribbons.push(transform(outer, x, .13, -4.5, .48, 8.9, 1, Math.PI / 2));
                    const identity = sectionIndex * 13 + side * 7 + column + layer * 3;
                    if (column === 8) continue;
                    const y = identity % 2 ? .8 : 2.4;
                    if (identity % 13 === 0) {
                        windows.push(transform(outer, x + .5, y, -.2, .32, 1.25, .035));
                    } else if (identity % 3 === 0) {
                        const book = identity % bookCount;
                        bodies.push(transform(outer, x + .6, y, .1, .8, 1.25, .16));
                        covers.push(transform(outer, x + .6, y, .19, .81, 1.25, 1));
                        offsets.push((book % columns) / columns, 1 - (Math.floor(book / columns) + 1) / rows);
                    }
                }
            }
        });
        const coverGeometry = new THREE.PlaneGeometry(1, 1);
        coverGeometry.setAttribute('atlasOffset', new THREE.InstancedBufferAttribute(new Float32Array(offsets), 2));
        group.add(instanced(cube, wood, beams), instanced(rounded, wood, innerBeams), instanced(cube, paper, bodies), instanced(coverGeometry, coverMaterial, covers), instanced(cube, jacket, jackets));
        group.add(instanced(cube, edge, rails), instanced(new THREE.PlaneGeometry(1, 1), ribbonMaterial, ribbons), instanced(cube, windowMaterial, windows));
        const scatter = instanced(new THREE.PlaneGeometry(1, 1, 1, 16), scatterMaterial, ribbons.filter((_, index) => index % 4 === 0));
        // 着色器最多偏移 1.85 个单位，包围盒与剔除范围须同时覆盖。
        scatter.computeBoundingBox(); scatter.boundingBox.expandByScalar(1.85);
        scatter.computeBoundingSphere(); scatter.boundingSphere.radius += 1.85;
        group.add(scatter);
        group.children.forEach(mesh => {
            if (!mesh.material.transparent && mesh.material !== windowMaterial) {
                mesh.castShadow = mesh.geometry === cube || mesh.geometry === rounded;
                mesh.receiveShadow = true;
            }
        });
        if (daylightSide >= 0) daylightWindows.push({ section: group, face: faces[daylightSide] });
        root.add(group); sections.push(group);
        ribbonCount += ribbons.length; windowCount += windows.length;
    }
    const bounds = new THREE.Box3().setFromObject(root);
    return { root, sections, faces, bounds, ribbonMaterial, scatterMaterial, ribbonCount, windowCount, daylightWindows };
}

// 以完整结构的包围盒计算回收位置，斜视角和横竖屏都须完全经过镜头。
export function getRecycleZ(space, camera) {
    const view = new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, space.root.matrixWorld);
    const bounds = space.bounds.clone().applyMatrix4(view);
    return (camera.near + 1 - bounds.min.z) / view.elements[10];
}

// 原模型无骨架：保留 UV，对手臂与腿部做连续的局部旋转以展开姿态。
export function relaxAstronaut(model) {
    const smooth = THREE.MathUtils.smoothstep;
    model.traverse(mesh => {
        if (!mesh.isMesh) return;
        const geometry = mesh.geometry.clone();
        mesh.geometry = geometry;
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            let x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
            const originalY = y;
            const side = Math.sign(x) || 1;
            const armWeight = smooth(Math.abs(x), .27, .39) * smooth(y, .68, .85) * (1 - smooth(y, 1.48, 1.7));
            if (armWeight > 0) {
                const angle = side * .68 * armWeight;
                const dx = x - side * .26, dy = y - 1.48;
                x = side * .26 + dx * Math.cos(angle) - dy * Math.sin(angle);
                y = 1.48 + dx * Math.sin(angle) + dy * Math.cos(angle);
            }
            if (originalY < .82) {
                const weight = 1 - smooth(originalY, .62, .82);
                const angle = side * (side > 0 ? .18 : .3) * weight;
                const dx = x - side * .14, dy = y - .82;
                x = side * .14 + dx * Math.cos(angle) - dy * Math.sin(angle);
                y = .82 + dx * Math.sin(angle) + dy * Math.cos(angle);
                if (originalY < .43) {
                    const bend = (side > 0 ? .35 : .65) * (1 - smooth(originalY, .3, .43));
                    const kneeY = y - .43;
                    y = .43 + kneeY * Math.cos(bend) - z * Math.sin(bend);
                    z = kneeY * Math.sin(bend) + z * Math.cos(bend);
                }
            }
            positions.setXYZ(i, x, y, z);
        }
        positions.needsUpdate = true;
        geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    });
}
