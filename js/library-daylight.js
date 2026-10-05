import * as THREE from 'three';
import { LIBRARY_FOG_DENSITY } from './library-space.js';

// 窗口随书架移动，人物与环境共享同一组真实光源和阴影。
export function createDaylight(space, scene) {
    // 清晨的淡金阳光：保留高亮窗心，让光束与衣料受光带一点桃色。
    const pane = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.62, .72), side: THREE.DoubleSide });
    const haze = new THREE.ShaderMaterial({
        uniforms: { tint: { value: new THREE.Color('#ffd0a0') }, halo: { value: false }, fogDensity: { value: LIBRARY_FOG_DENSITY }, farFade: { value: new THREE.Vector2(85, 109) } },
        vertexShader: `varying vec2 vUv; varying float depth;
            void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.);depth=-p.z;gl_Position=projectionMatrix*p;}`,
        fragmentShader: `uniform vec3 tint; uniform bool halo; uniform float fogDensity; uniform vec2 farFade; varying vec2 vUv; varying float depth;
            void main(){
                float fog=exp(-pow(max(depth,0.)*fogDensity,2.))*(1.-smoothstep(farFade.x,farFade.y,depth));
                float alpha;
                if(halo){vec2 p=abs(vUv-.5)*2.;alpha=pow(max(0.,1.-max(p.x,p.y)),2.)*.16;}
                else {float edge=pow(max(0.,sin(vUv.x*3.14159)),2.);
                    float bars=.45+.55*smoothstep(.04,.14,abs(fract(vUv.x*3.)-.5));
                    alpha=edge*bars*smoothstep(0.,.06,vUv.y)*pow(1.-vUv.y,1.35)*.12;}
                gl_FragColor=vec4(tint,alpha*fog);
                #include <colorspace_fragment>
            }`,
        transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
    const haloMaterial = haze.clone(); haloMaterial.uniforms.halo.value = true;
    const up = new THREE.Vector3(0, 1, 0);
    const sources = space.daylightWindows.map(({ section, face }, index) => {
        const frame = new THREE.Group();
        frame.position.set(.625, 1.8, -.55).applyMatrix4(face);
        frame.quaternion.setFromRotationMatrix(face);
        section.add(frame);
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.28, 3.25), pane);
        frame.add(panel);
        const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.6), haloMaterial);
        halo.position.z = .02; frame.add(halo);
        const origin = new THREE.Object3D(); origin.position.z = -.3; frame.add(origin);
        const aim = new THREE.Object3D(); aim.position.set(0, 0, 7); section.add(aim);
        const beamStart = frame.position.clone(); beamStart.z += .2;
        const direction = aim.position.clone().sub(beamStart).normalize();
        const beam = new THREE.Group(); beam.position.copy(beamStart); beam.quaternion.setFromUnitVectors(up, direction);
        for (let sheet = 0; sheet < 2; sheet++) {
            const geometry = new THREE.PlaneGeometry(2.1, 11); geometry.translate(0, 5.5, 0);
            const ray = new THREE.Mesh(geometry, haze); ray.rotation.y = sheet * Math.PI / 2; beam.add(ray);
        }
        section.add(beam);
        return { index, origin, aim, world: new THREE.Vector3(), target: new THREE.Vector3() };
    });
    // 将新增光束计入回收边界，避免光束仍可见时窗口提前循环。
    space.root.updateMatrixWorld(true);
    space.bounds.setFromObject(space.root);
    const makeLight = parent => {
        const light = new THREE.SpotLight('#ffd2a3', 0, 32, .57, .65, 1.5);
        light.castShadow = true;
        light.shadow.mapSize.set(innerWidth < 700 ? 512 : 1024, innerWidth < 700 ? 512 : 1024);
        light.shadow.camera.near = .3;
        light.shadow.camera.far = 32;
        light.shadow.bias = -.0003;
        light.shadow.normalBias = .035;
        parent.add(light, light.target);
        return light;
    };
    const pairs = Array.from({ length: 2 }, () => ({ environment: makeLight(scene), source: null }));
    const toPerson = new THREE.Vector3(), direction = new THREE.Vector3();
    let illumination = 0;
    return {
        update(astronaut, fogDensity = LIBRARY_FOG_DENSITY, farFade = haze.uniforms.farFade.value) {
            for (const material of [haze, haloMaterial]) {
                material.uniforms.fogDensity.value = fogDensity;
                material.uniforms.farFade.value.copy(farFade);
            }
            space.root.updateMatrixWorld(true);
            sources.forEach(source => {
                source.origin.getWorldPosition(source.world); source.aim.getWorldPosition(source.target);
            });
            const nearest = [...sources].sort((a, b) => Math.abs(a.world.z - astronaut.position.z) - Math.abs(b.world.z - astronaut.position.z));
            illumination = 0;
            pairs.forEach((pair, index) => {
                const source = nearest[index]; pair.source = source;
                const strength = 430 * (1 - THREE.MathUtils.smoothstep(Math.abs(source.world.z - astronaut.position.z), 15, 23));
                const light = pair.environment;
                light.position.copy(source.world); light.target.position.copy(source.target); light.intensity = strength;
                direction.subVectors(source.target, source.world).normalize();
                toPerson.subVectors(astronaut.position, source.world);
                const distance = toPerson.length();
                const cone = THREE.MathUtils.smoothstep(direction.dot(toPerson.normalize()), Math.cos(.57), Math.cos(.57 * .35));
                illumination += strength * cone / Math.max(1, distance ** 1.5);
            });
        },
        diagnostics() {
            return { windows: sources.length, illumination, lights: pairs.map(({ environment, source }) => ({
                window: source?.index, position: environment.position.toArray(), target: environment.target.position.toArray(),
                personPosition: environment.position.toArray(), personTarget: environment.target.position.toArray(), intensity: environment.intensity
            })) };
        }
    };
}
