import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyCharacterMaterials } from './character-materials.js';

// Shared by the scan-free preview and the image-target AR scene.
export async function createOpening({ parent, records, spacing, z = 0, portalCenter, onComplete }) {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}characters/opening/spirit_portal_opening.glb`);
  applyCharacterMaterials(gltf.scene);
  const group = new THREE.Group();
  const scale = spacing / 0.82;
  group.scale.setScalar(scale);
  group.position.z = z - 0.95 * scale;
  group.add(gltf.scene);
  const remove = [];
  gltf.scene.traverse(object => {
    if (object.isCamera || object.isLight || object.name === 'Ground') remove.push(object);
    if (object.name === 'Wall_Animated_Aperture') {
      object.material = object.material.clone();
      // In AR this is an invisible depth occluder, so the live camera remains visible.
      object.material.colorWrite = false;
      object.material.side = THREE.DoubleSide;
      object.renderOrder = -10;
    }
  });
  remove.forEach(object => object.removeFromParent());
  const portal = gltf.scene.getObjectByName('PORTAL_ROOT');
  if (portalCenter) {
    group.position.copy(portalCenter).addScaledVector(portal.position, -scale);
  }
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: 'varying vec2 p; void main(){p=uv*2.1-1.05;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 p; void main(){float d=(length(p)-.76)/.065;float a=exp(-d*d)*.20;gl_FragColor=vec4(vec3(.8),a);}',
  }));
  // glTF converts Blender Z-up to Y-up; this plane faces the viewing direction.
  halo.position.z = 0.10;
  portal.add(halo);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const duration = Math.max(...gltf.animations.map(clip => clip.duration));
  const actions = gltf.animations.map(clip => {
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    return action;
  });
  mixer.setTime(duration);
  gltf.scene.updateMatrixWorld(true);
  const names = ['SPIRIT_LEFT_HEART_ROOT', 'SPIRIT_MIDDLE_BUBBLE_ROOT', 'SPIRIT_RIGHT_LEAF_ROOT'];
  const corrections = names.map((name, index) => {
    const object = gltf.scene.getObjectByName(name);
    const bounds = new THREE.Box3().setFromObject(object);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    // Convert the exported final pose to the existing interaction model's size
    // and ground contact, blending only near the end of the entrance.
    const width = records[index].base.userData.width ?? records[index].base.userData.modelWidth;
    const factor = width / (size.x * scale);
    const wrapper = new THREE.Group();
    object.parent.add(wrapper);
    wrapper.add(object);
    return { wrapper, factor, offset: new THREE.Vector3(
      (index - 1) * spacing / scale - center.x * factor,
      -group.position.y / scale - bounds.min.y * factor,
      (z - group.position.z) / scale - center.z * factor,
    ) };
  });
  parent.add(group);
  let active = false;
  let elapsed = 0;
  function start() {
    elapsed = 0;
    active = true;
    group.visible = true;
    records.forEach(record => { record.pose.visible = false; });
    corrections.forEach(({ wrapper }) => { wrapper.position.set(0, 0, 0); wrapper.scale.setScalar(1); });
    actions.forEach(action => action.reset().play());
    mixer.setTime(0);
  }
  group.visible = false;
  return {
    group,
    get active() { return active; },
    start,
    update(delta) {
      if (!active) return;
      elapsed = Math.min(duration, elapsed + delta);
      mixer.update(delta);
      const t = THREE.MathUtils.smoothstep(elapsed, duration - 0.65, duration);
      corrections.forEach(({ wrapper, factor, offset }) => {
        wrapper.position.copy(offset).multiplyScalar(t);
        wrapper.scale.setScalar(THREE.MathUtils.lerp(1, factor, t));
      });
      if (elapsed >= duration) {
        active = false;
        group.visible = false;
        records.forEach(record => { record.pose.visible = true; });
        onComplete?.();
      }
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(gltf.scene);
      group.traverse(object => {
        if (!object.isMesh) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material.dispose());
      });
      group.removeFromParent();
    },
  };
}
