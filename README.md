# NOTORIOUS

**A Game of Piracy & Treachery on the High Seas**

Notorious is a pirate-themed digital board game set in the Caribbean, rendered in a 17th century copperplate engraving style. Sail fleets of sloops and galleons across a hex grid, claim islands, sink rival ships, and race to become the most notorious pirate captain.

Built with **React**, **Three.js**, and **boardgame.io**. Runs entirely in the browser -- no server required.

[Play Now](https://wtheisen.github.io/notorious/) | [Rules](https://docs.google.com/document/d/1IOipOCJRL1IJNccERc-0sSyc-rzzKfdzVAe5hGa3FLw/edit?tab=t.0)

---

## How to Play

**1-4 players** (1 human + up to 3 AI opponents). First to **28 notoriety** wins.

### Game Flow

Each round follows three phases:

| Phase | What Happens |
|-------|-------------|
| **Place** | Assign your captains to action spaces. More captains unlock at 5 and 12 notoriety. |
| **Play** | Execute actions in turn order (set by the Wind Token). |
| **Pirate** | Score notoriety for hex control. Claim completed charts for rewards. |

### The Five Actions

| Action | Effect |
|--------|--------|
| **Sail** | Move ships up to 2 hexes. Bribe for extra distance. |
| **Build** | Place 2 sloops or 1 galleon at your port or a controlled hex. Bribe for more. |
| **Steal** | Take an enemy sloop at a shared hex and add it to your fleet. |
| **Sink** | Destroy an enemy ship at a shared hex. Earn notoriety if they outrank you. |
| **Chart** | Draw 2 chart cards, keep 1, and claim the Wind Token. Bribe to draw/keep more. |

### Bribe System

Every action except Steal can be enhanced by spending **doubloons** (the game's currency). Extra sail distance, extra builds, extra chart draws -- bribes are the key to explosive turns.

### Ships & Influence

Ships project **influence** over hexes. The player with the most influence controls the hex.

| Ship | Influence | Notes |
|------|-----------|-------|
| **Sloop** | 1 | Fast, expendable |
| **Galleon** | 2 | Required to claim Treasure Maps and Island Raids |
| **Port** | 3 | Immovable home base, highest influence |

### Chart Cards

Charts are the primary path to notoriety and doubloons:

- **Treasure Maps** -- Claim by parking a galleon on the target hex while controlling it. Awards doubloons.
- **Smuggler Routes** -- Connect two named islands with a continuous chain of your ships. Awards doubloons based on path length.
- **Island Raids** -- Public objectives that unlock at 14 and 28 notoriety. Require a galleon on the target island with hex control. Award 4 notoriety + accumulated doubloons.

### The Five Islands

Five Caribbean islands are randomly placed on the 19-hex board each game:

**Havana** -- **Nassau** -- **Tortuga** -- **Port Royal** -- **Hispaniola**

Islands have impassable edges that block sailing, creating natural chokepoints and strategic territory.

### Edge Wrapping (Post-Magellan Rule)

The board wraps at the edges -- ships sailing off one side of the hex grid emerge on the opposite side, as if the Caribbean were round.

### Pirate Powers

Each player has a unique ability that shapes their strategy:

| Power | Ability | Trade-off |
|-------|---------|-----------|
| **The Sailor** | Sail 3 hexes instead of 2 | -- |
| **The Islander** | Ignore impassable island edges | -- |
| **The Relentless** | Free sloop move before Sink actions | No notoriety from hex control |
| **The Peaceful** | Gain 1 doubloon when your ship is sunk or stolen | Cannot use Sink actions |

### Wind Token

The player who takes the Chart action claims the **Wind Token**, which determines turn order direction (clockwise or counterclockwise) and starting player for the next round. Controlling the wind is a subtle but powerful advantage.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Game engine | [boardgame.io](https://boardgame.io/) -- state management, turn order, phases |
| 3D rendering | [Three.js](https://threejs.org/) -- hex grid, ships, islands, animations |
| UI framework | [React 18](https://react.dev/) -- HUD, dialogs, interaction state |
| Animations | [Tween.js](https://tweenjs.github.io/tween.js/) |
| Build tool | [Vite](https://vite.dev/) |
| Type safety | TypeScript |
| Testing | [Vitest](https://vitest.dev/) -- 141 tests |
| Deployment | GitHub Pages (auto-deploy on push to `main`) |

---

## Development

```bash
# Install dependencies
npm install

# Start dev server (port 3000)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type-check and build for production
npm run build

# Preview production build
npm run preview
```

---

## Architecture

```
src/
  game/
    NotoriousGame.ts     # boardgame.io game definition (moves, phases, turn order)
    types/GameState.ts   # State types (NotoriousState, BoardState, PlayerState)
    logic/
      BoardLogic.ts      # Hex grid operations, influence, pathfinding
      PlayerLogic.ts     # Player resources (notoriety, doubloons, ships)
      SailLogic.ts       # Reachable hex computation for movement
    ai/
      NotoriousBot.ts    # AI move enumeration (RandomBot)
  renderer/
    SceneManager.ts      # Three.js scene, camera, lighting, animation loop
    GameRenderer.ts      # Syncs boardgame.io state to 3D scene
    RaycasterManager.ts  # Click, hover, and drag detection
    objects/             # Mesh classes (HexTile, ShipMesh, IslandMesh, etc.)
  ui/
    GameScreen.tsx       # Main board component + interaction state machine
    hud/                 # ActionBar, PlayerPanel, PhaseIndicator, ChartHand
    dialogs/             # Modal dialogs for Build, Steal, Sink, Chart actions
  core/
    Chart.ts / ChartDeck.ts    # Chart card system
    Island.ts / IslandPlacer.ts # Island definitions and random placement
    powers/                     # Pirate power strategy pattern
  config/
    HexConstants.ts      # Board hex layout, edge wrapping table
  types/
    GameTypes.ts         # Enums (ShipType, ActionType, PiratePower, etc.)
    CoordinateTypes.ts   # Axial hex coordinates
  utils/
    HexMath.ts           # Hex distance, pathfinding, coordinate conversion
```

### Key Design Decisions

- **All state is plain objects** -- boardgame.io uses Immer internally, so no classes or Maps in game state
- **One-way state sync** -- `GameRenderer.syncState(G)` is the sole bridge from game logic to 3D scene
- **Strategy pattern for powers** -- Pirate powers are pluggable via `PiratePowerStrategy` interface with auto-registration
- **Hex axial coordinates** -- `{q, r, s}` where `s = -q - r`, stored as `Record<"q,r", HexState>`
- **Interaction state machine** -- `GameScreen.tsx` uses a discriminated union (`InteractionMode`) to manage UI states

---

## Visual Theme

The entire game is styled after a **17th century copperplate engraving** -- the kind of hand-etched maritime atlas you'd find in a captain's quarters.

**Palette:**
- Parchment cream `#f4e8c1`
- Burnt umber `#5c3a1e`
- Sepia ink `#3b2a1a`
- Faded gold `#b8963e`
- Ocean blue-gray `#6a8a9a`
- Blood red `#8b2500`
- Verdigris green `#4a7c5c`

**Fonts:** [Cinzel Decorative](https://fonts.google.com/specimen/Cinzel+Decorative) for display, [IM Fell English](https://fonts.google.com/specimen/IM+Fell+English) for body text.

---

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes with tests
4. `npm run build` must pass (includes type-checking)
5. `npm test` must pass
6. Open a PR

---

*Anno Domini MDCLXXVIII -- Rule the Caribbean*
