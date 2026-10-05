import * as THREE from 'three';
import { LIBRARY_FOG_DENSITY } from './library-space.js';

// 远景显露随速度推进，循环末端另行渐隐，不依赖可变雾浓度遮住接缝。
export function createDepthReveal(scene, space) {
    const amount = { value: 0 }, front = { value: 24 };
    const fade = { value: new THREE.Vector2(85, 109) };
    const materials = new Set();
    scene.traverse(object => {
        if (object.isMesh) for (const material of [].concat(object.material)) {
            if (material.fog && !material.isShaderMaterial) materials.add(material);
        }
    });
    materials.forEach(material => {
        const compile = material.onBeforeCompile;
        const cacheKey = material.customProgramCacheKey();
        material.onBeforeCompile = function(shader, renderer) {
            compile.call(this, shader, renderer);
            Object.assign(shader.uniforms, { revealAmount: amount, revealFront: front, revealFade: fade });
            shader.fragmentShader = 'uniform float revealAmount; uniform float revealFront; uniform vec2 revealFade;\n' + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `
                #ifdef USE_FOG
                    float revealed = smoothstep(18.,35.,vFogDepth)*(1.-smoothstep(revealFront-8.,revealFront+8.,vFogDepth));
                    gl_FragColor.rgb *= 1. + revealAmount * revealed * .65;
                #endif
                #include <fog_fragment>
                #ifdef USE_FOG
                    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(revealFade.x, revealFade.y, vFogDepth));
                #endif
            `);
        };
        material.customProgramCacheKey = () => cacheKey + '-depth-reveal-v1';
    });
    const guides = [new THREE.PointLight('#b8ccdc', 0, 32, 1.4), new THREE.PointLight('#e0e4e4', 0, 38, 1.4)];
    space.root.add(...guides);
    for (const material of [space.ribbonMaterial, space.scatterMaterial]) material.uniforms.farFade = fade;
    return {
        fade: fade.value,
        resize(camera, recycleZ, length) {
            const view = new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, space.root.matrixWorld);
            const bounds = space.bounds.clone().applyMatrix4(view);
            const insertionDepth = -(bounds.max.z + (recycleZ - length) * view.elements[10]);
            const end = Math.min(camera.far - 5, insertionDepth - 4);
            fade.value.set(end - 24, end);
        },
        update(boost) {
            amount.value = boost; front.value = 24 + boost * 60;
            scene.fog.density = THREE.MathUtils.lerp(LIBRARY_FOG_DENSITY, .0144, boost);
            for (const material of [space.ribbonMaterial, space.scatterMaterial]) material.uniforms.fogDensity.value = scene.fog.density;
            guides[0].position.set(0, .8, -24 - boost * 15); guides[0].intensity = boost * 65;
            guides[1].position.set(-.8, .4, -44 - boost * 22); guides[1].intensity = boost * 90;
        },
        diagnostics() { return { amount: amount.value, front: front.value, farFade: fade.value.toArray(), guideIntensity: guides.reduce((sum, light) => sum + light.intensity, 0) }; }
    };
}
