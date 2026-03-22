import * as THREE from 'three';
import { ActionType, PlayerColor } from '../../types/GameTypes';
import { PlayerState } from '../../game/types/GameState';

const PLAYER_COLORS: Record<string, number> = {
  [PlayerColor.BLUE]: 0x4499ee,
  [PlayerColor.RED]: 0xee4455,
  [PlayerColor.GREEN]: 0x44cc55,
  [PlayerColor.YELLOW]: 0xeebb33,
};

const ACTION_ORDER: ActionType[] = [
  ActionType.SAIL,
  ActionType.BUILD,
  ActionType.STEAL,
  ActionType.SINK,
  ActionType.CHART,
];

const ACTION_ICONS: Record<ActionType, string> = {
  [ActionType.SAIL]: 'SAIL',
  [ActionType.BUILD]: 'BUILD',
  [ActionType.STEAL]: 'STEAL',
  [ActionType.SINK]: 'SINK',
  [ActionType.CHART]: 'CHART',
};

/** A single action space platform with label and meeple slots */
class ActionSpace {
  readonly mesh: THREE.Group;
  readonly action: ActionType;
  readonly platform: THREE.Mesh;
  private ring: THREE.Mesh;
  private meeples: THREE.Group;
  private label: THREE.Sprite;

  constructor(action: ActionType, x: number, z: number) {
    this.action = action;
    this.mesh = new THREE.Group();
    this.mesh.position.set(x, 0, z);

    // Platform - hex shaped, 33% larger
    const platGeo = new THREE.CylinderGeometry(0.60, 0.67, 0.1, 6);
    const platMat = new THREE.MeshStandardMaterial({
      color: 0x8b7355,
      roughness: 0.75,
      metalness: 0.1,
    });
    this.platform = new THREE.Mesh(platGeo, platMat);
    this.platform.position.y = 0.05;
    this.platform.receiveShadow = true;
    this.platform.userData = { type: 'actionSpace', action };
    this.mesh.add(this.platform);

    // Border ring - rotate to match platform hex orientation
    const ringGeo = new THREE.TorusGeometry(0.64, 0.025, 8, 6);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.5, emissive: 0x000000 });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.rotation.z = Math.PI / 6;
    this.ring.position.y = 0.07;
    this.mesh.add(this.ring);

    // Label — raised above meeples so captains don't occlude the text
    this.label = this.createLabel(ACTION_ICONS[action]);
    this.label.position.y = 0.38;
    this.mesh.add(this.label);

    // Meeple container
    this.meeples = new THREE.Group();
    this.meeples.position.y = 0.1;
    this.mesh.add(this.meeples);
  }

  /** Update meeples shown on this action space */
  setMeeples(players: { color: PlayerColor; playerId: string }[]) {
    // Clear existing
    while (this.meeples.children.length > 0) {
      this.meeples.remove(this.meeples.children[0]);
    }

    // Place new meeples in a circle on the platform
    players.forEach((p, i) => {
      const meeple = createMeeple(PLAYER_COLORS[p.color] ?? 0xffffff);
      const angle = (i / Math.max(players.length, 1)) * Math.PI * 2 + Math.PI / 4;
      const dist = players.length === 1 ? 0 : 0.2;
      meeple.position.set(
        Math.cos(angle) * dist,
        0,
        Math.sin(angle) * dist
      );
      this.meeples.add(meeple);
    });
  }

  setHighlight(on: boolean) {
    const mat = this.platform.material as THREE.MeshStandardMaterial;
    mat.emissive.setHex(on ? 0x1a1508 : 0x000000);
  }

  setHover(on: boolean) {
    const ringMat = this.ring.material as THREE.MeshStandardMaterial;
    ringMat.emissive.setHex(on ? 0x332a10 : 0x000000);
    ringMat.color.setHex(on ? 0xb8963e : 0x5c3a1e);
    this.ring.scale.setScalar(on ? 1.05 : 1);
  }

  private createLabel(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 40;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'bold 22px serif';
    ctx.fillStyle = '#f4e8c1';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 20);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.8, 0.25, 1);
    return sprite;
  }
}

// Shared meeple geometries (same pattern as ShipMesh)
const meepleBodyGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.15, 8);
const meepleHeadGeo = new THREE.SphereGeometry(0.045, 8, 6);

// Cached meeple materials by color (same pattern as ShipMesh's materialCache)
const meepleMaterialCache = new Map<number, THREE.MeshStandardMaterial>();

function getMeepleMat(color: number): THREE.MeshStandardMaterial {
  let mat = meepleMaterialCache.get(color);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 });
    meepleMaterialCache.set(color, mat);
  }
  return mat;
}

/** Create a captain meeple mesh */
function createMeeple(color: number): THREE.Group {
  const group = new THREE.Group();
  const mat = getMeepleMat(color);

  // Body - cylinder
  const body = new THREE.Mesh(meepleBodyGeo, mat);
  body.position.y = 0.075;
  body.castShadow = true;
  group.add(body);

  // Head - sphere
  const head = new THREE.Mesh(meepleHeadGeo, mat);
  head.position.y = 0.18;
  head.castShadow = true;
  group.add(head);

  return group;
}

/** Manages all 5 action spaces */
export class ActionSpaces {
  readonly group: THREE.Group;
  private spaces: Map<ActionType, ActionSpace> = new Map();

  constructor() {
    this.group = new THREE.Group();

    // Position action spaces around the board perimeter (matching physical board)
    // [x, z, rotationY] - rotation follows the adjacent board edge
    const layout: Record<ActionType, [number, number, number]> = {
      [ActionType.SAIL]:  [-4.2, -2.5, 0],                     // upper-left
      [ActionType.STEAL]: [ 3.2, -3.2, 0],                     // upper-right, along diagonal
      [ActionType.CHART]: [ 4.3, -2.2, 0],                     // upper-right, next to steal
      [ActionType.BUILD]: [ 4.2,  2.5, 0],                     // lower-right
      [ActionType.SINK]:  [-4.2,  2.5, 0],                     // lower-left
    };

    ACTION_ORDER.forEach((action) => {
      const [x, z, rotY] = layout[action];
      const space = new ActionSpace(action, x, z);
      if (rotY) space.mesh.rotation.y = rotY;
      this.spaces.set(action, space);
      this.group.add(space.mesh);
    });
  }

  /** Get all platform meshes for raycasting */
  getPlatformMeshes(): THREE.Mesh[] {
    return Array.from(this.spaces.values()).map(s => s.platform);
  }

  /** Sync captain placements from game state */
  syncPlacements(players: PlayerState[]) {
    // Build map: action -> list of players who placed a captain there
    const placements = new Map<ActionType, { color: PlayerColor; playerId: string }[]>();
    for (const action of ACTION_ORDER) {
      placements.set(action, []);
    }

    for (const player of players) {
      for (const action of player.placedCaptains) {
        placements.get(action)?.push({ color: player.color, playerId: player.id });
      }
    }

    for (const [action, space] of this.spaces) {
      space.setMeeples(placements.get(action) ?? []);
    }
  }

  /** Highlight all spaces (during place phase) */
  setAllHighlights(on: boolean) {
    for (const space of this.spaces.values()) {
      space.setHighlight(on);
    }
  }

  /** Highlight a specific space */
  setHighlight(action: ActionType, on: boolean) {
    this.spaces.get(action)?.setHighlight(on);
  }

  private lastHoveredAction: ActionType | null = null;

  /** Update hover state - call from mousemove */
  updateHover(action: ActionType | null) {
    if (action === this.lastHoveredAction) return;
    if (this.lastHoveredAction) {
      this.spaces.get(this.lastHoveredAction)?.setHover(false);
    }
    if (action) {
      this.spaces.get(action)?.setHover(true);
    }
    this.lastHoveredAction = action;
  }

  /** Get action from a mesh hit */
  getActionFromMesh(mesh: THREE.Object3D): ActionType | null {
    if (mesh.userData?.type === 'actionSpace') {
      return mesh.userData.action as ActionType;
    }
    return null;
  }
}
