import * as THREE from 'three';
import { PlayerColor, ShipType } from '../../types/GameTypes';

const PLAYER_COLORS: Record<string, number> = {
  [PlayerColor.BLUE]: 0x3388dd,
  [PlayerColor.RED]: 0xdd3333,
  [PlayerColor.GREEN]: 0x33bb33,
  [PlayerColor.YELLOW]: 0xddcc33,
};

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
    // Small cone for sloop
    const geo = new THREE.ConeGeometry(0.12, 0.3, 4);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.1;
    mesh.castShadow = true;
    this.mesh.add(mesh);
  }

  private createGalleon(color: number) {
    // Larger box for galleon
    const geo = new THREE.BoxGeometry(0.2, 0.25, 0.35);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.12;
    mesh.castShadow = true;
    this.mesh.add(mesh);

    // Mast
    const mastGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x8b6b3a });
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.y = 0.35;
    this.mesh.add(mast);
  }

  private createPort(color: number) {
    // Flat cylinder for port
    const geo = new THREE.CylinderGeometry(0.25, 0.25, 0.1, 8);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.05;
    mesh.castShadow = true;
    this.mesh.add(mesh);

    // Flag on top
    const flagGeo = new THREE.BoxGeometry(0.15, 0.1, 0.02);
    const flagMat = new THREE.MeshStandardMaterial({ color });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.05, 0.25, 0);
    this.mesh.add(flag);

    const poleGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.3);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x8b6b3a });
    const pole = new THREE.Mesh(poleGeo, poleMat);
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
