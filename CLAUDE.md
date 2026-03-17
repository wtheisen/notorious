# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start dev server on port 3000
- `npm run build` — Type-check with tsc then build with Vite
- `npm run preview` — Preview production build
- `npm test` — Run Vitest test suite
- `npm run test:watch` — Run Vitest in watch mode

## Deployment

GitHub Pages via `.github/workflows/deploy.yml` on push to `main`. Output goes to `dist/`.

## Architecture

Notorious is a pirate-themed digital board game built with **boardgame.io** + **React** + **Three.js**. It runs entirely client-side (local multiplayer with AI opponents, no server). Player 0 is human; players 1–3 are AI.

### Key layers

**boardgame.io game definition** (`src/game/NotoriousGame.ts`): Defines all game state, moves, phases, and turn order. This is the single source of truth for game rules. The `NotoriousState` type (`src/game/types/GameState.ts`) is the `G` object boardgame.io manages.

**Game logic** (`src/game/logic/`): Pure functions that mutate state, called by moves in NotoriousGame.ts.
- `BoardLogic.ts` — hex grid operations, ship placement/movement, influence calculations, pathfinding
- `PlayerLogic.ts` — player resource management (notoriety, doubloons, ships, captains)
- `SailLogic.ts` — reachable hex computation for ship movement

**3D renderer** (`src/renderer/`): Three.js scene separate from game logic.
- `SceneManager.ts` — Three.js scene, camera, lighting, animation loop
- `GameRenderer.ts` — syncs boardgame.io state to 3D scene, manages ship/island meshes
- `RaycasterManager.ts` — hex click, hover, and drag-and-drop detection
- `objects/` — mesh classes (HexTile, HexGrid, ShipMesh, IslandMesh, ActionSpaces, etc.)

**React UI** (`src/ui/`):
- `App.tsx` — landing page (17th century cartographic style) + boardgame.io client bootstrap
- `GameScreen.tsx` — main board component implementing boardgame.io's `BoardProps`. Contains all interaction state machine logic (InteractionMode union type) and wires user input to boardgame.io moves.
- `hud/` — ActionBar, PlayerPanel, PhaseIndicator, ChartHand
- `dialogs/` — modal dialogs for Build, Steal, Sink, Chart actions

**Core domain** (`src/core/`): Game domain objects.
- `Chart.ts` / `ChartDeck.ts` — chart cards (Treasure Map, Island Raid, Smuggler Route)
- `Island.ts` / `IslandPlacer.ts` — island definitions and board placement
- `powers/` — pirate power system using Strategy pattern (Sailor, Peaceful, Relentless, Islander)

**AI** (`src/game/ai/`): `AIPlayer.ts` picks moves using weighted random selection. `NotoriousBot.ts` enumerates legal moves for the AI (no evaluation/heuristic logic).

### boardgame.io integration details

- All state must be plain objects/Records (not classes/Maps) — boardgame.io uses Immer internally for immutability
- Moves return `INVALID_MOVE` on failure
- Moves call `events.endTurn()` to advance
- Phase transitions are automatic via `endIf` + `next`
- Turn order respects `WindDirection` (clockwise/counterclockwise) in PLACE/PLAY/PIRATE phases
- `ctx.currentPlayer` is a string index (`"0"`, `"1"`, etc.)

### Move data types

Each move takes a specific data interface:
- `SailMoveData` — array of ship moves + bribes used
- `BuildMoveData` — hex + array of ShipType placements + bribes
- `StealMoveData` — hex + target player + replace flag
- `SinkMoveData` — hex + target + sloop pre-moves + additional sinks
- `ChartMoveData` — bribe choices (draw/keep) + selected chart IDs

### Bribe system

Every action except STEAL has a bribe mechanic: spend doubloons for enhanced effects. This is a core game concept that pervades the codebase (extra sail distance, extra builds, extra draws/keeps for charts, etc.).

### Game flow

Phases: SETUP → PLACE → PLAY → PIRATE → (repeat PLACE/PLAY/PIRATE until someone reaches 24 notoriety)

- **SETUP**: Snake-draft port + ship placement
- **PLACE**: Each player assigns captains to action spaces (SAIL, STEAL, BUILD, SINK, CHART)
- **PLAY**: Execute assigned actions in turn order
- **PIRATE**: Claim completed charts for notoriety/doubloons

### Island placement algorithm

Create 19 treasure maps (1 per hex), shuffle, first 5 determine island positions. Remaining 14 go into the chart deck. See `IslandPlacer.ts`.

### Coordinate system

Hex grid uses axial coordinates `{q, r, s}` where `s = -q - r`. Hexes are stored as `Record<string, HexState>` keyed by `"q,r"` strings. Use `hexToKey()`/`keyToHex()` for conversion.

### Pirate power system

Strategy pattern: `PiratePowerStrategy` interface → `BasePiratePower` abstract class → concrete strategies. Auto-registration via side-effect imports in `src/core/powers/strategies/*.ts`. Use `getPowerStrategy()` from `PowerRegistry` for lookup.

Powers modify: sail distance, action availability, costs, rewards, passive triggers.

**Adding a new power:** create class extending `BasePiratePower`, call `registerPower()` at module level, import in `src/core/powers/strategies/index.ts`.

### Renderer–game boundary

- `GameRenderer.syncState(G)` is the one-way sync from boardgame.io state → Three.js scene
- Drag lock system: `setDragLock(true)` prevents `syncState` from rebuilding ships mid-drag
- Pending moves: `applyPendingMove()` rekeys ship meshes optimistically during multi-step sail
- Ship meshes are recreated every sync (not pooled) — stored in `Map<hexKey, ShipMesh[]>`

### Interaction state machine

`GameScreen.tsx` uses an `InteractionMode` discriminated union to track UI state (idle, setup, sail, sail_dragging, build_select_hex, steal_select_hex, sink_premove, sink_select_hex, chart_pick, pirate). Each mode determines which hex clicks/drags are valid and what highlights to show.

### Visual theme

17th century copperplate engraving / etched cartographic map style.

- **Palette**: Parchment cream (`#f4e8c1`), burnt umber (`#5c3a1e`), sepia ink (`#3b2a1a`), faded gold (`#b8963e`), ocean blue-gray (`#6a8a9a`), blood red (`#8b2500`), verdigris green (`#4a7c5c`)
- **Fonts**: `Cinzel` / `Cinzel Decorative` (display), `IM Fell English` (body) — loaded from Google Fonts
- **HUD panels**: Solid warm parchment backgrounds (no backdrop-filter blur), double-line / etched borders, embossed inner shadows
- **Dialogs**: Inline styles using the same parchment palette — `#e8dcc4` backgrounds, `#8b7355` borders, `#4a7c5c` confirm buttons, `#8b2500` danger buttons
- **3D scene**: Warm parchment background/fog (`0xc4b28a`), golden lighting, paper-thin hex tiles (`depth: 0.02`), muted ocean blue-gray hexes, matte materials
- **CSS variables**: Defined in `src/ui/hud/hud.css` `:root` — use these for any new UI elements

## Conventions

- `hexToKey()` exists in TWO places: `src/types/CoordinateTypes.ts` (canonical) and `src/game/types/GameState.ts` (re-export). Use the one from `CoordinateTypes`.
- Edge wrapping (Post-Magellan rule) is stubbed but not implemented (`EDGE_WRAPS` is empty).
- Direction vectors are defined in both `HexMath.ts` and `HexConstants.ts` — use `getValidNeighbors()` from `HexConstants` for board-aware neighbors.
- `HexGeometry.ts` in renderer has 3D-specific hex math (separate from `HexMath.ts` which is 2D/logic).
