import * as THREE from 'three';
import { EDGE_WRAPS } from '../../config/HexConstants';
import { hexToKey } from '../../types/CoordinateTypes';
import { hexToWorld, HEX_3D_SIZE } from '../helpers/HexGeometry';

/** Colors for wrap pairs — fits the 17th-century etched map palette */
const PAIR_COLORS = [
  0xb8963e, // Gold
  0xb87333, // Copper
  0x4a7c5c, // Verdigris
  0x8b2500, // Crimson
  0x3a5a8c, // Indigo
  0xc4883e, // Amber
];

/** Axial direction vectors (same as HexConstants DIRECTIONS) */
const DIRS: [number, number][] = [
  [1, 0],    // 0
  [1, -1],   // 1
  [0, -1],   // 2
  [-1, 0],   // 3
  [-1, 1],   // 4
  [0, 1],    // 5
];

function neighborWorldOffset(dir: number): { x: number; z: number } {
  const [dq, dr] = DIRS[dir];
  return {
    x: HEX_3D_SIZE * (Math.sqrt(3) * dq + Math.sqrt(3) / 2 * dr),
    z: HEX_3D_SIZE * (3 / 2 * dr),
  };
}

/**
 * Glowing edge segments on outer hexes where wrapping occurs.
 * Matching wrap pairs share the same glow color and pulse with a sine wave.
 */
export class WrapGlow {
  readonly group: THREE.Group;
  private materials: { mat: THREE.MeshStandardMaterial; phaseOffset: number }[] = [];

  constructor() {
    this.group = new THREE.Group();

    // Group EDGE_WRAPS by normalized (from, to) pair
    const pairMap = new Map<string, typeof EDGE_WRAPS>();
    for (const entry of EDGE_WRAPS) {
      const keyA = hexToKey(entry.from);
      const keyB = hexToKey(entry.to);
      // Normalize: smaller key first
      const pairKey = keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;
      if (!pairMap.has(pairKey)) pairMap.set(pairKey, []);
      pairMap.get(pairKey)!.push(entry);
    }

    const pairs = Array.from(pairMap.values());
    const edgeGeo = new THREE.BoxGeometry(HEX_3D_SIZE * 0.85, 0.015, 0.06);

    for (let i = 0; i < pairs.length; i++) {
      const color = PAIR_COLORS[i % PAIR_COLORS.length];
      const phaseOffset = (i / pairs.length) * Math.PI * 2;

      const mat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });

      this.materials.push({ mat, phaseOffset });

      for (const entry of pairs[i]) {
        const center = hexToWorld(entry.from);
        const offset = neighborWorldOffset(entry.direction);
        const len = Math.sqrt(offset.x * offset.x + offset.z * offset.z);
        const nx = offset.x / len;
        const nz = offset.z / len;

        const innerRadius = HEX_3D_SIZE * Math.sqrt(3) / 2 * 0.97;

        const mesh = new THREE.Mesh(edgeGeo, mat);
        mesh.position.set(
          center.x + nx * innerRadius,
          0.025, // between tile surface and control rings
          center.z + nz * innerRadius,
        );

        // Rotate so the long side runs along the hex edge
        const angle = Math.atan2(nz, nx);
        mesh.rotation.y = Math.PI / 2 - angle;

        this.group.add(mesh);
      }
    }
  }

  update(elapsed: number) {
    for (const { mat, phaseOffset } of this.materials) {
      mat.emissiveIntensity = 0.3 + 0.3 * Math.sin(elapsed * 1.5 + phaseOffset);
    }
  }
}
