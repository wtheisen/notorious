# Notorious - Development Guide

## Common Tasks

### Adding a New Action

1. **Define move data type** in `NotoriousGame.ts`:
```typescript
interface NewActionMoveData {
  hex: HexCoord;
  // ... other parameters
}
```

2. **Add move to play phase**:
```typescript
moves: {
  newAction: ({ G, ctx, events }, data: NewActionMoveData) => {
    const player = G.players[parseInt(ctx.currentPlayer)];

    // Validate
    if (!hasRequiredCaptain(player, ActionType.NEW_ACTION)) {
      return INVALID_MOVE;
    }

    // Execute logic
    // ...

    // Consume captain and end turn
    removeCaptain(player, ActionType.NEW_ACTION);
    events?.endTurn();
  }
}
```

3. **Add to ActionType enum** in `types/GameTypes.ts`

4. **Add UI dialog** in `GameUI.tsx`

5. **Add validity check** in `checkActionValidity()` in `GameUI.tsx`

6. **Add AI support** in `NotoriousBot.ts` `enumerateMoves()`

---

### Adding a New Pirate Power

1. **Add to PiratePower enum** in `types/GameTypes.ts`:
```typescript
export enum PiratePower {
  // ...existing
  THE_NEW_ONE = 'THE_NEW_ONE'
}
```

2. **Create strategy file** `src/core/powers/strategies/NewOnePower.ts`:
```typescript
import { BasePiratePower } from '../BasePiratePower';
import { PiratePower } from '../../../types/GameTypes';

export class NewOnePower extends BasePiratePower {
  readonly id = PiratePower.THE_NEW_ONE;
  readonly name = 'The New One';
  readonly description = 'Special ability description';

  // Override methods as needed
  getSailMaxDistance(): number { return 2; }  // default
  canUseSink(): boolean { return true; }      // default
  // etc.
}
```

3. **Register in PowerRegistry.ts**:
```typescript
import { NewOnePower } from './strategies/NewOnePower';

registerPower(new NewOnePower());
```

4. **Export from strategies/index.ts**:
```typescript
export * from './NewOnePower';
```

---

### Modifying Hex Board Shape

Edit `src/config/HexConstants.ts`:

```typescript
export const BOARD_HEXES: HexCoord[] = [
  // Add or remove coordinates
  { q: 0, r: 0, s: 0 },
  { q: 1, r: 0, s: -1 },
  // ...
];
```

---

### Adding New Ship Type

1. **Add to ShipType enum** in `types/GameTypes.ts`

2. **Update ShipRenderer.tsx** with visual representation

3. **Update influence calculation** in `BoardLogic.ts`:
```typescript
export function getInfluence(board: BoardState, coord: HexCoord, playerId: string): number {
  // Add case for new ship type
}
```

4. **Update player inventory** in `GameState.ts` if ships are tracked separately

---

## Debugging Tips

### Enable boardgame.io Debug Panel

In `App.tsx`:
```typescript
const NotoriousClient = Client({
  game: NotoriousGame,
  board: NotoriousBoard,
  debug: true  // Shows debug panel
});
```

### Console Logging

Game moves already have logging:
```typescript
console.log(`[SAIL] Player ${playerId} moved ${shipType} from (${from.q},${from.r}) to (${to.q},${to.r})`);
```

### Inspecting Game State

In browser console with debug panel enabled, you can inspect G (game state) directly.

---

## Testing Patterns

### Manual Testing Flow

1. `npm start`
2. Open http://localhost:8080
3. Use debug panel to:
   - Switch player views
   - Inspect state
   - Manually trigger moves

### AI Testing

The AI picks random valid moves. To test specific scenarios:
1. Temporarily modify `enumerateMoves()` to filter moves
2. Or modify AI delay in App.tsx to slow down for observation

---

## Code Style

### State Mutations

boardgame.io uses Immer, so you can mutate G directly:
```typescript
// This is OK in moves:
player.doubloons += 5;
G.board.hexes[key].ships.push(newShip);
```

### Pure Functions for Logic

Keep logic in separate files (`BoardLogic.ts`, `PlayerLogic.ts`):
```typescript
// In PlayerLogic.ts
export function gainDoubloons(player: PlayerState, amount: number): void {
  player.doubloons += amount;
}

// In move
gainDoubloons(player, 5);
```

### TypeScript Strictness

- Always type function parameters
- Use interfaces for complex data structures
- Avoid `any` - use proper types or generics

---

## File Organization Rules

1. **Game logic** → `src/game/`
2. **React components** → `src/components/`
3. **Domain objects** (non-React) → `src/core/`
4. **Type definitions** → `src/types/`
5. **Configuration** → `src/config/`
6. **Utilities** → `src/utils/`

---

## Known Limitations

1. **No multiplayer server** - Currently single-client with AI
2. **No persistence** - Game state lost on refresh
3. **Bundle size** - ~380KB, could use code splitting
4. **AI is random** - No strategic decision making

---

## Future Considerations

### Multiplayer
- boardgame.io supports server mode
- Would need `npm install boardgame.io/server`
- Lobby system for matchmaking

### Better AI
- Implement scoring heuristic in `enumerateMoves()`
- Consider MCTS or minimax for strategic play

### Mobile Support
- Current SVG approach works on mobile
- May need touch event handling improvements
- Consider responsive layout for GameUI sidebar
