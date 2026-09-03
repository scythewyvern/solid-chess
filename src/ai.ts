import { allLegalMoves, applyMove, getGameStatus, PIECE_VALUES } from './engine'
import type { GameState, Move } from './engine'

export type AiLevel = 'easy' | 'medium' | 'hard'

export let AI_DEPTHS: Record<AiLevel, number> = { easy: 1, medium: 2, hard: 3 }

let MATE_SCORE = 100000

// Score from the point of view of the side to move. Positive is good for
// them, negative is good for the opponent — this keeps the negamax below
// a plain negation at every ply.
function evaluate(state: GameState): number {
  let status = getGameStatus(state)
  if (status.status === 'checkmate') {
    return status.winner === state.turn ? MATE_SCORE : -MATE_SCORE
  }
  if (status.status !== 'ongoing') {
    return 0
  }
  let mine = 0
  let theirs = 0
  for (let row of state.board) {
    for (let cell of row) {
      if (cell === null) continue
      if (cell.color === state.turn) {
        mine = mine + PIECE_VALUES[cell.type]
      } else {
        theirs = theirs + PIECE_VALUES[cell.type]
      }
    }
  }
  return mine - theirs
}

function search(state: GameState, depth: number, alpha: number, beta: number): number {
  let status = getGameStatus(state)
  if (status.status !== 'ongoing' || depth === 0) {
    return evaluate(state)
  }
  let moves = orderMoves(state, allLegalMoves(state))
  if (moves.length === 0) {
    return evaluate(state)
  }
  let best = -Infinity
  for (let move of moves) {
    let score = -search(applyMove(state, move), depth - 1, -beta, -alpha)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

// Captures first (biggest victim, cheapest attacker), promotions first —
// cheap ordering that buys far more alpha-beta cutoffs on depth 2-3.
function orderMoves(state: GameState, moves: Move[]): Move[] {
  return [...moves].sort((a, b) => moveWeight(state, b) - moveWeight(state, a))
}

function moveWeight(state: GameState, move: Move): number {
  let weight = 0
  let target = state.board[move.to.row][move.to.col]
  if (target !== null) {
    weight = weight + 10 * PIECE_VALUES[target.type]
    let attacker = state.board[move.from.row][move.from.col]
    if (attacker !== null) weight = weight - PIECE_VALUES[attacker.type]
  }
  if (move.promotion !== undefined) {
    weight = weight + 10 * PIECE_VALUES[move.promotion]
  }
  return weight
}

export interface AiChoice {
  move: Move | null
  score: number
}

export function chooseMove(state: GameState, level: AiLevel): AiChoice {
  let moves = orderMoves(state, allLegalMoves(state))
  if (moves.length === 0) {
    return { move: null, score: evaluate(state) }
  }
  // Easy plays fast and loose at depth 1 with jitter, so the same position
  // does not always get the same reply.
  if (level === 'easy') {
    let scored = moves.map((move) => ({
      move,
      score: -evaluate(applyMove(state, move)) + Math.random() * 0.6,
    }))
    scored.sort((a, b) => b.score - a.score)
    let best = scored[0]
    if (best === undefined) return { move: null, score: 0 }
    return { move: best.move, score: best.score }
  }
  let depth = AI_DEPTHS[level]
  let bestMove: Move | null = null
  let bestScore = -Infinity
  let alpha = -Infinity
  for (let move of moves) {
    let score = -search(applyMove(state, move), depth - 1, -Infinity, -alpha)
    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }
    if (score > alpha) alpha = score
  }
  return { move: bestMove, score: bestScore }
}

export function aiLevelName(level: AiLevel): string {
  if (level === 'easy') return 'Easy'
  if (level === 'medium') return 'Medium'
  return 'Hard'
}
