import { createDraggable, createDroppable } from '@solid-primitives/drag-drop'
import { Show } from 'solid-js'
import type { Accessor } from 'solid-js'

import { legalMoves, parseSquare, sameSquare, squareName } from './engine'
import type { Color, GameState, Move, Piece, Square } from './engine'
import type { FlyPiece } from './use-fly-animation'
import type { IconName } from './icon/icons'
import { PieceIcon } from './piece-icon'
import { FILES, squareAriaLabel } from './labels'

export interface SquareView {
  turn: Color
  selected: Square | null
  lastMove: Move | null
  targets: Move[]
  checkSquare: Square | null
  flyingTo: boolean
  isOver: boolean
  occupant: Piece | null
}

export function cellClass(row: number, col: number, view: SquareView): string {
  let classes = ['cell', (row + col) % 2 === 0 ? 'odd' : 'even']
  let square = { row, col }
  if (view.selected !== null && sameSquare(view.selected, square)) classes.push('is-selected')
  let lm = view.lastMove
  if (lm !== null && (sameSquare(lm.from, square) || sameSquare(lm.to, square))) {
    classes.push('is-last')
  }
  let target = view.targets.find((m) => sameSquare(m.to, square))
  if (target !== undefined) {
    classes.push(
      view.occupant !== null && view.occupant.color !== view.turn ? 'is-capture' : 'is-target',
    )
  }
  if (view.isOver && target !== undefined) classes.push('is-over')
  if (view.checkSquare !== null && sameSquare(view.checkSquare, square)) classes.push('is-check')
  if (view.flyingTo) classes.push('is-flying-to')
  return classes.join(' ')
}

export interface SquareCellProps {
  row: number
  col: number
  game: Accessor<GameState>
  canControl: (color: Color) => boolean
  inputLocked: () => boolean
  gameOngoing: () => boolean
  promoOpen: () => boolean
  selected: Accessor<Square | null>
  lastMove: Accessor<Move | null>
  targets: Accessor<Move[]>
  checkSquare: Accessor<Square | null>
  fly: Accessor<FlyPiece[] | null>
  onTap: (square: Square) => void
  onDropSquares: (fromName: string, toName: string) => void
  onGrabSquare: (name: string) => void
  onDragCancel: () => void
}

// One board square: drop target, click target and (when it holds a movable
// piece) drag source. All state arrives via accessors so each cell tracks
// only what it renders — selecting a piece never remounts the board.
export function SquareCell(props: SquareCellProps) {
  let name = squareName({ row: props.row, col: props.col })
  let piece = () => props.game().board[props.row][props.col]

  let drop = createDroppable(name, undefined, {
    accept: (draggable) => {
      try {
        if (props.inputLocked()) return false
        let from = parseSquare(String(draggable.id))
        let g = props.game()
        let mover = g.board[from.row][from.col]
        if (mover === null || mover.color !== g.turn || props.canControl(mover.color) === false) {
          return false
        }
        return legalMoves(g, from).some((m) => m.to.row === props.row && m.to.col === props.col)
      } catch {
        return false
      }
    },
    overClass: 'is-over',
  })

  let drag = createDraggable(name, undefined, {
    class: 'piece-drag',
    draggingClass: 'is-dragging',
    disabled: () => {
      if (props.gameOngoing() === false || props.promoOpen() || props.inputLocked()) return true
      let p = piece()
      return p === null || p.color !== props.game().turn || props.canControl(p.color) === false
    },
  })

  let dragStyle = () => {
    let t = drag.transform()
    return t === null ? {} : { transform: `translate(${t.x}px, ${t.y}px)` }
  }

  function viewClass(): string {
    let g = props.game()
    let square = { row: props.row, col: props.col }
    return cellClass(props.row, props.col, {
      turn: g.turn,
      selected: props.selected(),
      lastMove: props.lastMove(),
      targets: props.targets(),
      checkSquare: props.checkSquare(),
      flyingTo: props.fly()?.some((f) => sameSquare(f.to, square)) ?? false,
      isOver: drop.isOver(),
      occupant: piece(),
    })
  }

  function label(): string {
    let square = { row: props.row, col: props.col }
    let isTarget = props.targets().some((m) => sameSquare(m.to, square))
    return squareAriaLabel(square, piece(), isTarget)
  }

  return (
    <button
      type='button'
      role='gridcell'
      ref={drop.ref}
      class={viewClass()}
      aria-label={label()}
      onClick={() => props.onTap({ row: props.row, col: props.col })}
    >
      <Show when={piece()}>
        {(p) => (
          <span ref={drag.ref} class='piece' style={dragStyle()}>
            <PieceIcon name={`${p().color}-${p().type}` as IconName} />
          </span>
        )}
      </Show>
      <Show when={props.col === 0}>
        <span class='coord rank'>{8 - props.row}</span>
      </Show>
      <Show when={props.row === 7}>
        <span class='coord file'>{FILES[props.col]}</span>
      </Show>
    </button>
  )
}
