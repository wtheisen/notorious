import * as THREE from 'three';
import { HexCoord } from '../../types/CoordinateTypes';
import { createHexGeometry, createHexShape, hexToWorld, HEX_3D_SIZE } from '../helpers/HexGeometry';

export type HexHighlight = 'none' | 'hover' | 'selected' | 'valid' | 'island';

const COLORS: Record<HexHighlight, number> = {
  none: 0x6a8a9a,
  hover: 0x8aa0aa,
  selected: 0xd4a843,
  valid: 0x8ab4a8,
  island: 0x8b7355,
};

const sharedGeometry = createHexGeometry();

// Thin ring geometry for control indicator
function createRingGeometry(): THREE.ShapeGeometry {
  const outer = createHexShape(HEX_3D_SIZE * 0.97);
  const inner = createHexShape(HEX_3D_SIZE * 0.85);
  const hole = new THREE.Path();
  const innerPts = inner.getPoints();
  hole.setFromPoints(innerPts);
  outer.holes.push(hole);
  return new THREE.ShapeGeometry(outer);
}

const sharedRingGeo = createRingGeometry();

// Shared hover ring material — never mutated, only toggled visible/invisible
const sharedHoverRingMat = new THREE.MeshStandardMaterial({
  color: 0xd4a843,
  emissive: 0xd4a843,
  emissiveIntensity: 0.6,
  roughness: 0.3,
  metalness: 0.5,
  transparent: true,
  opacity: 0.9,
});

// Cache for control ring materials keyed by color hex (4 player colors + default white = 5 max)
const controlRingMatCache = new Map<number, THREE.MeshStandardMaterial>();

function getControlRingMat(color: number): THREE.MeshStandardMaterial {
  let mat = controlRingMatCache.get(color);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.5,
      metalness: 0.2,
      transparent: true,
      opacity: 0.4,
    });
    controlRingMatCache.set(color, mat);
  }
  return mat;
}

// Default (hidden) control ring material
const defaultControlRingMat = getControlRingMat(0xffffff);

export class HexTile {
  readonly mesh: THREE.Mesh;
  readonly coord: HexCoord;
  private highlight: HexHighlight = 'none';
  private hasIsland = false;
  private controlRing: THREE.Mesh;
  private controlColor: number | null = null;
  private hoverRing: THREE.Mesh;

  constructor(coord: HexCoord) {
    this.coord = coord;
    const material = new THREE.MeshStandardMaterial({
      color: COLORS.none,
      roughness: 0.9,
      metalness: 0.0,
    });
    this.mesh = new THREE.Mesh(sharedGeometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    const pos = hexToWorld(coord);
    this.mesh.position.set(pos.x, 0, pos.z);
    this.mesh.userData = { type: 'hex', coord };
    this.mesh.receiveShadow = true;

    // Control ring - sits just above the hex tile (material swapped via cache in setControl)
    this.controlRing = new THREE.Mesh(sharedRingGeo, defaultControlRingMat);
    this.controlRing.rotation.x = -Math.PI / 2;
    this.controlRing.position.set(pos.x, 0.03, pos.z);
    this.controlRing.visible = false;

    // Gold hover/target ring (shared material — never mutated)
    this.hoverRing = new THREE.Mesh(sharedRingGeo, sharedHoverRingMat);
    this.hoverRing.rotation.x = -Math.PI / 2;
    this.hoverRing.position.set(pos.x, 0.04, pos.z);
    this.hoverRing.visible = false;
  }

  /** Get the control ring mesh (must be added to scene separately) */
  getRing(): THREE.Mesh {
    return this.controlRing;
  }

  /** Get the hover ring mesh (must be added to scene separately) */
  getHoverRing(): THREE.Mesh {
    return this.hoverRing;
  }

  /** Show/hide gold hover border */
  setHoverBorder(on: boolean) {
    this.hoverRing.visible = on;
  }

  setHighlight(highlight: HexHighlight) {
    this.highlight = highlight;
    const mat = this.mesh.material as THREE.MeshStandardMaterial;
    if (this.hasIsland && highlight === 'none') {
      mat.color.setHex(COLORS.island);
    } else {
      mat.color.setHex(COLORS[highlight]);
    }
  }

  setIsland(hasIsland: boolean) {
    this.hasIsland = hasIsland;
    if (hasIsland && this.highlight === 'none') {
      (this.mesh.material as THREE.MeshStandardMaterial).color.setHex(COLORS.island);
    }
  }

  /** Set the control indicator color, or null to hide */
  setControl(color: number | null) {
    if (color === this.controlColor) return;
    this.controlColor = color;
    if (color === null) {
      this.controlRing.visible = false;
    } else {
      this.controlRing.material = getControlRingMat(color);
      this.controlRing.visible = true;
    }
  }

  getHighlight(): HexHighlight {
    return this.highlight;
  }
}
