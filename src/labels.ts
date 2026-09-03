import { getGameStatus, isInCheck, squareName } from './engine'
import type { Color, GameState, Move, Piece, PieceType, Square } from './engine'

export let FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

export let PIECE_NAMES: Record<PieceType, string> = {
  pawn: 'pawn',
  knight: 'knight',
  bishop: 'bishop',
  rook: 'rook',
  queen: 'queen',
  king: 'king',
}

export let COLOR_NAMES: Record<Color, string> = {
  white: 'White',
  black: 'Black',
}

export function moveLabel(move: Move): string {
  return (
    squareName(move.from) + ' → ' + squareName(move.to) + (move.promotion ? `=${move.promotion}` : '')
  )
}

export function squareAriaLabel(square: Square, piece: Piece | null, isTarget: boolean): string {
  let name = squareName(square)
  if (piece === null) {
    return isTarget ? `Move to ${name}` : name
  }
  return `${COLOR_NAMES[piece.color]} ${PIECE_NAMES[piece.type]}, ${name}`
}

export function engineStatusText(game: GameState): string {
  let s = getGameStatus(game)
  if (s.status === 'checkmate') {
    let winner = s.winner === 'white' ? 'White' : 'Black'
    return `Checkmate! ${winner} wins`
  }
  if (s.status === 'stalemate') return 'Stalemate — draw'
  if (s.status === 'draw-fifty') return 'Draw — fifty-move rule'
  if (s.status === 'draw-material') return 'Draw — insufficient material'
  let turn = COLOR_NAMES[game.turn]
  return isInCheck(game, game.turn) ? `${turn} to move — check!` : `${turn} to move`
}
