# Notorious

> A browser-based implementation of the strategic pirate board game "Notorious" built with Phaser.js and TypeScript.

## Overview

Notorious is a hex-grid based strategy game where players compete as pirate captains to gain notoriety by controlling seas, building fleets, and executing daring actions. This digital implementation brings the tabletop experience to the browser with an interactive interface and real-time gameplay.

## Features

### Core Gameplay
- **5 Strategic Actions**: Build ships, sail the seas, steal from opponents, sink enemy vessels, and chart new territories
- **Hex-Grid Board**: 19-hex board with axial coordinate system for strategic positioning
- **Resource Management**: Track Notoriety, Doubloons, Captains, and fleets
- **Multi-Phase Gameplay**: SETUP → PLACE → PLAY → PIRATE phase progression
- **Win Conditions**: First to reach 24 Notoriety claims victory

### Technical Features
- Built with **Phaser 3.80+** game framework
- **TypeScript** for type-safe development
- Framework-agnostic core game logic
- Observer pattern for reactive state management
- Hot-reload development environment with Webpack
- Responsive hex-grid rendering system

## Quick Start

### Prerequisites
- Node.js v16 or higher
- npm or yarn package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/wtheisen/notorious.git
cd notorious

# Install dependencies
npm install

# Start development server
npm start
```

The game will automatically open in your browser at `http://localhost:8080`

### Build Commands

```bash
# Development server with hot reload
npm start

# Production build
npm run build

# Development build with watch mode
npm run dev
```

## How to Play

### Game Actions

1. **Build** - Place 2 Sloops or 1 Galleon on a hex you control
2. **Sail** - Move your ships across the board (click source, then destination)
3. **Steal** - Replace an opponent's Sloop with your own
4. **Sink** - Remove opponent ships and gain Notoriety
5. **Chart** - Draw treasure maps and gain Doubloons

### Gameplay Flow

1. Select an action button during your turn in the PLAY phase
2. Click the target hex(es) to execute the action
3. Click "End Turn" to pass control to the next player
4. Advance through phases to complete rounds
5. First player to reach 24 Notoriety wins!

### Ship Types & Influence

- **Sloop**: 1 influence point (small circle)
- **Galleon**: 2 influence points (large circle)
- **Port**: 3 influence points (triangle)

The player with the most influence on a hex controls it and earns Notoriety during the PIRATE phase.

## Project Structure

```
notorious/
├── src/
│   ├── main.ts                 # Application entry point
│   ├── config/                 # Game configuration
│   │   ├── GameConfig.ts       # Phaser settings
│   │   └── HexConstants.ts     # Board layout constants
│   ├── core/                   # Framework-agnostic game logic
│   │   ├── GameState.ts        # Central state manager
│   │   ├── Player.ts           # Player data & resources
│   │   ├── Board.ts            # Board management
│   │   ├── Hex.ts              # Individual hex state
│   │   ├── Ship.ts             # Ship types & influence
│   │   ├── Island.ts           # Island data
│   │   ├── ActionExecutor.ts   # Action validation & execution
│   │   └── PhaseManager.ts     # Game phase orchestration
│   ├── actions/                # Action implementations
│   │   ├── Action.ts           # Base action interface
│   │   ├── BuildAction.ts
│   │   ├── SailAction.ts
│   │   ├── StealAction.ts
│   │   ├── SinkAction.ts
│   │   └── ChartAction.ts
│   ├── rendering/              # Phaser rendering layer
│   │   ├── HexRenderer.ts      # Hex visualization
│   │   └── ShipRenderer.ts     # Ship visualization
│   ├── scenes/                 # Phaser scenes
│   │   ├── GameScene.ts        # Main game scene
│   │   └── UIScene.ts          # HUD overlay
│   ├── utils/
│   │   └── HexMath.ts          # Hex grid mathematics
│   └── types/                  # TypeScript definitions
│       ├── CoordinateTypes.ts
│       └── GameTypes.ts
├── assets/                     # Game assets
├── index.html                  # HTML entry point
├── package.json
├── tsconfig.json
└── webpack.config.js
```

## Architecture

### Design Principles

1. **Separation of Concerns**: Core game logic in `/core` is completely framework-agnostic
2. **Observer Pattern**: `GameState` serves as single source of truth, notifying observers of changes
3. **Type Safety**: Strong TypeScript typing throughout the codebase
4. **Reactive Rendering**: UI automatically updates when game state changes
5. **Modular Actions**: Each action is a separate class implementing a common interface

### Hex Coordinate System

The game uses an axial coordinate system for hex-grid management:

```typescript
// Axial coordinates where q + r + s = 0
const hex = createHexCoord(1, 0); // { q: 1, r: 0, s: -1 }
const pixel = hexToPixel(hex, centerX, centerY);
```

### State Management

```typescript
// Observer pattern for reactive updates
gameState.addObserver(() => {
  this.renderBoard(); // Re-render when state changes
});
```

## Development Status

### Completed (Phases 1-4)
- ✅ Project setup and development environment
- ✅ Hex grid system with coordinate mathematics
- ✅ Core game logic and state management
- ✅ All 5 player actions (Build, Sail, Steal, Sink, Chart)
- ✅ Interactive UI with real-time stats
- ✅ Phase management system
- ✅ Ship rendering and hex control visualization

### Roadmap

**Phase 5: AI Opponent**
- Random AI making legal moves
- AI turn automation with visual feedback

**Phase 6: Islands & Charts**
- Random island placement (5 islands)
- Impassable edge implementation
- Chart types (Treasure Map, Island Raid, Smuggler Route)

**Phase 7: Polish & Advanced Features**
- Pirate special powers
- Ship movement animations
- Sound effects
- Enhanced visual feedback
- Full Captain placement in PLACE phase
- Bribe selection UI

## Troubleshooting

### Port Already in Use
If port 8080 is occupied, modify the port in `webpack.config.js`:

```javascript
devServer: {
  port: 3000, // Change to any available port
}
```

### TypeScript Errors
Ensure all dependencies are installed:
```bash
npm install
```

### Console Debugging
Open browser console (F12) to see detailed hex information and game state logs.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits

- **Game Design**: Based on the board game "Notorious" by William Theisen
- **Hex Grid Mathematics**: Adapted from [Red Blob Games](https://www.redblobgames.com/grids/hexagons/)
- **Game Framework**: Built with [Phaser 3](https://phaser.io/)

## Acknowledgments

- Phaser.js team for the excellent game framework
- Red Blob Games for comprehensive hex grid tutorials
- The board gaming community for inspiration

---

**Play the game, build your fleet, and become the most Notorious pirate on the high seas!**
