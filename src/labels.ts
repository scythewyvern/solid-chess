import { getGameStatus, isInCheck, squareName } from './engine'
import type { Color, GameState, Move, Piece, PieceType, Square } from './engine'
import { t } from './i18n'
import type { Dict } from './i18n'

export let FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

const PIECE_KEYS: Record<PieceType, keyof Dict> = {
  pawn: 'piecePawn',
  knight: 'pieceKnight',
  bishop: 'pieceBishop',
  rook: 'pieceRook',
  queen: 'pieceQueen',
  king: 'pieceKing',
}

// Russian adjectives agree with the piece noun in gender; English ignores it.
const PIECE_GENDER: Record<PieceType, 'm' | 'f'> = {
  pawn: 'f',
  knight: 'm',
  bishop: 'm',
  rook: 'f',
  queen: 'm',
  king: 'm',
}

export function pieceName(type: PieceType): string {
  return t(PIECE_KEYS[type])
}

function colorAdjective(color: Color, gender: 'm' | 'f'): string {
  if (color === 'white') return gender === 'm' ? t('adjWhiteM') : t('adjWhiteF')
  return gender === 'm' ? t('adjBlackM') : t('adjBlackF')
}

export function moveLabel(move: Move): string {
  return (
    squareName(move.from) +
    ' → ' +
    squareName(move.to) +
    (move.promotion ? `=${pieceName(move.promotion)}` : '')
  )
}

export function squareAriaLabel(
  square: Square,
  piece: Piece | null,
  isTarget: boolean
): string {
  let name = squareName(square)
  if (piece === null) {
    return isTarget ? t('moveTo', { sq: name }) : name
  }
  return `${colorAdjective(piece.color, PIECE_GENDER[piece.type])} ${pieceName(piece.type)}, ${name}`
}

export function engineStatusText(game: GameState): string {
  let s = getGameStatus(game)
  if (s.status === 'checkmate') {
    return s.winner === 'white' ? t('checkmateWhite') : t('checkmateBlack')
  }
  if (s.status === 'stalemate') return t('stalemate')
  if (s.status === 'draw-fifty') return t('fifty')
  if (s.status === 'draw-material') return t('materialDraw')
  if (game.turn === 'white') {
    return isInCheck(game, game.turn) ? t('turnWhiteCheck') : t('turnWhite')
  }
  return isInCheck(game, game.turn) ? t('turnBlackCheck') : t('turnBlack')
}
