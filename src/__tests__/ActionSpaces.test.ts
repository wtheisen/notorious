import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { PlayerColor, ActionType } from '../types/GameTypes';
import { PlayerState } from '../game/types/GameState';

// ActionSpaces.createLabel uses document.createElement('canvas') for sprite labels.
// Stub a minimal canvas before importing the module.
beforeAll(() => {
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      font: '',
      fillStyle: '',
      textAlign: '',
      textBaseline: '',
      fillText: () => {},
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  if (typeof globalThis.document === 'undefined') {
    (globalThis as any).document = { createElement: () => fakeCanvas };
  }
});

// Dynamic import so the stub is in place before the module initializes
let ActionSpaces: typeof import('../renderer/objects/ActionSpaces').ActionSpaces;
beforeAll(async () => {
  const mod = await import('../renderer/objects/ActionSpaces');
  ActionSpaces = mod.ActionSpaces;
});

function stubPlayer(id: string, color: PlayerColor, placedCaptains: ActionType[]): PlayerState {
  return {
    id,
    color,
    placedCaptains,
    notoriety: 0,
    doubloons: 3,
    ships: {},
    captains: 3,
    charts: [],
    piratePower: null,
  } as unknown as PlayerState;
}

/** Collect meshes from meeple groups (children of the meeple container within each action space) */
function collectMeepleMeshes(group: THREE.Group): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry instanceof THREE.SphereGeometry) {
      meshes.push(child);
    }
    if (child instanceof THREE.Mesh && child.geometry instanceof THREE.CylinderGeometry) {
      const params = (child.geometry as THREE.CylinderGeometry).parameters;
      // Meeple body: radialSegments=8, height=0.15 (platform is radialSegments=6, height=0.1)
      if (params.radialSegments === 8 && params.height === 0.15) {
        meshes.push(child);
      }
    }
  });
  return meshes;
}

describe('ActionSpaces', () => {
  it('creates a group with 5 action space sub-groups', () => {
    const spaces = new ActionSpaces();
    expect(spaces.group).toBeInstanceOf(THREE.Group);
    expect(spaces.group.children.length).toBe(5);
  });

  it('getPlatformMeshes returns 5 meshes with actionSpace userData', () => {
    const spaces = new ActionSpaces();
    const platforms = spaces.getPlatformMeshes();
    expect(platforms.length).toBe(5);
    for (const p of platforms) {
      expect(p.userData.type).toBe('actionSpace');
    }
  });

  describe('meeple geometry and material sharing', () => {
    it('meeples across different syncPlacements calls share the same geometry instances', () => {
      const spaces = new ActionSpaces();

      spaces.syncPlacements([
        stubPlayer('0', PlayerColor.BLUE, [ActionType.SAIL]),
        stubPlayer('1', PlayerColor.RED, [ActionType.BUILD]),
      ]);
      const meshes1 = collectMeepleMeshes(spaces.group);

      // Sync again with different placements
      spaces.syncPlacements([
        stubPlayer('0', PlayerColor.BLUE, [ActionType.STEAL]),
        stubPlayer('1', PlayerColor.RED, [ActionType.CHART]),
      ]);
      const meshes2 = collectMeepleMeshes(spaces.group);

      // All sphere geometries should be the exact same object
      const spheres = [...meshes1, ...meshes2]
        .filter((m) => m.geometry instanceof THREE.SphereGeometry)
        .map((m) => m.geometry);
      expect(spheres.length).toBeGreaterThanOrEqual(2);
      for (const s of spheres) {
        expect(s).toBe(spheres[0]);
      }

      // All meeple cylinder geometries should be the exact same object
      const cylinders = [...meshes1, ...meshes2]
        .filter((m) => m.geometry instanceof THREE.CylinderGeometry)
        .map((m) => m.geometry);
      expect(cylinders.length).toBeGreaterThanOrEqual(2);
      for (const c of cylinders) {
        expect(c).toBe(cylinders[0]);
      }
    });

    it('meeples of the same color share the same material instance', () => {
      const spaces = new ActionSpaces();
      spaces.syncPlacements([
        stubPlayer('0', PlayerColor.BLUE, [ActionType.SAIL, ActionType.BUILD]),
      ]);

      const mats = collectMeepleMeshes(spaces.group).map((m) => m.material);
      // 2 meeples × 2 meshes each = 4 mesh materials, all same reference
      expect(mats.length).toBe(4);
      for (const m of mats) {
        expect(m).toBe(mats[0]);
      }
    });

    it('meeples of different colors use different material instances', () => {
      const spaces = new ActionSpaces();
      spaces.syncPlacements([
        stubPlayer('0', PlayerColor.BLUE, [ActionType.SAIL]),
        stubPlayer('1', PlayerColor.RED, [ActionType.SAIL]),
      ]);

      const mats = collectMeepleMeshes(spaces.group).map((m) => m.material);
      // 2 players × 1 meeple × 2 meshes = 4
      expect(mats.length).toBe(4);

      const unique = new Set(mats);
      expect(unique.size).toBe(2);
    });
  });

  describe('syncPlacements', () => {
    it('clears meeples when no captains are placed', () => {
      const spaces = new ActionSpaces();
      spaces.syncPlacements([
        stubPlayer('0', PlayerColor.BLUE, [ActionType.SAIL]),
      ]);
      expect(collectMeepleMeshes(spaces.group).length).toBeGreaterThan(0);

      spaces.syncPlacements([
        stubPlayer('0', PlayerColor.BLUE, []),
      ]);
      expect(collectMeepleMeshes(spaces.group).length).toBe(0);
    });
  });
});
