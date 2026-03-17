import * as THREE from 'three';
import { BOARD_HEXES } from '../../config/HexConstants';
import { hexToKey } from '../../types/CoordinateTypes';
import { HexTile, HexHighlight } from './HexTile';

export class HexGrid {
  readonly group: THREE.Group;
  private tiles: Map<string, HexTile> = new Map();

  constructor() {
    this.group = new THREE.Group();
    for (const coord of BOARD_HEXES) {
      const tile = new HexTile(coord);
      this.tiles.set(hexToKey(coord), tile);
      this.group.add(tile.mesh);
      this.group.add(tile.getRing());
      this.group.add(tile.getHoverRing());
    }
  }

  getTile(key: string): HexTile | undefined {
    return this.tiles.get(key);
  }

  getAllTiles(): HexTile[] {
    return Array.from(this.tiles.values());
  }

  setHighlight(key: string, highlight: HexHighlight) {
    this.tiles.get(key)?.setHighlight(highlight);
  }

  clearAllHighlights() {
    for (const tile of this.tiles.values()) {
      tile.setHighlight('none');
    }
  }

  /** Get all hex meshes for raycasting */
  getMeshes(): THREE.Mesh[] {
    return Array.from(this.tiles.values()).map(t => t.mesh);
  }
}
