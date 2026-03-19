import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ShipMesh } from '../renderer/objects/ShipMesh';
import { PlayerColor, ShipType } from '../types/GameTypes';

describe('ShipMesh', () => {
  it('creates a mesh group with children', () => {
    const ship = new ShipMesh(ShipType.SLOOP, PlayerColor.BLUE);
    expect(ship.mesh).toBeInstanceOf(THREE.Group);
    expect(ship.mesh.children.length).toBeGreaterThan(0);
  });

  it('stores shipType and sets userData', () => {
    const ship = new ShipMesh(ShipType.GALLEON, PlayerColor.RED);
    expect(ship.shipType).toBe(ShipType.GALLEON);
    expect(ship.mesh.userData.type).toBe('ship');
    expect(ship.mesh.userData.shipType).toBe(ShipType.GALLEON);
    expect(ship.mesh.userData.playerColor).toBe(PlayerColor.RED);
  });

  it('setPosition updates mesh position', () => {
    const ship = new ShipMesh(ShipType.SLOOP, PlayerColor.BLUE);
    ship.setPosition(1, 2, 3);
    expect(ship.mesh.position.x).toBe(1);
    expect(ship.mesh.position.y).toBe(2);
    expect(ship.mesh.position.z).toBe(3);
  });

  describe('setHighlight does not mutate shared materials', () => {
    it('highlighting one ship does not affect another of the same color', () => {
      const shipA = new ShipMesh(ShipType.SLOOP, PlayerColor.BLUE);
      const shipB = new ShipMesh(ShipType.SLOOP, PlayerColor.BLUE);

      // Get the material on shipB before highlighting shipA
      const meshB = shipB.mesh.children[0] as THREE.Mesh;
      const matBefore = meshB.material as THREE.MeshStandardMaterial;
      expect(matBefore.emissive.getHex()).toBe(0x000000);

      // Highlight shipA
      shipA.setHighlight(true);

      // shipB's material should still have zero emissive
      const matAfter = meshB.material as THREE.MeshStandardMaterial;
      expect(matAfter.emissive.getHex()).toBe(0x000000);
    });

    it('highlighted ship has non-zero emissive, unhighlighted ship has zero', () => {
      const ship = new ShipMesh(ShipType.GALLEON, PlayerColor.GREEN);
      const body = ship.mesh.children[0] as THREE.Mesh;

      ship.setHighlight(true);
      expect((body.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0x444444);

      ship.setHighlight(false);
      expect((body.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0x000000);
    });

    it('works correctly for ports with multiple sub-meshes', () => {
      const portA = new ShipMesh(ShipType.PORT, PlayerColor.YELLOW);
      const portB = new ShipMesh(ShipType.PORT, PlayerColor.YELLOW);

      portA.setHighlight(true);

      // All children of portB should still have zero emissive
      portB.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          expect(mat.emissive.getHex()).toBe(0x000000);
        }
      });
    });
  });

  it('setHighlight scales mesh', () => {
    const ship = new ShipMesh(ShipType.SLOOP, PlayerColor.RED);
    ship.setHighlight(true);
    expect(ship.mesh.scale.x).toBe(1.25);

    ship.setHighlight(false);
    expect(ship.mesh.scale.x).toBe(1);
  });

  it('galleon has body and mast children', () => {
    const ship = new ShipMesh(ShipType.GALLEON, PlayerColor.BLUE);
    expect(ship.mesh.children.length).toBe(2);
  });

  it('port has body, flag, and pole children', () => {
    const ship = new ShipMesh(ShipType.PORT, PlayerColor.RED);
    expect(ship.mesh.children.length).toBe(3);
  });
});
