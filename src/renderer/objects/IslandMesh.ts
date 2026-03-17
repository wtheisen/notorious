import * as THREE from 'three';
import { Island } from '../../core/Island';
import { EdgeDirection } from '../../types/CoordinateTypes';
import { hexToWorld, HEX_3D_SIZE } from '../helpers/HexGeometry';

function neighborOffset(edge: EdgeDirection): { x: number; z: number } {
  const dirs: [number, number][] = [
    [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
  ];
  const [dq, dr] = dirs[edge];
  return {
    x: HEX_3D_SIZE * (Math.sqrt(3) * dq + Math.sqrt(3) / 2 * dr),
    z: HEX_3D_SIZE * (3 / 2 * dr),
  };
}

export class IslandMesh {
  readonly mesh: THREE.Group;
  readonly island: Island;

  constructor(island: Island) {
    this.island = island;
    this.mesh = new THREE.Group();

    const pos = hexToWorld(island.hexCoord);
    this.mesh.position.set(pos.x, 0.08, pos.z);

    for (const edge of island.impassableEdges) {
      const islet = this.createIslet(edge);
      this.mesh.add(islet);
    }

    const label = this.createLabel(island.name);
    label.position.y = 0.6;
    this.mesh.add(label);

    this.mesh.userData = { type: 'island', name: island.name };
  }

  private createIslet(edge: EdgeDirection): THREE.Group {
    const islet = new THREE.Group();

    // Direction toward neighbor
    const off = neighborOffset(edge);
    const len = Math.sqrt(off.x * off.x + off.z * off.z);
    const nx = off.x / len;
    const nz = off.z / len;
    const angle = Math.atan2(nz, nx);

    // Place slightly inward from the hex edge
    const innerRadius = HEX_3D_SIZE * Math.sqrt(3) / 2 * 0.77;
    islet.position.set(nx * innerRadius, 0, nz * innerRadius);

    // Rounded capsule-like island using a sphere scaled into an elongated pill
    const islandGeo = new THREE.SphereGeometry(HEX_3D_SIZE * 0.38, 12, 8);
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x3a8a4a,
      roughness: 0.8,
    });
    const islandBody = new THREE.Mesh(islandGeo, islandMat);
    // Scale into a long thin pill: stretch along edge tangent, flatten vertically
    islandBody.scale.set(1.3, 0.2, 0.25);
    // Rotate so the long axis aligns with the hex edge (tangent direction)
    islandBody.rotation.y = Math.PI / 2 - angle;
    islandBody.position.y = 0.03;
    islandBody.castShadow = true;
    islet.add(islandBody);

    // Small vegetation bumps on top
    const bumpGeo = new THREE.SphereGeometry(0.05, 6, 4);
    const bumpMat = new THREE.MeshStandardMaterial({
      color: 0x2a7a3a,
    });
    const tx = -nz;
    const tz = nx;
    for (const t of [-0.12, 0.08]) {
      const bump = new THREE.Mesh(bumpGeo, bumpMat);
      bump.position.set(tx * t, 0.1, tz * t);
      bump.scale.y = 0.6;
      islet.add(bump);
    }

    return islet;
  }

  private createLabel(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.roundRect(4, 4, 248, 56, 8);
    ctx.fill();
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.2, 0.3, 1);
    return sprite;
  }
}
