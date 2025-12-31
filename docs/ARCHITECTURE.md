# Notorious - Architecture Guide

## boardgame.io Structure

### Game Definition (`src/game/NotoriousGame.ts`)

```typescript
export const NotoriousGame: Game<NotoriousState> = {
  setup: ({ ctx }) => { /* Initial state */ },

  phases: {
    setup: { /* Port placement */ },
    place: { /* Captain placement */ },
    play: {
      moves: {
        sail: ({ G, ctx }, data: SailMoveData) => { ... },
        build: ({ G, ctx }, data: BuildMoveData) => { ... },
        steal: ({ G, ctx }, data: StealMoveData) => { ... },
        sink: ({ G, ctx }, data: SinkMoveData) => { ... },
        chart: ({ G, ctx }, data: ChartMoveData) => { ... },
        skipAction: ({ G, ctx }) => { ... },
      }
    },
    pirate: { /* Notoriety & chart claiming */ }
  }
};
```

### State Shape (`NotoriousState`)

```typescript
interface NotoriousState {
  players: PlayerState[];           // Array of player data
  board: BoardState;                // Hex grid
  chartDeck: ChartDeckState;        // Draw pile, discard, island raids
  windDirection: WindDirection;
  windTokenHolder: string | null;
  setupComplete: boolean[];
  gameEndTriggered: boolean;
  piratePhaseTurnsComplete: number;
}

interface BoardState {
  hexes: Record<string, HexState>;  // Key: "q,r" string
}

interface HexState {
  coord: HexCoord;
  ships: Ship[];
  island: Island | null;
}
```

### Why Records Instead of Maps?

boardgame.io serializes state to JSON. Maps don't serialize well, so we use:
- `Record<string, HexState>` instead of `Map<string, HexState>`
- Helper functions: `hexToKey(coord)` and `keyToHex(key)`

---

## Component Architecture

### Data Flow

```
App.tsx (NotoriousBoard)
├── Manages shared state:
│   ├── selectedAction
│   ├── selectedHex
│   ├── sailState (multi-step SAIL flow)
│   └── targetSelection (STEAL/SINK target)
│
├── Board.tsx
│   ├── Renders hex grid via SVG
│   ├── Handles hex clicks → onHexClick callback
│   ├── Handles ship clicks → updates sailState/targetSelection
│   └── Highlights valid destinations
│
└── GameUI.tsx
    ├── Displays player stats
    ├── Action selection buttons
    ├── Action-specific dialogs (SAIL, BUILD, etc.)
    └── Executes moves via props.moves.*
```

### State Lifting Pattern

Complex actions like SAIL require coordination between Board and GameUI:

```typescript
// In App.tsx
const [sailState, setSailState] = useState<SailState>({
  sourceHex: null,
  selectedShip: null,
  plannedMoves: [],
  bribeCount: 0
});

// Passed to both components
<Board sailState={sailState} setSailState={setSailState} ... />
<GameUI sailState={sailState} setSailState={setSailState} ... />
```

---

## Pirate Powers - Strategy Pattern

### Why Strategy Pattern?

Instead of scattered conditionals:
```typescript
// BAD - conditionals everywhere
if (player.power === 'THE_SAILOR') maxDistance = 3;
if (player.power === 'THE_PEACEFUL') return INVALID_MOVE;
```

We use a strategy interface:
```typescript
// GOOD - single point of configuration
const power = getPowerStrategy(player.piratePower);
const maxDistance = power.getSailMaxDistance();
if (!power.canUseSink()) return INVALID_MOVE;
```

### Structure

```
src/core/powers/
├── PiratePowerStrategy.ts    # Interface
├── BasePiratePower.ts        # Default implementations
├── PowerRegistry.ts          # getPowerStrategy() factory
└── strategies/
    ├── SailorPower.ts
    ├── IslanderPower.ts
    ├── PeacefulPower.ts
    └── RelentlessPower.ts
```

### Adding New Powers

1. Create `src/core/powers/strategies/NewPower.ts`
2. Extend `BasePiratePower`, override only what's different
3. Register in `PowerRegistry.ts`

```typescript
export class NewPower extends BasePiratePower {
  readonly id = PiratePower.NEW_POWER;
  readonly name = 'The New One';
  readonly description = 'Does something special';

  // Override only what's needed
  getSailMaxDistance(): number { return 4; }
}
```

---

## AI System

### Location
`src/game/ai/NotoriousBot.ts`

### How It Works

```typescript
export function enumerateMoves(G: NotoriousState, ctx: Ctx): PossibleMove[] {
  // Returns array of { move: string, args: any[] }
  // Covers all valid moves for current phase
}
```

### AI Execution (App.tsx)

```typescript
useEffect(() => {
  if (AI_PLAYER_IDS.includes(ctx.currentPlayer)) {
    const possibleMoves = enumerateMoves(G, ctx);
    const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    moves[randomMove.move](...randomMove.args);
  }
}, [ctx.currentPlayer, ctx.phase]);
```

---

## SVG Rendering

### Hex Grid (`Board.tsx`)

- Uses flat-top hexagons
- Hex size: 40px (configurable)
- Coordinate conversion: `hexToPixel(coord, hexSize)`

### Ship Rendering (`ShipRenderer.tsx`)

- **Port**: Rectangle (20x20)
- **Galleon**: Circle (r=8-10)
- **Sloop**: Triangle

### Visual Feedback

- Clickable ships: Golden glow filter + larger size
- Selected ships: Gold stroke
- Valid destinations: Green fill
- Invalid actions: Red border + ⚠️ icon

---

## Common Patterns

### Checking Action Validity

```typescript
function checkActionValidity(action: ActionType, G: NotoriousState, playerId: string) {
  // Returns { valid: boolean, reason?: string }
}
```

### Getting Player Ships at Hex

```typescript
import { getPlayerShips } from './game/logic/BoardLogic';
const ships = getPlayerShips(G.board, hexCoord, playerId);
```

### Hex Distance Calculation

```typescript
import { hexDistance } from './utils/HexMath';
const dist = hexDistance(from, to);  // Returns integer
```

### Finding Valid Neighbors

```typescript
import { getValidNeighbors } from './config/HexConstants';
const neighbors = getValidNeighbors(coord);  // Returns HexCoord[]
```
