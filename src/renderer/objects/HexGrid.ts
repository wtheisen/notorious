import * as THREE from 'three';
import { BOARD_HEXES } from '../../config/HexConstants';
import { hexToKey } from '../../types/CoordinateTypes';
import { HexTile, HexHighlight } from './HexTile';
import { WrapGlow } from './WrapGlow';

export class HexGrid {
  readonly group: THREE.Group;
  private tiles: Map<string, HexTile> = new Map();
  private wrapGlow: WrapGlow;

  constructor() {
    this.group = new THREE.Group();
    for (const coord of BOARD_HEXES) {
      const tile = new HexTile(coord);
      this.tiles.set(hexToKey(coord), tile);
      this.group.add(tile.mesh);
      this.group.add(tile.getRing());
      this.group.add(tile.getHoverRing());
    }

    this.wrapGlow = new WrapGlow();
    this.group.add(this.wrapGlow.group);
  }

  getWrapGlow(): WrapGlow {
    return this.wrapGlow;
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
      tile.setHoverBorder(false);
    }
  }

  /** Get all hex meshes for raycasting */
  getMeshes(): THREE.Mesh[] {
    return Array.from(this.tiles.values()).map(t => t.mesh);
  }
}
