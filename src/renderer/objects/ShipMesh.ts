import * as THREE from 'three';
import { PlayerColor, ShipType } from '../../types/GameTypes';

const PLAYER_COLORS: Record<string, number> = {
  [PlayerColor.BLUE]: 0x3388dd,
  [PlayerColor.RED]: 0xdd3333,
  [PlayerColor.GREEN]: 0x33bb33,
  [PlayerColor.YELLOW]: 0xddcc33,
};

// ── Shared geometries (created once, never disposed) ──────────

const sloopGeo = new THREE.ConeGeometry(0.12, 0.3, 4);
const galleonBodyGeo = new THREE.BoxGeometry(0.2, 0.25, 0.35);
const galleonMastGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3);
const portBodyGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.1, 8);
const portFlagGeo = new THREE.BoxGeometry(0.15, 0.1, 0.02);
const portPoleGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.3);

// ── Shared materials keyed by (playerColor hex, role) ─────────
// Materials are shared across all ships of the same color+type so
// they aren't recreated on every syncShips call.

const materialCache = new Map<string, THREE.MeshStandardMaterial>();
const mastMat = new THREE.MeshStandardMaterial({ color: 0x8b6b3a });
const poleMat = mastMat; // same brown for mast and pole

function getShipMat(color: number, roughness: number, metalness: number): THREE.MeshStandardMaterial {
  const key = `${color}-${roughness}-${metalness}`;
  let mat = materialCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materialCache.set(key, mat);
  }
  return mat;
}

export class ShipMesh {
  readonly mesh: THREE.Group;
  readonly shipType: ShipType;
  readonly playerId: string;

  constructor(shipType: ShipType, playerColor: PlayerColor) {
    this.shipType = shipType;
    this.playerId = '';
    this.mesh = new THREE.Group();

    const color = PLAYER_COLORS[playerColor] ?? 0xffffff;

    if (shipType === ShipType.PORT) {
      this.createPort(color);
    } else if (shipType === ShipType.GALLEON) {
      this.createGalleon(color);
    } else {
      this.createSloop(color);
    }

    this.mesh.userData = { type: 'ship', shipType, playerColor };
  }

  private createSloop(color: number) {
    const mat = getShipMat(color, 0.5, 0.2);
    const mesh = new THREE.Mesh(sloopGeo, mat);
    mesh.position.y = 0.1;
    mesh.castShadow = true;
    this.mesh.add(mesh);
  }

  private createGalleon(color: number) {
    const mat = getShipMat(color, 0.5, 0.2);
    const mesh = new THREE.Mesh(galleonBodyGeo, mat);
    mesh.position.y = 0.12;
    mesh.castShadow = true;
    this.mesh.add(mesh);

    const mast = new THREE.Mesh(galleonMastGeo, mastMat);
    mast.position.y = 0.35;
    this.mesh.add(mast);
  }

  private createPort(color: number) {
    const mat = getShipMat(color, 0.4, 0.3);
    const mesh = new THREE.Mesh(portBodyGeo, mat);
    mesh.position.y = 0.05;
    mesh.castShadow = true;
    this.mesh.add(mesh);

    const flagMat = getShipMat(color, 0.5, 0.5);
    const flag = new THREE.Mesh(portFlagGeo, flagMat);
    flag.position.set(0.05, 0.25, 0);
    this.mesh.add(flag);

    const pole = new THREE.Mesh(portPoleGeo, poleMat);
    pole.position.y = 0.17;
    this.mesh.add(pole);
  }

  setPosition(x: number, y: number, z: number) {
    this.mesh.position.set(x, y, z);
  }

  setHighlight(on: boolean) {
    this.mesh.traverse(child => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        child.material.emissive.setHex(on ? 0x444444 : 0x000000);
      }
    });
    this.mesh.scale.setScalar(on ? 1.25 : 1);
  }
}
