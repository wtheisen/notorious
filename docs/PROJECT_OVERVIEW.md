# Notorious - Project Overview

## What is Notorious?

Notorious is a browser-based multiplayer pirate board game built with React and boardgame.io. Players compete to become the most notorious pirate by controlling hexes, sinking ships, and completing charts.

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Game Engine**: [boardgame.io](https://boardgame.io/) - handles game state, turns, phases, and multiplayer
- **Rendering**: SVG-based hex grid (no canvas/WebGL)
- **Build**: Webpack 5
- **Styling**: Inline React styles (no CSS files)

## Project Structure

```
src/
├── App.tsx                 # Main app, boardgame.io client setup
├── index.tsx               # Entry point
├── components/             # React UI components
│   ├── Board.tsx           # Hex grid rendering, click handling
│   ├── GameUI.tsx          # Sidebar UI, action dialogs
│   ├── HexRenderer.tsx     # Individual hex SVG rendering
│   └── ShipRenderer.tsx    # Ship piece SVG rendering
├── game/                   # boardgame.io game logic
│   ├── NotoriousGame.ts    # Main game definition, moves, phases
│   ├── types/
│   │   └── GameState.ts    # State interfaces (NotoriousState, PlayerState, etc.)
│   ├── logic/
│   │   ├── BoardLogic.ts   # Board manipulation functions
│   │   └── PlayerLogic.ts  # Player state manipulation
│   └── ai/
│       └── NotoriousBot.ts # AI move enumeration
├── core/                   # Game domain objects
│   ├── Chart.ts            # Chart types (TreasureMap, IslandRaid, SmugglerRoute)
│   ├── Island.ts           # Island class with passable edges
│   ├── IslandPlacer.ts     # Island placement logic
│   └── powers/             # Pirate power strategy pattern
│       ├── PiratePowerStrategy.ts
│       ├── BasePiratePower.ts
│       ├── PowerRegistry.ts
│       └── strategies/     # Individual power implementations
├── config/
│   ├── HexConstants.ts     # Board hex coordinates, neighbor logic
│   └── IslandDefinitions.ts # Island shapes and configurations
├── types/
│   ├── GameTypes.ts        # Enums (ActionType, ShipType, etc.)
│   └── CoordinateTypes.ts  # HexCoord interface
└── utils/
    └── HexMath.ts          # Hex geometry calculations
```

## Key Concepts

### boardgame.io Integration

The game uses boardgame.io's structure:
- **G**: Game state object (`NotoriousState`)
- **ctx**: Context with currentPlayer, phase, turn info
- **moves**: Functions that mutate G (e.g., `sail`, `build`, `sink`)
- **phases**: Game phases (`setup` → `place` → `play` → `pirate` → repeat)

### Hex Coordinate System

Uses axial coordinates (q, r) with implicit s = -q - r:
- Board is ~19 hexes in a roughly circular shape
- Coordinates defined in `HexConstants.ts`
- Key helper: `hexToKey(coord)` converts to string "q,r" for Record keys

### State Management

- **Board state**: `G.board.hexes` is a `Record<string, HexState>` (not a Map, for serialization)
- **Player state**: `G.players[]` array with resources, ships, charts
- **UI state**: React useState in App.tsx, passed down to Board and GameUI

## Running the Project

```bash
npm install
npm start        # Development server on localhost:8080
npm run build    # Production build to dist/
```

## Current Player Setup

- 4 players total: 1 human (Player 0) + 3 AI
- AI controlled via useEffect in App.tsx that calls `enumerateMoves()` and picks randomly
- Single-client architecture (no multiplayer server yet)
