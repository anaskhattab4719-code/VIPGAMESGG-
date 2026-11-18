import { Chess, Move } from 'chess.js';

export type AiDifficulty = 'easy' | 'medium' | 'hard';

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-square tables (from White's perspective, rank 8 at row 0)
const PAWN_TABLE = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 25, 25, 10, 5, 5],
  [0, 0, 0, 20, 20, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const KNIGHT_TABLE = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];

export function evaluateBoard(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -99999 : 99999;
  }
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) {
    return 0;
  }

  const board = chess.board();
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      let val = PIECE_VALUES[piece.type] || 0;
      const tableRow = piece.color === 'w' ? r : 7 - r;
      if (piece.type === 'p') {
        val += PAWN_TABLE[tableRow][c];
      } else if (piece.type === 'n') {
        val += KNIGHT_TABLE[tableRow][c];
      } else if (piece.type === 'b' || piece.type === 'q') {
        // Slight centralization bonus
        val += (3.5 - Math.abs(3.5 - c)) * 4;
      }
      score += piece.color === 'w' ? val : -val;
    }
  }
  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return moves.sort((a, b) => {
    const scoreA = (a.captured ? PIECE_VALUES[a.captured] * 10 : 0) + (a.promotion ? 800 : 0);
    const scoreB = (b.captured ? PIECE_VALUES[b.captured] * 10 : 0) + (b.promotion ? 800 : 0);
    return scoreB - scoreA;
  });
}

interface SearchBudget {
  deadline: number;
  nodes: number;
  maxNodes: number;
  aborted: boolean;
}

function minimax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizingWhite: boolean,
  budget: SearchBudget
): number {
  budget.nodes++;
  if (budget.nodes >= budget.maxNodes || (budget.nodes % 64 === 0 && performance.now() > budget.deadline)) {
    budget.aborted = true;
    return evaluateBoard(chess);
  }
  if (depth === 0 || chess.isGameOver()) {
    return evaluateBoard(chess);
  }

  const moves = orderMoves(chess.moves({ verbose: true }));
  if (maximizingWhite) {
    let best = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const val = minimax(chess, depth - 1, alpha, beta, false, budget);
      chess.undo();
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha || budget.aborted) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      chess.move(move);
      const val = minimax(chess, depth - 1, alpha, beta, true, budget);
      chess.undo();
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (beta <= alpha || budget.aborted) break;
    }
    return best;
  }
}

export function chooseBestChessMove(fen: string, difficulty: AiDifficulty): Move | null {
  try {
    const chess = new Chess(fen);
    const moves = orderMoves(chess.moves({ verbose: true }));
    if (moves.length === 0) return null;

    if (difficulty === 'easy') {
      if (Math.random() < 0.45) {
        return moves[Math.floor(Math.random() * moves.length)];
      }
      const budget: SearchBudget = { deadline: performance.now() + 180, nodes: 0, maxNodes: 2500, aborted: false };
      const maximizing = chess.turn() === 'w';
      let bestMove = moves[0];
      let bestScore = maximizing ? -Infinity : Infinity;
      for (const m of moves) {
        chess.move(m);
        const sc = minimax(chess, 0, -Infinity, Infinity, !maximizing, budget) + (Math.random() - 0.5) * 40;
        chess.undo();
        if ((maximizing && sc > bestScore) || (!maximizing && sc < bestScore)) {
          bestScore = sc;
          bestMove = m;
        }
        if (budget.aborted) break;
      }
      return bestMove;
    }

    const depth = difficulty === 'medium' ? 2 : 3;
    const budget: SearchBudget = {
      deadline: performance.now() + (difficulty === 'hard' ? 420 : 250),
      nodes: 0,
      maxNodes: difficulty === 'hard' ? 11000 : 4500,
      aborted: false,
    };
    const maximizing = chess.turn() === 'w';
    let bestMove = moves[0];
    let bestScore = maximizing ? -Infinity : Infinity;

    for (const m of moves) {
      chess.move(m);
      const sc = minimax(chess, depth - 1, -Infinity, Infinity, !maximizing, budget);
      chess.undo();
      if ((maximizing && sc > bestScore) || (!maximizing && sc < bestScore)) {
        bestScore = sc;
        bestMove = m;
      }
      if (budget.aborted) break;
    }
    return bestMove;
  } catch {
    return null;
  }
}

export function getCapturedMaterial(fen: string) {
  const chess = new Chess(fen);
  const startCounts: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const currentW: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  const currentB: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };

  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.type === 'k') continue;
      if (sq.color === 'w') currentW[sq.type]++;
      else currentB[sq.type]++;
    }
  }

  const lostByWhite: string[] = [];
  const lostByBlack: string[] = [];
  let whiteMat = 0;
  let blackMat = 0;

  for (const type of ['q', 'r', 'b', 'n', 'p']) {
    whiteMat += currentW[type] * PIECE_VALUES[type];
    blackMat += currentB[type] * PIECE_VALUES[type];
    const wLost = Math.max(0, startCounts[type] - currentW[type]);
    const bLost = Math.max(0, startCounts[type] - currentB[type]);
    for (let i = 0; i < wLost; i++) lostByWhite.push(type);
    for (let i = 0; i < bLost; i++) lostByBlack.push(type);
  }

  return {
    capturedByWhite: lostByBlack,
    capturedByBlack: lostByWhite,
    advantageWhite: Math.round((whiteMat - blackMat) / 100),
  };
}
