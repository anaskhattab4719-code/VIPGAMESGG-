import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess, Square } from 'chess.js';
import { RotateCcw, Undo2, ArrowUpDown, Clock, Crown } from 'lucide-react';
import { useVip } from '../context/VipContext';
import { AiDifficulty, chooseBestChessMove, getCapturedMaterial } from '../utils/chessEngine';
import { playUiSound } from '../utils/soundFx';

const UNICODE_PIECES: Record<string, string> = {
  wp: '♙',
  wn: '♘',
  wb: '♗',
  wr: '♖',
  wq: '♕',
  wk: '♔',
  bp: '♟',
  bn: '♞',
  bb: '♝',
  br: '♜',
  bq: '♛',
  bk: '♚',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ChessView() {
  const { t, settings, triggerMascot } = useVip();

  const [gameMode, setGameMode] = useState<'ai' | 'pvp'>('ai');
  const [difficulty, setDifficulty] = useState<AiDifficulty>('medium');
  const [timeControlSec, setTimeControlSec] = useState<number>(600); // 10 min default, 0 = untimed
  const [flipped, setFlipped] = useState(false);

  const [fen, setFen] = useState(() => new Chess().fen());
  const [history, setHistory] = useState<string[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalTargets, setLegalTargets] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [promotionPending, setPromotionPending] = useState<{ from: Square; to: Square } | null>(null);
  const [aiThinking, setAiThinking] = useState(false);

  const [whiteClock, setWhiteClock] = useState(600);
  const [blackClock, setBlackClock] = useState(600);
  const [timedOutWinner, setTimedOutWinner] = useState<'w' | 'b' | null>(null);

  const aiTimerRef = useRef<number | null>(null);

  const chess = new Chess(fen);
  const turn = chess.turn();
  const isCheck = chess.inCheck();
  const isCheckmate = chess.isCheckmate();
  const isStalemate = chess.isStalemate();
  const isDraw = chess.isDraw();
  const gameOver = chess.isGameOver() || timedOutWinner !== null;

  const resetGame = useCallback(
    (newTimeSec = timeControlSec) => {
      if (aiTimerRef.current) window.clearTimeout(aiTimerRef.current);
      setFen(new Chess().fen());
      setHistory([]);
      setSelectedSquare(null);
      setLegalTargets([]);
      setLastMove(null);
      setPromotionPending(null);
      setAiThinking(false);
      setWhiteClock(newTimeSec);
      setBlackClock(newTimeSec);
      setTimedOutWinner(null);
      playUiSound('click', settings.soundEnabled, settings.soundVolume);
    },
    [timeControlSec, settings.soundEnabled, settings.soundVolume]
  );

  // Chess Clocks countdown
  useEffect(() => {
    if (timeControlSec === 0 || gameOver || history.length === 0) return;
    const interval = window.setInterval(() => {
      if (turn === 'w') {
        setWhiteClock((prev) => {
          if (prev <= 1) {
            setTimedOutWinner('b');
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackClock((prev) => {
          if (prev <= 1) {
            setTimedOutWinner('w');
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timeControlSec, turn, gameOver, history.length]);

  // AI Turn Execution (Non-blocking via setTimeout + safe try/finally)
  useEffect(() => {
    if (gameMode !== 'ai' || turn !== 'b' || gameOver) {
      setAiThinking(false);
      return;
    }
    setAiThinking(true);

    aiTimerRef.current = window.setTimeout(() => {
      try {
        const move = chooseBestChessMove(fen, difficulty);
        if (move) {
          const nextChess = new Chess(fen);
          const played = nextChess.move(move);
          setFen(nextChess.fen());
          setHistory((prev) => [...prev, played.san]);
          setLastMove({ from: played.from, to: played.to });

          if (nextChess.isCheckmate()) {
            playUiSound('win', settings.soundEnabled, settings.soundVolume);
            triggerMascot('chess', 'Checkmate by AI!');
          } else if (nextChess.inCheck()) {
            playUiSound('check', settings.soundEnabled, settings.soundVolume);
          } else if (played.captured) {
            playUiSound('capture', settings.soundEnabled, settings.soundVolume);
          } else {
            playUiSound('move', settings.soundEnabled, settings.soundVolume);
          }
        }
      } catch {
        // Ignore stale FEN error and recover turn control
      } finally {
        setAiThinking(false);
      }
    }, 180);

    return () => {
      if (aiTimerRef.current) window.clearTimeout(aiTimerRef.current);
    };
  }, [fen, gameMode, turn, difficulty, gameOver, settings.soundEnabled, settings.soundVolume, triggerMascot]);

  const executePlayerMove = (from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n') => {
    const nextChess = new Chess(fen);
    try {
      const move = nextChess.move({ from, to, promotion: promotion || 'q' });
      setFen(nextChess.fen());
      setHistory((prev) => [...prev, move.san]);
      setLastMove({ from: move.from, to: move.to });
      setSelectedSquare(null);
      setLegalTargets([]);
      setPromotionPending(null);

      if (nextChess.isCheckmate()) {
        playUiSound('win', settings.soundEnabled, settings.soundVolume);
        triggerMascot('celebrate', 'Checkmate! Brilliant victory!');
      } else if (nextChess.inCheck()) {
        playUiSound('check', settings.soundEnabled, settings.soundVolume);
      } else if (move.captured) {
        playUiSound('capture', settings.soundEnabled, settings.soundVolume);
      } else {
        playUiSound('move', settings.soundEnabled, settings.soundVolume);
      }
    } catch {
      setSelectedSquare(null);
      setLegalTargets([]);
    }
  };

  const handleSquareClick = (sq: Square) => {
    if (gameOver || aiThinking || (gameMode === 'ai' && turn === 'b')) return;

    if (selectedSquare && legalTargets.includes(sq)) {
      const piece = chess.get(selectedSquare);
      const isPromotion =
        piece?.type === 'p' &&
        ((piece.color === 'w' && sq.endsWith('8')) || (piece.color === 'b' && sq.endsWith('1')));
      if (isPromotion) {
        setPromotionPending({ from: selectedSquare, to: sq });
        return;
      }
      executePlayerMove(selectedSquare, sq);
      return;
    }

    const clickedPiece = chess.get(sq);
    if (clickedPiece && clickedPiece.color === turn) {
      setSelectedSquare(sq);
      const moves = chess.moves({ square: sq, verbose: true });
      setLegalTargets(moves.map((m) => m.to));
    } else {
      setSelectedSquare(null);
      setLegalTargets([]);
    }
  };

  const handleUndo = () => {
    if (history.length === 0 || aiThinking) return;
    const replay = new Chess();
    const stepsToDrop = gameMode === 'ai' && turn === 'w' && history.length >= 2 ? 2 : 1;
    const nextHistory = history.slice(0, history.length - stepsToDrop);
    for (const san of nextHistory) {
      replay.move(san);
    }
    setFen(replay.fen());
    setHistory(nextHistory);
    setSelectedSquare(null);
    setLegalTargets([]);
    setLastMove(null);
    setTimedOutWinner(null);
    playUiSound('click', settings.soundEnabled, settings.soundVolume);
  };

  const board = chess.board();
  const displayRanks = flipped ? [...RANKS].reverse() : RANKS;
  const displayFiles = flipped ? [...FILES].reverse() : FILES;
  const captured = getCapturedMaterial(fen);

  const statusText = timedOutWinner
    ? `${t.chess.timeout} — ${timedOutWinner === 'w' ? 'White' : 'Black'}`
    : isCheckmate
      ? `${t.chess.checkmate}! ${turn === 'w' ? 'Black' : 'White'} wins`
      : isStalemate
        ? t.chess.stalemate
        : isDraw
          ? t.chess.draw
          : aiThinking
            ? t.chess.aiThinking
            : `${turn === 'w' ? t.chess.whiteTurn : t.chess.blackTurn}${isCheck ? ` · ${t.chess.check}` : ''}`;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            {t.chess.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t.chess.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 rounded-lg bg-slate-200/80 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                setGameMode('ai');
                resetGame();
              }}
              className={`px-3 py-1.5 rounded text-xs font-medium ${
                gameMode === 'ai' ? 'bg-white dark:bg-slate-900 shadow-xs' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {t.chess.modeAi}
            </button>
            <button
              type="button"
              onClick={() => {
                setGameMode('pvp');
                resetGame();
              }}
              className={`px-3 py-1.5 rounded text-xs font-medium ${
                gameMode === 'pvp' ? 'bg-white dark:bg-slate-900 shadow-xs' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {t.chess.modePvp}
            </button>
          </div>

          {gameMode === 'ai' && (
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as AiDifficulty)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium"
            >
              <option value="easy">{t.chess.easy}</option>
              <option value="medium">{t.chess.medium}</option>
              <option value="hard">{t.chess.hard}</option>
            </select>
          )}

          <select
            value={timeControlSec}
            onChange={(e) => {
              const sec = Number(e.target.value);
              setTimeControlSec(sec);
              resetGame(sec);
            }}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium"
          >
            <option value={0}>{t.chess.untimed}</option>
            <option value={180}>{t.chess.blitz}</option>
            <option value={600}>{t.chess.rapid}</option>
            <option value={1800}>{t.chess.classical}</option>
          </select>

          <button
            type="button"
            onClick={() => resetGame()}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.chess.newGame}</span>
          </button>
        </div>
      </div>

      {/* Main Board & Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 flex flex-col items-center space-y-3">
          {/* Top Player / Clock Bar */}
          <div className="w-full max-w-[540px] flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722]">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Crown className="w-4 h-4 text-slate-400" />
              <span>{flipped ? 'White' : gameMode === 'ai' ? `AI (${t.chess[difficulty]})` : 'Black'}</span>
              <span className="text-sm tracking-tight">
                {(flipped ? captured.capturedByWhite : captured.capturedByBlack)
                  .map((p) => UNICODE_PIECES[`${flipped ? 'b' : 'w'}${p}`])
                  .join('')}
              </span>
            </div>
            {timeControlSec > 0 && (
              <div className="font-mono tabular-nums text-sm font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{formatClock(flipped ? whiteClock : blackClock)}</span>
              </div>
            )}
          </div>

          {/* 8x8 Chessboard (LTR forced for standard algebraic layout) */}
          <div
            dir="ltr"
            className="relative w-full max-w-[540px] aspect-square rounded-xl overflow-hidden border-4 border-slate-800 dark:border-slate-700 shadow-lg grid grid-cols-8 grid-rows-8 select-none"
          >
            {displayRanks.map((rank) =>
              displayFiles.map((file) => {
                const sq = `${file}${rank}` as Square;
                const rIdx = RANKS.indexOf(rank);
                const cIdx = FILES.indexOf(file);
                const isLight = (rIdx + cIdx) % 2 === 0;
                const piece = board[rIdx][cIdx];
                const isSelected = selectedSquare === sq;
                const isTarget = legalTargets.includes(sq);
                const isLast = lastMove?.from === sq || lastMove?.to === sq;
                const isKingInCheck = isCheck && piece?.type === 'k' && piece.color === turn;

                return (
                  <button
                    key={sq}
                    type="button"
                    onClick={() => handleSquareClick(sq)}
                    className={`relative flex items-center justify-center text-3xl sm:text-4xl transition-colors focus:outline-none ${
                      isKingInCheck
                        ? 'bg-rose-500/80'
                        : isSelected
                          ? 'bg-blue-500/70'
                          : isLast
                            ? isLight
                              ? 'bg-amber-200/80'
                              : 'bg-amber-600/60'
                            : isLight
                              ? 'bg-[#E6DEC8]'
                              : 'bg-[#76583E]'
                    }`}
                    aria-label={`Square ${sq}`}
                  >
                    {piece && (
                      <span
                        className={`leading-none drop-shadow-xs ${
                          piece.color === 'w' ? 'text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]' : 'text-slate-950'
                        }`}
                      >
                        {UNICODE_PIECES[`${piece.color}${piece.type}`]}
                      </span>
                    )}
                    {isTarget && !piece && (
                      <span className="w-3 h-3 rounded-full bg-slate-900/35" />
                    )}
                    {isTarget && piece && (
                      <span className="absolute inset-1 rounded-full border-2 border-slate-900/50 pointer-events-none" />
                    )}
                  </button>
                );
              })
            )}

            {/* Promotion Picker Overlay */}
            {promotionPending && (
              <div className="absolute inset-0 bg-black/65 flex items-center justify-center z-20">
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-700 space-y-3 text-center">
                  <p className="text-xs font-semibold">{t.chess.choosePromotion}</p>
                  <div className="flex items-center gap-2">
                    {(['q', 'r', 'b', 'n'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => executePlayerMove(promotionPending.from, promotionPending.to, p)}
                        className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-3xl flex items-center justify-center"
                      >
                        {UNICODE_PIECES[`${turn}${p}`]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Player / Clock Bar */}
          <div className="w-full max-w-[540px] flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722]">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Crown className="w-4 h-4 text-amber-500" />
              <span>{flipped ? (gameMode === 'ai' ? 'AI' : 'Black') : 'White'}</span>
              <span className="text-sm tracking-tight">
                {(flipped ? captured.capturedByBlack : captured.capturedByWhite)
                  .map((p) => UNICODE_PIECES[`${flipped ? 'w' : 'b'}${p}`])
                  .join('')}
              </span>
            </div>
            {timeControlSec > 0 && (
              <div className="font-mono tabular-nums text-sm font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{formatClock(flipped ? blackClock : whiteClock)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Status, Controls & Move History */}
        <aside className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
          <div className="p-3.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">{statusText}</span>
            {captured.advantageWhite !== 0 && (
              <span className="font-mono tabular-nums text-xs text-slate-500">
                {captured.advantageWhite > 0
                  ? `+${captured.advantageWhite} W`
                  : `+${Math.abs(captured.advantageWhite)} B`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length === 0 || aiThinking}
              className="flex-1 py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>{t.chess.undo}</span>
            </button>
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="flex-1 py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center justify-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>{t.chess.flipBoard}</span>
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-semibold text-sm">{t.chess.moveHistory}</h3>
            {history.length === 0 ? (
              <p className="text-xs text-slate-500">{t.common.empty}</p>
            ) : (
              <div
                dir="ltr"
                className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 p-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs tabular-nums"
              >
                {Array.from({ length: Math.ceil(history.length / 2) }, (_, idx) => (
                  <React.Fragment key={idx}>
                    <div className="text-slate-700 dark:text-slate-200">
                      <span className="text-slate-400 mr-2">{idx + 1}.</span>
                      {history[idx * 2]}
                    </div>
                    <div className="text-slate-700 dark:text-slate-200">
                      {history[idx * 2 + 1] || ''}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
