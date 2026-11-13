import * as THREE from 'three';
import { BEACON } from '../data/story';
import { stoneTexture } from '../core/textures';
import { heightAt } from './terrain';

/** Sur ötesindeki Çağrı Kulesi: hikâyenin son durağı. Uzaktan görünsün diye tepesinde soluk bir ışık yanar. */
export function buildBeacon() {
  const [x, z] = BEACON;
  const g = new THREE.Group();
  g.position.set(x, heightAt(x, z), z);
  const tex = stoneTexture();
  tex.repeat.set(3, 6);
  const stone = new THREE.MeshLambertMaterial({ color: 0x8d8a84, map: tex });
  const dark = new THREE.MeshLambertMaterial({ color: 0x4a4744 });
  const bronze = new THREE.MeshLambertMaterial({ color: 0x8a6a34, emissive: 0x2a1c08 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(15, 17, 3, 12), dark);
  base.position.y = 1.5;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 8.5, 52, 8), stone);
  shaft.position.y = 29;
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(8, 6, 3, 8), dark);
  gallery.position.y = 56;
  g.add(base, shaft, gallery);
  // Çanı taşıyan dört ayak ve çatı.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.1, 11, 1.1), dark);
    post.position.set(Math.sin(a) * 5.6, 63, Math.cos(a) * 5.6);
    g.add(post);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(9, 7, 8), dark);
  roof.position.y = 72;
  // Çan: ağzı aşağı bakan, yana yatmış çatlak bir tunç gövde.
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 4.4, 7.5, 12, 1, true), bronze);
  bronze.side = THREE.DoubleSide;
  bell.position.y = 63.5;
  bell.rotation.z = 0.22;
  const crack = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6.6, 0.5), new THREE.MeshBasicMaterial({ color: 0xffb060 }));
  crack.position.set(0.6, 63.3, 3.05);
  crack.rotation.z = 0.36;
  g.add(roof, bell, crack);
  for (const m of [base, shaft, gallery, roof]) m.castShadow = true;

  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 260, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffc27a,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    }),
  );
  glow.position.y = 200;
  g.add(glow);
  return g;
}
