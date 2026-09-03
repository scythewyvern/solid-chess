import { createSignal } from 'solid-js'
import type { Accessor } from 'solid-js'

import { applyMove, getGameStatus, initialGameState } from './engine'
import type { GameState, Move, PieceType, Square } from './engine'
import type { GameDriver } from './game-driver'
import { engineStatusText } from './labels'

export interface LocalGame {
  driver: GameDriver
  undo: () => void
  restart: () => void
  canUndo: Accessor<boolean>
}

export function useLocalGame(): LocalGame {
  let [game, setGame] = createSignal<GameState>(initialGameState())
  let [history, setHistory] = createSignal<Move[]>([])
  let [past, setPast] = createSignal<GameState[]>([])

  function submitMove(from: Square, to: Square, promotion?: PieceType) {
    if (getGameStatus(game()).status !== 'ongoing') return
    let next = applyMove(game(), { from, to, promotion })
    setPast((p) => [...p, game()])
    setGame(next)
    setHistory((h) => [...h, { from, to, promotion }])
  }

  function restart() {
    setGame(initialGameState())
    setHistory([])
    setPast([])
  }

  function undo() {
    let stack = past()
    if (stack.length === 0) return
    let prev = stack[stack.length - 1] as GameState
    setPast(stack.slice(0, -1))
    setGame(prev)
    setHistory((h) => h.slice(0, -1))
  }

  let driver: GameDriver = {
    game,
    history,
    orientation: () => 'white',
    canControl: () => true,
    inputLocked: () => getGameStatus(game()).status !== 'ongoing',
    statusText: () => engineStatusText(game()),
    turnDot: () => (getGameStatus(game()).status === 'ongoing' ? game().turn : null),
    presence: () => null,
    submitMove,
  }

  return { driver, undo, restart, canUndo: () => past().length > 0 }
}
