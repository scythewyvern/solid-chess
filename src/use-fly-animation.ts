import { createRenderEffect, createSignal, onCleanup } from 'solid-js'
import type { Accessor } from 'solid-js'

import type { Board, Color, GameState, Move, PieceType, Square } from './engine'

export interface FlyPiece {
  from: Square
  to: Square
  color: Color
  type: PieceType
}

export interface FlyAnimation {
  fly: Accessor<FlyPiece[] | null>
  suppressNext: () => void
  clear: () => void
  display: (index: number) => number
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

function buildFly(move: Move, board: Board): FlyPiece[] | null {
  let piece = board[move.from.row][move.from.col]
  if (piece === null) return null
  let out: FlyPiece[] = [{ from: move.from, to: move.to, color: piece.color, type: piece.type }]
  if (
    piece.type === 'king' &&
    move.from.row === move.to.row &&
    Math.abs(move.to.col - move.from.col) === 2
  ) {
    let cornerCol = move.to.col === 6 ? 7 : 0
    let rookToCol = move.to.col === 6 ? 5 : 3
    let rook = board[move.from.row][cornerCol]
    if (rook !== null && rook.type === 'rook') {
      out.push({
        from: { row: move.from.row, col: cornerCol },
        to: { row: move.from.row, col: rookToCol },
        color: rook.color,
        type: 'rook',
      })
    }
  }
  return out
}

// Slide overlay for every history growth (clicks, own online moves on echo,
// opponent moves). Drag-and-drop calls suppressNext since the piece already
// travelled with the pointer. A render effect (not a user effect) so the
// overlay and the hidden target paint in the same frame.
export function useFlyAnimation(
  game: Accessor<GameState>,
  history: Accessor<Move[]>,
  orientation: Accessor<Color>,
): FlyAnimation {
  let [fly, setFly] = createSignal<FlyPiece[] | null>(null)
  let suppress = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let prevLen = 0
  let prevBoard: Board | null = null

  onCleanup(() => {
    if (timer !== null) clearTimeout(timer)
  })

  function clear() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    setFly(null)
  }

  function suppressNext() {
    suppress = true
  }

  function display(index: number): number {
    return orientation() === 'white' ? index : 7 - index
  }

  createRenderEffect(
    () => ({ history: history(), board: game().board }),
    (next) => {
      let h = next.history
      if (h.length === prevLen + 1 && suppress === false && prevBoard !== null) {
        let move = h[h.length - 1] as Move
        let built = prefersReducedMotion() ? null : buildFly(move, prevBoard)
        if (built !== null) {
          clear()
          setFly(built)
          timer = setTimeout(clear, 260)
        }
      } else if (h.length !== prevLen) {
        clear()
      }
      suppress = false
      prevLen = h.length
      prevBoard = next.board
    },
  )

  return { fly, suppressNext, clear, display }
}
