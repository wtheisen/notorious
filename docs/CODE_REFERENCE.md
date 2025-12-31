# Notorious - Quick Code Reference

## Essential Imports

```typescript
// Types
import { ActionType, ShipType, PiratePower } from './types/GameTypes';
import { HexCoord, hexEquals } from './types/CoordinateTypes';
import { NotoriousState, PlayerState, BoardState, Ship, hexToKey, keyToHex } from './game/types/GameState';

// Board operations
import {
  getHex,
  getAllHexes,
  getPlayerShips,
  getInfluence,
  getHexController,
  placeShip,
  removeShip,
  moveShip,
  canSailBetween,
  getNeighbors,
  findPathOnBoard
} from './game/logic/BoardLogic';

// Player operations
import {
  gainNotoriety,
  gainDoubloons,
  spendDoubloons,
  hasShips,
  spendShips,
  returnShips
} from './game/logic/PlayerLogic';

// Hex math
import { hexDistance, areAdjacent, findPath } from './utils/HexMath';
import { getValidNeighbors, isOnBoard, BOARD_HEXES } from './config/HexConstants';

// Powers
import { getPowerStrategy } from './core/powers';
```

---

## Common Operations

### Get Ships at Hex
```typescript
const allShips = G.board.hexes[hexToKey(coord)]?.ships || [];
const playerShips = getPlayerShips(G.board, coord, playerId);
const opponentShips = allShips.filter(s => s.playerId !== playerId);
```

### Check Hex Control
```typescript
const controller = getHexController(G.board, coord);  // Returns playerId or null
const influence = getInfluence(G.board, coord, playerId);
```

### Place/Remove Ships
```typescript
placeShip(G.board, coord, { type: ShipType.SLOOP, playerId });
removeShip(G.board, coord, ShipType.SLOOP, playerId);
moveShip(G.board, fromCoord, toCoord, ShipType.GALLEON, playerId);
```

### Player Resources
```typescript
gainDoubloons(player, 3);
spendDoubloons(player, 2);  // Returns false if insufficient
gainNotoriety(player, 1);

// Ships inventory
hasShips(player, ShipType.SLOOP, 2);  // Check if has 2+ sloops
spendShips(player, ShipType.GALLEON, 1);  // Remove from inventory
returnShips(player, ShipType.SLOOP, 1);  // Add to inventory
```

### Hex Iteration
```typescript
// All hexes
const allHexes = Object.values(G.board.hexes);

// Find hexes matching condition
const hexesWithPlayerShips = allHexes.filter(hex =>
  hex.ships.some(s => s.playerId === playerId)
);

// Neighboring hexes
const neighbors = getNeighbors(G.board, coord);
const validNeighborCoords = getValidNeighbors(coord);
```

### Distance and Pathing
```typescript
const dist = hexDistance(from, to);
const adjacent = areAdjacent(from, to);
const canSail = canSailBetween(G.board, from, to);  // Considers island edges
const path = findPathOnBoard(G.board, from, to);  // Returns HexCoord[]
```

### Power Checks
```typescript
const power = getPowerStrategy(player.piratePower);
const maxMove = power.getSailMaxDistance();  // 2 or 3
const canSink = power.canUseSink();  // false for Peaceful
power.onShipSunk(victim, shipType, attacker);  // Trigger passive
```

---

## boardgame.io Move Pattern

```typescript
moveName: ({ G, ctx, events }, data: MoveDataType) => {
  const player = G.players[parseInt(ctx.currentPlayer)];

  // 1. Validate
  if (invalidCondition) {
    return INVALID_MOVE;
  }

  // 2. Execute (mutate G directly - Immer handles immutability)
  player.doubloons -= cost;
  placeShip(G.board, data.hex, newShip);

  // 3. Log
  console.log(`[MOVE] Player ${ctx.currentPlayer} did thing`);

  // 4. End turn
  events?.endTurn();
}
```

---

## React Component Props Pattern

```typescript
interface ComponentProps {
  G: NotoriousState;
  ctx: any;  // boardgame.io context
  moves: any;  // Move functions
  playerID?: string | null;

  // Lifted state for coordination
  selectedAction: ActionType | null;
  setSelectedAction: (action: ActionType | null) => void;
  selectedHex: HexCoord | null;
  onHexClick: (coord: HexCoord) => void;
}
```

---

## Hex Coordinate Helpers

```typescript
// Convert between coord and string key
const key = hexToKey({ q: 1, r: 2, s: -3 });  // "1,2"
const coord = keyToHex("1,2");  // { q: 1, r: 2, s: -3 }

// Compare coordinates
if (hexEquals(coord1, coord2)) { ... }

// Check if on board
if (isOnBoard(coord)) { ... }
```

---

## Enums Quick Reference

```typescript
enum ActionType {
  SAIL = 'SAIL',
  BUILD = 'BUILD',
  STEAL = 'STEAL',
  SINK = 'SINK',
  CHART = 'CHART'
}

enum ShipType {
  SLOOP = 'SLOOP',
  GALLEON = 'GALLEON',
  PORT = 'PORT'
}

enum PiratePower {
  THE_SAILOR = 'THE_SAILOR',
  THE_ISLANDER = 'THE_ISLANDER',
  THE_PEACEFUL = 'THE_PEACEFUL',
  THE_RELENTLESS = 'THE_RELENTLESS'
}

enum ChartType {
  TREASURE_MAP = 'TREASURE_MAP',
  ISLAND_RAID = 'ISLAND_RAID',
  SMUGGLER_ROUTE = 'SMUGGLER_ROUTE'
}
```

---

## SVG Rendering Helpers

```typescript
// Hex to pixel position
function hexToPixel(coord: HexCoord, size: number): { x: number, y: number } {
  const x = size * (3/2 * coord.q);
  const y = size * (Math.sqrt(3)/2 * coord.q + Math.sqrt(3) * coord.r);
  return { x, y };
}

// Hex polygon points (flat-top)
function getHexPoints(cx: number, cy: number, size: number): string {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    points.push(`${x},${y}`);
  }
  return points.join(' ');
}
```
