import { createMemo, createSignal } from 'solid-js'
import type { Accessor } from 'solid-js'

import { getGameStatus, legalMoves, parseSquare, sameSquare } from './engine'
import type { Move, PieceType, Square } from './engine'
import type { GameDriver } from './game-driver'

export type TargetResolution = 'moved' | 'promo' | 'none'

export interface PendingPromo {
  from: Square
  to: Square
}

export interface MoveInput {
  selected: Accessor<Square | null>
  promo: Accessor<PendingPromo | null>
  targets: Accessor<Move[]>
  tapSquare: (square: Square) => void
  dropSquares: (fromName: string, toName: string) => void
  grabSquare: (name: string) => void
  cancelDrag: () => void
  choosePromotion: (type: PieceType) => void
  cancelPromo: () => void
}

// Click and drag-and-drop orchestration over a driver. Both paths share
// resolveTarget, so legality, promotion and gating behave identically.
export function useMoveInput(driver: GameDriver, onDropMove: () => void): MoveInput {
  let [selected, setSelected] = createSignal<Square | null>(null)
  let [promo, setPromo] = createSignal<PendingPromo | null>(null)

  let targets = createMemo<Move[]>(() => {
    let sel = selected()
    if (sel === null) return []
    return legalMoves(driver.game(), sel)
  })

  function clear() {
    setSelected(null)
    setPromo(null)
  }

  function submit(from: Square, to: Square, promotion?: PieceType) {
    driver.submitMove(from, to, promotion)
    clear()
  }

  function resolveTarget(from: Square, to: Square, viaDrop: boolean): TargetResolution {
    if (getGameStatus(driver.game()).status !== 'ongoing') return 'none'
    if (driver.inputLocked()) return 'none'
    if (promo() !== null) return 'none'
    let g = driver.game()
    let mover = g.board[from.row][from.col]
    if (mover === null || mover.color !== g.turn || driver.canControl(mover.color) === false) {
      return 'none'
    }
    let options = legalMoves(g, from).filter((m) => sameSquare(m.to, to))
    if (options.length === 0) return 'none'
    if (options.some((m) => m.promotion !== undefined)) {
      setSelected(from)
      setPromo({ from, to })
      return 'promo'
    }
    if (viaDrop) onDropMove()
    submit(from, to)
    return 'moved'
  }

  function tapSquare(square: Square) {
    let sel = selected()
    if (sel !== null && resolveTarget(sel, square, false) !== 'none') return
    let g = driver.game()
    let piece = g.board[square.row][square.col]
    if (piece !== null && piece.color === g.turn && driver.canControl(piece.color)) {
      setSelected((prev) => (prev !== null && sameSquare(prev, square) ? null : square))
    } else {
      setSelected(null)
    }
  }

  function dropSquares(fromName: string, toName: string) {
    if (fromName === toName) {
      setSelected(null)
      return
    }
    let from = parseSquare(fromName)
    let to = parseSquare(toName)
    if (resolveTarget(from, to, true) === 'none') {
      setSelected(null)
    }
  }

  function grabSquare(name: string) {
    let from = parseSquare(name)
    let g = driver.game()
    if (getGameStatus(g).status !== 'ongoing') return
    if (driver.inputLocked()) return
    let piece = g.board[from.row][from.col]
    if (piece === null || piece.color !== g.turn || driver.canControl(piece.color) === false) return
    setSelected(from)
  }

  function cancelDrag() {
    setSelected(null)
  }

  function choosePromotion(type: PieceType) {
    let pending = promo()
    if (pending === null) return
    submit(pending.from, pending.to, type)
  }

  function cancelPromo() {
    setPromo(null)
  }

  return {
    selected,
    promo,
    targets,
    tapSquare,
    dropSquares,
    grabSquare,
    cancelDrag,
    choosePromotion,
    cancelPromo,
  }
}
