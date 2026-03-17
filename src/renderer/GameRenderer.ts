import * as THREE from 'three';
import { SceneManager } from './SceneManager';
import { RaycasterManager } from './RaycasterManager';
import { ShipMesh } from './objects/ShipMesh';
import { IslandMesh } from './objects/IslandMesh';
import { hexToWorld } from './helpers/HexGeometry';
import { NotoriousState } from '../game/types/GameState';
import { HexCoord, hexToKey } from '../types/CoordinateTypes';
import { PlayerColor, ShipType, GAME_CONSTANTS } from '../types/GameTypes';
import { HexHighlight } from './objects/HexTile';
import { ActionType } from '../types/GameTypes';

interface PendingMove {
  fromKey: string;
  toKey: string;
}

export class GameRenderer {
  private scene: SceneManager;
  readonly raycaster: RaycasterManager;

  private shipMeshes: Map<string, ShipMesh[]> = new Map();
  private islandMeshes: IslandMesh[] = [];
  private shipGroup = new THREE.Group();
  private dragLocked = false;
  private pendingMoves: PendingMove[] = [];

  constructor(scene: SceneManager) {
    this.scene = scene;
    scene.scene.add(this.shipGroup);

    this.raycaster = new RaycasterManager(
      scene.cameraController.camera,
      scene.hexGrid,
      scene.scene,
      scene.renderer.domElement
    );
    this.raycaster.setActionSpaces(scene.actionSpaces);
  }

  setOnHexClick(cb: (coord: HexCoord) => void) {
    this.raycaster.setOnHexClick(cb);
  }

  setOnHexHover(cb: (coord: HexCoord | null) => void) {
    this.raycaster.setOnHexHover(cb);
  }

  setOnDragStart(cb: (coord: HexCoord) => void) {
    this.raycaster.setOnDragStart(cb);
  }

  setOnDragMove(cb: (from: HexCoord, to: HexCoord | null, worldPos: THREE.Vector3) => void) {
    this.raycaster.setOnDragMove(cb);
  }

  setOnDragEnd(cb: (from: HexCoord, to: HexCoord | null) => void) {
    this.raycaster.setOnDragEnd(cb);
  }

  setCanDrag(cb: (coord: HexCoord) => boolean) {
    this.raycaster.setCanDrag(cb);
  }

  setOnActionSpaceClick(cb: (action: ActionType) => void) {
    this.raycaster.setOnActionSpaceClick(cb);
  }

  syncState(G: NotoriousState) {
    this.syncIslands(G);
    if (!this.dragLocked) {
      this.syncShips(G);
    }
    this.syncControl(G);
    this.scene.actionSpaces.syncPlacements(G.players);
  }

  /** Lock ship sync during drag so the dragged mesh isn't destroyed */
  setDragLock(locked: boolean) {
    this.dragLocked = locked;
  }

  /** Rekey a ship mesh from its old hex to its new hex and position it there */
  applyPendingMove(shipMesh: ShipMesh, fromKey: string, toCoord: HexCoord) {
    const toKey = hexToKey(toCoord);

    // Remove from old key
    const fromShips = this.shipMeshes.get(fromKey);
    if (fromShips) {
      const idx = fromShips.indexOf(shipMesh);
      if (idx !== -1) fromShips.splice(idx, 1);
      if (fromShips.length === 0) this.shipMeshes.delete(fromKey);
    }

    // Add to new key
    const toShips = this.shipMeshes.get(toKey) ?? [];
    toShips.push(shipMesh);
    this.shipMeshes.set(toKey, toShips);

    // Position at destination
    const worldPos = hexToWorld(toCoord);
    const count = toShips.length;
    const idx = toShips.indexOf(shipMesh);
    const offsetAngle = count > 1 ? (idx / count) * Math.PI * 2 : 0;
    const offsetDist = count > 1 ? 0.25 : 0;
    shipMesh.setPosition(
      worldPos.x + Math.cos(offsetAngle) * offsetDist,
      0.01,
      worldPos.z + Math.sin(offsetAngle) * offsetDist
    );

    this.pendingMoves.push({ fromKey, toKey });
    this.dragLocked = true;
  }

  /** Clear all pending moves and unlock — next syncState will rebuild from G */
  clearPendingMoves() {
    this.pendingMoves = [];
    this.dragLocked = false;
  }

  private syncIslands(G: NotoriousState) {
    if (this.islandMeshes.length > 0) return;
    for (const [key, hexState] of Object.entries(G.board.hexes)) {
      if (hexState.island) {
        const islandMesh = new IslandMesh(hexState.island);
        this.islandMeshes.push(islandMesh);
        this.scene.scene.add(islandMesh.mesh);
      }
    }
  }

  private syncShips(G: NotoriousState) {
    for (const ships of this.shipMeshes.values()) {
      for (const ship of ships) {
        this.shipGroup.remove(ship.mesh);
      }
    }
    this.shipMeshes.clear();

    for (const [key, hexState] of Object.entries(G.board.hexes)) {
      if (hexState.ships.length === 0) continue;

      const shipMeshes: ShipMesh[] = [];
      const worldPos = hexToWorld(hexState.coord);

      hexState.ships.forEach((ship, index) => {
        const player = G.players.find(p => p.id === ship.playerId);
        const color = player?.color ?? PlayerColor.BLUE;
        const shipMesh = new ShipMesh(ship.type, color);

        const offsetAngle = (index / hexState.ships.length) * Math.PI * 2;
        const offsetDist = hexState.ships.length > 1 ? 0.25 : 0;
        shipMesh.setPosition(
          worldPos.x + Math.cos(offsetAngle) * offsetDist,
          0.01,
          worldPos.z + Math.sin(offsetAngle) * offsetDist
        );

        this.shipGroup.add(shipMesh.mesh);
        shipMeshes.push(shipMesh);
      });

      this.shipMeshes.set(key, shipMeshes);
    }
  }

  private static PLAYER_HEX_COLORS: Record<string, number> = {
    [PlayerColor.BLUE]: 0x3388dd,
    [PlayerColor.RED]: 0xdd3333,
    [PlayerColor.GREEN]: 0x33bb33,
    [PlayerColor.YELLOW]: 0xddcc33,
  };

  private syncControl(G: NotoriousState) {
    for (const [key, hexState] of Object.entries(G.board.hexes)) {
      const tile = this.scene.hexGrid.getTile(key);
      if (!tile) continue;

      // Find controller: player with most influence
      const influences = new Map<string, number>();
      for (const ship of hexState.ships) {
        const cur = influences.get(ship.playerId) || 0;
        influences.set(ship.playerId, cur + GAME_CONSTANTS.INFLUENCE_VALUES[ship.type]);
      }

      let maxInf = 0;
      let controller: string | null = null;
      let tie = false;
      for (const [pid, inf] of influences) {
        if (inf > maxInf) { maxInf = inf; controller = pid; tie = false; }
        else if (inf === maxInf && inf > 0) { tie = true; }
      }

      if (tie || !controller || maxInf === 0) {
        tile.setControl(null);
      } else {
        const player = G.players.find(p => p.id === controller);
        const color = player ? (GameRenderer.PLAYER_HEX_COLORS[player.color] ?? 0xffffff) : null;
        tile.setControl(color);
      }
    }
  }

  setHighlights(hexKeys: string[], highlight: HexHighlight) {
    for (const key of hexKeys) {
      this.scene.hexGrid.setHighlight(key, highlight);
    }
  }

  clearHighlights() {
    this.scene.hexGrid.clearAllHighlights();
  }

  /** Highlight ships on a hex (for hover feedback) */
  highlightShipsAt(hexKey: string, on: boolean) {
    const ships = this.shipMeshes.get(hexKey);
    if (ships) {
      for (const ship of ships) {
        if (ship.shipType !== ShipType.PORT) {
          ship.setHighlight(on);
        }
      }
    }
  }

  /** Clear all ship highlights */
  clearShipHighlights() {
    for (const ships of this.shipMeshes.values()) {
      for (const ship of ships) {
        ship.setHighlight(false);
      }
    }
  }

  /** Get the first movable ship mesh at a hex (for dragging) */
  getMovableShipAt(hexKey: string): ShipMesh | null {
    const ships = this.shipMeshes.get(hexKey);
    if (!ships) return null;
    return ships.find(s => s.shipType === ShipType.SLOOP)
      ?? ships.find(s => s.shipType === ShipType.GALLEON)
      ?? null;
  }

  /** Move a ship mesh to a world position (for drag feedback) */
  moveShipTo(ship: ShipMesh, x: number, z: number) {
    ship.mesh.position.set(x, 0.2, z); // lift slightly during drag
  }

  /** Snap a ship mesh back to its hex position */
  snapShipToHex(ship: ShipMesh, hexKey: string, G: NotoriousState) {
    const hexState = G.board.hexes[hexKey];
    if (!hexState) return;
    const worldPos = hexToWorld(hexState.coord);
    const idx = this.shipMeshes.get(hexKey)?.indexOf(ship) ?? 0;
    const count = hexState.ships.length;
    const offsetAngle = count > 1 ? (idx / count) * Math.PI * 2 : 0;
    const offsetDist = count > 1 ? 0.25 : 0;
    ship.setPosition(
      worldPos.x + Math.cos(offsetAngle) * offsetDist,
      0.01,
      worldPos.z + Math.sin(offsetAngle) * offsetDist
    );
  }

  highlightActionSpaces(on: boolean) {
    this.scene.actionSpaces.setAllHighlights(on);
  }

  setOrbitEnabled(enabled: boolean) {
    this.scene.cameraController.controls.enabled = enabled;
  }

  dispose() {
    this.raycaster.dispose();
  }
}
