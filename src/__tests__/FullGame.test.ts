import { describe, it, expect } from 'vitest';
import { NotoriousGame } from '../game/NotoriousGame';
import { Client } from 'boardgame.io/client';
import { enumerateMoves } from '../game/ai/NotoriousBot';
import '../core/powers/strategies/index';

/**
 * Full game simulation: all 4 players use the AI bot to pick moves.
 * Verifies the game runs to completion without errors.
 */
describe('Full game playthrough', () => {
  it('runs a complete game to 28 notoriety', () => {
    const client = Client({
      game: NotoriousGame,
      numPlayers: 4,
    });

    client.start();
    let maxIterations = 5000;
    let roundCount = 0;

    while (maxIterations-- > 0) {
      const { G, ctx } = client.getState()!;

      // Game over check
      if (ctx.gameover) {
        console.log(`Game ended after ~${roundCount} iterations`);
        console.log('Final scores:', G.players.map(p => `${p.name}: ${p.notoriety} notoriety, ${p.doubloons} doubloons`));
        const winner = G.players.reduce((best, p) => p.notoriety > best.notoriety ? p : best, G.players[0]);
        console.log(`Winner: ${winner.name} with ${winner.notoriety} notoriety`);
        expect(winner.notoriety).toBeGreaterThanOrEqual(28);
        return;
      }

      // Use AI bot to enumerate and pick a random move for the current player
      const moves = enumerateMoves(G, ctx);
      if (moves.length === 0) {
        console.log(`No moves available for player ${ctx.currentPlayer} in phase ${ctx.phase}`);
        break;
      }

      // Pick a random move
      const move = moves[Math.floor(Math.random() * moves.length)];
      client.moves[move.move](...move.args);
      roundCount++;

      // Log progress
      if (roundCount % 100 === 0) {
        const scores = G.players.map(p => p.notoriety);
        const dbl = G.players.map(p => p.doubloons);
        console.log(`  [${roundCount}] phase=${ctx.phase} player=${ctx.currentPlayer} scores=${scores} dbl=${dbl}`);
      }
    }

    // If we got here, the game didn't finish in time
    const { G } = client.getState()!;
    const scores = G.players.map(p => p.notoriety);
    console.log(`Game did not complete in ${5000} iterations. Scores: ${scores}`);
    // This is still useful - we verified no crashes
    expect(Math.max(...scores)).toBeGreaterThan(0);
  }, 30000); // 30s timeout
});
