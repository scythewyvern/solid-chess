import { createMemo } from 'solid-js'
import type { Accessor } from 'solid-js'

import { capturedPieces, findKing, getGameStatus, isInCheck, materialScore } from './engine'
import type { GameState, MaterialScore, Move, PieceType, Square } from './engine'
import { moveLabel } from './labels'

export interface MoveRow {
  n: number
  white: string
  black: string
}

export interface GameMeta {
  status: Accessor<ReturnType<typeof getGameStatus>>
  inCheck: Accessor<boolean>
  checkSquare: Accessor<Square | null>
  lastMove: Accessor<Move | null>
  movePairs: Accessor<MoveRow[]>
  score: Accessor<MaterialScore>
  takenByWhite: Accessor<PieceType[]>
  takenByBlack: Accessor<PieceType[]>
}

// Pure derivations over position + history. No input state, no side effects.
export function useGameMeta(game: Accessor<GameState>, history: Accessor<Move[]>): GameMeta {
  let status = createMemo(() => getGameStatus(game()))
  let inCheck = createMemo(() => isInCheck(game(), game().turn))
  let checkSquare = createMemo<Square | null>(() => {
    if (inCheck() === false) return null
    return findKing(game().board, game().turn)
  })
  let lastMove = createMemo<Move | null>(() => {
    let h = history()
    return h.length > 0 ? (h[h.length - 1] as Move) : null
  })
  let movePairs = createMemo<MoveRow[]>(() => {
    let h = history()
    let rows: MoveRow[] = []
    let i = 0
    while (i < h.length) {
      let w = h[i] as Move
      let b = h[i + 1] as Move | undefined
      rows.push({
        n: i / 2 + 1,
        white: moveLabel(w),
        black: b === undefined ? '' : moveLabel(b),
      })
      i = i + 2
    }
    return rows
  })
  let score = createMemo(() => materialScore(game().board))
  let takenByWhite = createMemo(() => capturedPieces(game().board, 'white'))
  let takenByBlack = createMemo(() => capturedPieces(game().board, 'black'))

  return {
    status,
    inCheck,
    checkSquare,
    lastMove,
    movePairs,
    score,
    takenByWhite,
    takenByBlack,
  }
}
