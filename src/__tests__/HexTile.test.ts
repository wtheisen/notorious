import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { HexTile } from '../renderer/objects/HexTile';

describe('HexTile', () => {
  it('creates mesh at correct position with hex userData', () => {
    const tile = new HexTile({ q: 1, r: -1, s: 0 });
    expect(tile.mesh).toBeInstanceOf(THREE.Mesh);
    expect(tile.mesh.userData.type).toBe('hex');
    expect(tile.mesh.userData.coord).toEqual({ q: 1, r: -1, s: 0 });
  });

  describe('shared materials', () => {
    it('hover rings share the same material instance across tiles', () => {
      const tileA = new HexTile({ q: 0, r: 0, s: 0 });
      const tileB = new HexTile({ q: 1, r: 0, s: -1 });
      expect(tileA.getHoverRing().material).toBe(tileB.getHoverRing().material);
    });

    it('control rings start with the same default material', () => {
      const tileA = new HexTile({ q: 0, r: 0, s: 0 });
      const tileB = new HexTile({ q: 1, r: 0, s: -1 });
      expect(tileA.getRing().material).toBe(tileB.getRing().material);
    });

    it('setControl with same color reuses cached material across tiles', () => {
      const tileA = new HexTile({ q: 0, r: 0, s: 0 });
      const tileB = new HexTile({ q: 1, r: 0, s: -1 });
      tileA.setControl(0xff0000);
      tileB.setControl(0xff0000);
      expect(tileA.getRing().material).toBe(tileB.getRing().material);
    });

    it('setControl with different colors uses different materials', () => {
      const tileA = new HexTile({ q: 0, r: 0, s: 0 });
      const tileB = new HexTile({ q: 1, r: 0, s: -1 });
      tileA.setControl(0xff0000);
      tileB.setControl(0x0000ff);
      expect(tileA.getRing().material).not.toBe(tileB.getRing().material);
    });

    it('setting control on one tile does not affect another tile with different color', () => {
      const tileA = new HexTile({ q: 0, r: 0, s: 0 });
      const tileB = new HexTile({ q: 1, r: 0, s: -1 });
      tileA.setControl(0xff0000);
      tileB.setControl(0x0000ff);
      const matA = tileA.getRing().material as THREE.MeshStandardMaterial;
      const matB = tileB.getRing().material as THREE.MeshStandardMaterial;
      expect(matA.color.getHex()).toBe(0xff0000);
      expect(matB.color.getHex()).toBe(0x0000ff);
    });
  });

  describe('setControl', () => {
    it('shows ring when color is set, hides when null', () => {
      const tile = new HexTile({ q: 0, r: 0, s: 0 });
      expect(tile.getRing().visible).toBe(false);
      tile.setControl(0xff0000);
      expect(tile.getRing().visible).toBe(true);
      tile.setControl(null);
      expect(tile.getRing().visible).toBe(false);
    });

    it('skips update when color unchanged', () => {
      const tile = new HexTile({ q: 0, r: 0, s: 0 });
      tile.setControl(0xff0000);
      const matBefore = tile.getRing().material;
      tile.setControl(0xff0000); // same color again
      expect(tile.getRing().material).toBe(matBefore);
    });
  });

  describe('setHoverBorder', () => {
    it('toggles hover ring visibility', () => {
      const tile = new HexTile({ q: 0, r: 0, s: 0 });
      expect(tile.getHoverRing().visible).toBe(false);
      tile.setHoverBorder(true);
      expect(tile.getHoverRing().visible).toBe(true);
      tile.setHoverBorder(false);
      expect(tile.getHoverRing().visible).toBe(false);
    });

    it('toggling hover on one tile does not affect another', () => {
      const tileA = new HexTile({ q: 0, r: 0, s: 0 });
      const tileB = new HexTile({ q: 1, r: 0, s: -1 });
      tileA.setHoverBorder(true);
      expect(tileB.getHoverRing().visible).toBe(false);
    });
  });

  describe('setHighlight', () => {
    it('changes mesh material color', () => {
      const tile = new HexTile({ q: 0, r: 0, s: 0 });
      tile.setHighlight('selected');
      const mat = tile.mesh.material as THREE.MeshStandardMaterial;
      expect(mat.color.getHex()).toBe(0xd4a843);
    });

    it('uses island color when highlight is none and tile has island', () => {
      const tile = new HexTile({ q: 0, r: 0, s: 0 });
      tile.setIsland(true);
      tile.setHighlight('none');
      const mat = tile.mesh.material as THREE.MeshStandardMaterial;
      expect(mat.color.getHex()).toBe(0x8b7355);
    });
  });
});
