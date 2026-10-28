import * as THREE from 'three';

// Linear RGB and physical parameters from the approved opening GLB.
// FBXLoader's Phong conversion makes both the ink and its specular almost black.
const SURFACES = {
  IP_Ink: { rgb: [0.012, 0.012, 0.018], roughness: 0.46, specularIntensity: 0.84 },
  IP_White: { rgb: [0.96, 0.96, 0.955], roughness: 0.52, specularIntensity: 0.68 },
  IP_Pupil: { rgb: [0.012, 0.012, 0.018], roughness: 0.62, specularIntensity: 0.28 },
};

export function applyCharacterMaterials(model) {
  const replacements = new Map();
  function convert(original) {
    if (!original) return original;
    const recipe = SURFACES[original.name.replace(/\.\d+$/, '')];
    if (!recipe) return original;
    if (!replacements.has(original)) {
      const material = new THREE.MeshPhysicalMaterial({
        name: original.name,
        color: new THREE.Color().setRGB(...recipe.rgb, THREE.LinearSRGBColorSpace),
        roughness: recipe.roughness,
        metalness: 0,
        specularIntensity: recipe.specularIntensity,
        specularColor: 0xffffff,
        side: THREE.DoubleSide,
      });
      replacements.set(original, material);
    }
    return replacements.get(original);
  }
  model.traverse(object => {
    if (!object.isMesh) return;
    object.material = Array.isArray(object.material)
      ? object.material.map(convert) : convert(object.material);
  });
  replacements.forEach((replacement, original) => original.dispose());
}
