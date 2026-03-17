import * as THREE from 'three';
import { EdgeDirection } from '../../types/CoordinateTypes';
import { Island } from '../../core/Island';
import { hexToWorld, HEX_3D_SIZE } from '../helpers/HexGeometry';

/**
 * Renders small wall markers on impassable island edges.
 *
 * EdgeDirection values correspond to indices in DIRECTION_VECTORS:
 *   0(NORTH):     (1, 0)  → East in world
 *   1(NORTHEAST):  (1,-1)  → NE in world
 *   2(SOUTHEAST):  (0,-1)  → NW in world
 *   3(SOUTH):     (-1, 0) → West in world
 *   4(SOUTHWEST): (-1, 1) → SW in world
 *   5(NORTHWEST):  (0, 1)  → SE in world
 *
 * The names don't match world compass directions — they're just game labels.
 * We position walls based on the actual world-space neighbor offsets.
 */
export class EdgeMarker {
  readonly mesh: THREE.Group;

  constructor(island: Island) {
    this.mesh = new THREE.Group();

    const center = hexToWorld(island.hexCoord);
    this.mesh.position.set(center.x, 0, center.z);

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x6b4422,
      roughness: 0.8,
    });

    for (const edge of island.impassableEdges) {
      const wallGeo = new THREE.BoxGeometry(HEX_3D_SIZE * 0.85, 0.2, 0.08);
      const wall = new THREE.Mesh(wallGeo, wallMat);

      // Get the world-space offset toward this neighbor
      const offset = neighborWorldOffset(edge);
      const len = Math.sqrt(offset.x * offset.x + offset.z * offset.z);
      const nx = offset.x / len;
      const nz = offset.z / len;

      // Place wall at the hex edge midpoint (inner radius from center)
      const innerRadius = HEX_3D_SIZE * Math.sqrt(3) / 2 * 0.97; // match hex gap
      wall.position.set(
        nx * innerRadius,
        0.05,
        nz * innerRadius
      );

      // Rotate wall so its thin side (Z) faces the neighbor direction
      // and its long side (X) runs along the hex edge
      const angle = Math.atan2(nz, nx);
      wall.rotation.y = Math.PI / 2 - angle;

      wall.castShadow = true;
      this.mesh.add(wall);
    }
  }
}

/**
 * Compute the world-space XZ offset toward a neighbor for each EdgeDirection,
 * using the same hex math as hexToWorld.
 */
function neighborWorldOffset(edge: EdgeDirection): { x: number; z: number } {
  // Axial direction vectors matching DIRECTION_VECTORS indices
  const dirs: [number, number][] = [
    [1, 0],    // 0 (NORTH)
    [1, -1],   // 1 (NORTHEAST)
    [0, -1],   // 2 (SOUTHEAST)
    [-1, 0],   // 3 (SOUTH)
    [-1, 1],   // 4 (SOUTHWEST)
    [0, 1],    // 5 (NORTHWEST)
  ];

  const [dq, dr] = dirs[edge];
  return {
    x: HEX_3D_SIZE * (Math.sqrt(3) * dq + Math.sqrt(3) / 2 * dr),
    z: HEX_3D_SIZE * (3 / 2 * dr),
  };
}
