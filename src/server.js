const { Server } = require('boardgame.io/server');
const { NotoriousGame } = require('./game/NotoriousGame');

/**
 * boardgame.io Server for online multiplayer
 * Run with: node src/server.js
 */

const server = Server({
  games: [NotoriousGame],

  // Optional: Add authentication
  // This generates a simple credential for each player
  generateCredentials: (ctx) => {
    return Math.random().toString(36).substring(2);
  }
});

const PORT = process.env.PORT || 8000;

server.run(PORT, () => {
  console.log(`===========================================`);
  console.log(`Notorious boardgame.io Server`);
  console.log(`Running on port ${PORT}`);
  console.log(`===========================================`);
  console.log(`Game available at: http://localhost:${PORT}`);
  console.log(``);
  console.log(`To connect clients:`);
  console.log(`- Update App.tsx to use SocketIO multiplayer`);
  console.log(`- Set server URL to: http://localhost:${PORT}`);
  console.log(`===========================================`);
});
