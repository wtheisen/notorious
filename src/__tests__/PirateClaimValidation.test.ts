/**
 * Tests for per-chart claim validation logic used by canClaimChart in GameScreen.tsx.
 *
 * canClaimChart mirrors the conditions in NotoriousGame.ts claimChart move:
 *   - TREASURE_MAP: galleon on targetHex AND player controls that hex
 *   - SMUGGLER_ROUTE: path exists between islands AND player has ships on every path hex
 *
 * These tests verify those conditions directly using the underlying BoardLogic functions,
 * which is what canClaimChart composes.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createHexCoord } from '../types/CoordinateTypes';
import { ShipType } from '../types/GameTypes';
import { EdgeDirection } from '../types/CoordinateTypes';
import { createIsland } from '../core/Island';
import { BoardState } from '../game/types/GameState';
import {
  createEmptyBoard,
  placeShip,
  placeIsland,
  getPlayerShips,
  getHexController,
  findPathOnBoard,
  getIslandByName,
} from '../game/logic/BoardLogic';
import { ChartFactory } from '../core/Chart';

let board: BoardState;

beforeEach(() => {
  board = createEmptyBoard();
  ChartFactory.resetIdCounter();
});

// ── Treasure Map claim conditions ──

describe('Treasure Map claim conditions', () => {
  const targetHex = createHexCoord(1, 0);
  const otherHex = createHexCoord(0, 0);

  it('satisfies claim when player has galleon on targetHex and controls it', () => {
    placeShip(board, targetHex, { type: ShipType.GALLEON, playerId: '0' });

    const ships = getPlayerShips(board, targetHex, '0');
    const hasGalleon = ships.some(s => s.type === ShipType.GALLEON);
    const controller = getHexController(board, targetHex);

    expect(hasGalleon).toBe(true);
    expect(controller).toBe('0');
  });

  it('fails when player has galleon on a DIFFERENT hex (original bug scenario)', () => {
    // Galleon elsewhere — the old hasGalleonOnBoard check would pass this incorrectly
    placeShip(board, otherHex, { type: ShipType.GALLEON, playerId: '0' });

    const ships = getPlayerShips(board, targetHex, '0');
    const hasGalleon = ships.some(s => s.type === ShipType.GALLEON);

    expect(hasGalleon).toBe(false);
  });

  it('fails when player has only a sloop on targetHex', () => {
    placeShip(board, targetHex, { type: ShipType.SLOOP, playerId: '0' });

    const ships = getPlayerShips(board, targetHex, '0');
    const hasGalleon = ships.some(s => s.type === ShipType.GALLEON);

    expect(hasGalleon).toBe(false);
  });

  it('fails when player has galleon on targetHex but does not control it', () => {
    // Opponent has higher influence (port = 3 influence vs galleon = 2)
    placeShip(board, targetHex, { type: ShipType.GALLEON, playerId: '0' });
    placeShip(board, targetHex, { type: ShipType.PORT, playerId: '1' });

    const ships = getPlayerShips(board, targetHex, '0');
    const hasGalleon = ships.some(s => s.type === ShipType.GALLEON);
    const controller = getHexController(board, targetHex);

    expect(hasGalleon).toBe(true);
    expect(controller).not.toBe('0');
  });

  it('fails when targetHex is empty', () => {
    const ships = getPlayerShips(board, targetHex, '0');
    expect(ships).toHaveLength(0);
    expect(getHexController(board, targetHex)).toBeNull();
  });
});

// ── Smuggler Route claim conditions ──

describe('Smuggler Route claim conditions', () => {
  const islandACoord = createHexCoord(0, 0);
  const islandBCoord = createHexCoord(2, 0);

  function setupIslands() {
    const islandA = createIsland('Nassau', islandACoord, [], '🏝');
    const islandB = createIsland('Tortuga', islandBCoord, [], '🏝');
    placeIsland(board, islandA);
    placeIsland(board, islandB);
  }

  it('satisfies claim when player has ships on every hex of the path', () => {
    setupIslands();
    const path = findPathOnBoard(board, islandACoord, islandBCoord);
    expect(path.length).toBeGreaterThan(0);

    // Place a sloop on every path hex
    for (const coord of path) {
      placeShip(board, coord, { type: ShipType.SLOOP, playerId: '0' });
    }

    const coveredAll = path.every(coord => getPlayerShips(board, coord, '0').length > 0);
    expect(coveredAll).toBe(true);
  });

  it('fails when player is missing a ship on one path hex', () => {
    setupIslands();
    const path = findPathOnBoard(board, islandACoord, islandBCoord);
    expect(path.length).toBeGreaterThan(1);

    // Cover all but the last hex
    for (let i = 0; i < path.length - 1; i++) {
      placeShip(board, path[i], { type: ShipType.SLOOP, playerId: '0' });
    }

    const coveredAll = path.every(coord => getPlayerShips(board, coord, '0').length > 0);
    expect(coveredAll).toBe(false);
  });

  it('fails when player has no ships on the path at all', () => {
    setupIslands();
    const path = findPathOnBoard(board, islandACoord, islandBCoord);

    const coveredAll = path.every(coord => getPlayerShips(board, coord, '0').length > 0);
    expect(coveredAll).toBe(false);
  });

  it('getIslandByName resolves islands placed on the board', () => {
    setupIslands();
    expect(getIslandByName(board, 'Nassau')).not.toBeNull();
    expect(getIslandByName(board, 'Tortuga')).not.toBeNull();
  });

  it('getIslandByName returns null for islands not on the board', () => {
    // Islands not placed
    expect(getIslandByName(board, 'Nassau')).toBeNull();
  });

  it('any ship type (not just galleon) satisfies path coverage', () => {
    setupIslands();
    const path = findPathOnBoard(board, islandACoord, islandBCoord);

    for (const coord of path) {
      placeShip(board, coord, { type: ShipType.SLOOP, playerId: '0' });
    }

    const coveredAll = path.every(coord => getPlayerShips(board, coord, '0').length > 0);
    expect(coveredAll).toBe(true);
  });
});

// ── ChartFactory creates correct chart types ──

describe('Chart types used in claim validation', () => {
  it('TreasureMapChart has targetHex', () => {
    const chart = ChartFactory.createTreasureMap(createHexCoord(1, -1));
    expect(chart.targetHex).toEqual(createHexCoord(1, -1));
  });

  it('SmugglerRouteChart has islandA and islandB', () => {
    const chart = ChartFactory.createSmugglerRoute('Nassau', 'Tortuga');
    expect(chart.islandA).toBe('Nassau');
    expect(chart.islandB).toBe('Tortuga');
  });
});
