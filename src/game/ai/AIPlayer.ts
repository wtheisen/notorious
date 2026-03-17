import { NotoriousState } from '../types/GameState';
import { enumerateMoves } from './NotoriousBot';

/**
 * Pick a random valid move for the AI player.
 * Returns { move, args } or null if no moves available.
 */
export function pickAIMove(G: NotoriousState, ctx: any): { move: string; args: any[] } | null {
  const moves = enumerateMoves(G, ctx);
  if (moves.length === 0) return null;

  // Simple weighted random: prefer aggressive/useful moves
  const weights = moves.map(m => {
    switch (m.move) {
      case 'sail': return 3;
      case 'build': return 4;
      case 'steal': return 5;
      case 'sink': return 5;
      case 'chart': return 3;
      case 'placeCaptain': return 1;
      case 'placePortAndShips': return 1;
      case 'doneClaiming': return 1;
      case 'skipAction': return 0.5;
      case 'pass': return 0.5;
      default: return 1;
    }
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < moves.length; i++) {
    r -= weights[i];
    if (r <= 0) return moves[i];
  }

  return moves[moves.length - 1];
}
