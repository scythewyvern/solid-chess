import { createSignal, onCleanup } from 'solid-js'
import type { Accessor } from 'solid-js'

import { aiLevelName, chooseMove } from './ai'
import type { AiLevel } from './ai'
import { applyMove, getGameStatus, initialGameState } from './engine'
import type { Color, GameState, Move, PieceType, Square } from './engine'
import type { GameDriver } from './game-driver'
import { engineStatusText } from './labels'

export interface ComputerOpts {
  human: () => Color
  level: () => AiLevel
}

// The computer answers on a short delay so its move reads as a reply, and
// the synchronous search never blocks the click handler mid-gesture.
let THINK_MS = 350

export interface ComputerGame {
  driver: GameDriver
  thinking: Accessor<boolean>
  human: Accessor<Color>
  level: Accessor<AiLevel>
  undo: () => void
  restart: () => void
  canUndo: Accessor<boolean>
}

export function useComputerGame(opts: ComputerOpts): ComputerGame {
  let [game, setGame] = createSignal<GameState>(initialGameState())
  let [history, setHistory] = createSignal<Move[]>([])
  let [past, setPast] = createSignal<GameState[]>([])
  let [thinking, setThinking] = createSignal(false)

  let timer: ReturnType<typeof setTimeout> | null = null

  onCleanup(() => {
    if (timer !== null) clearTimeout(timer)
  })

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function pushState(next: GameState, move: Move) {
    setPast((p) => [...p, game()])
    setGame(next)
    setHistory((h) => [...h, move])
  }

  function answerIfNeeded(current: GameState) {
    let human = opts.human()
    if (getGameStatus(current).status !== 'ongoing') return
    if (current.turn === human) return
    setThinking(true)
    clearTimer()
    timer = setTimeout(() => {
      timer = null
      let latest = game()
      // The player may have hit undo while the computer was "thinking".
      if (latest.turn === opts.human()) {
        setThinking(false)
        return
      }
      if (getGameStatus(latest).status !== 'ongoing') {
        setThinking(false)
        return
      }
      let choice = chooseMove(latest, opts.level())
      if (choice.move === null) {
        setThinking(false)
        return
      }
      pushState(applyMove(latest, choice.move), choice.move)
      setThinking(false)
    }, THINK_MS)
  }

  function submitMove(from: Square, to: Square, promotion?: PieceType) {
    if (getGameStatus(game()).status !== 'ongoing') return
    // Only the human side goes through input; the engine answers itself.
    if (game().turn !== opts.human()) return
    let move: Move = { from, to, promotion }
    let next = applyMove(game(), move)
    pushState(next, move)
    answerIfNeeded(next)
  }

  function undo() {
    if (thinking()) return
    clearTimer()
    let stack = past()
    if (stack.length === 0) return
    // Take back the pair: the computer's reply plus the human move before
    // it, so the player always gets the move back.
    if (game().turn !== opts.human() || stack.length === 1) {
      let prev = stack[stack.length - 1] as GameState
      setPast(stack.slice(0, -1))
      setGame(prev)
      setHistory((h) => h.slice(0, -1))
    } else {
      let prev = stack[stack.length - 2] as GameState
      setPast(stack.slice(0, -2))
      setGame(prev)
      setHistory((h) => h.slice(0, -2))
    }
    // Undoing the opener as black hands the move back to the engine.
    answerIfNeeded(game())
  }

  function restart() {
    clearTimer()
    setThinking(false)
    setGame(initialGameState())
    setHistory([])
    setPast([])
    answerIfNeeded(initialGameState())
  }

  // When the human takes black the engine opens the game. One-shot, not an
  // effect: human and level are fixed for the session.
  if (opts.human() === 'black') {
    answerIfNeeded(initialGameState())
  }

  function statusText(): string {
    let base = engineStatusText(game())
    if (thinking()) return `${base} — ${aiLevelName(opts.level())} is thinking…`
    return base
  }

  function presence(): string {
    return `You play ${opts.human() === 'white' ? 'White' : 'Black'} · ${aiLevelName(opts.level())}`
  }

  let driver: GameDriver = {
    game,
    history,
    orientation: () => opts.human(),
    canControl: (c) => c === opts.human() && thinking() === false,
    inputLocked: () => getGameStatus(game()).status !== 'ongoing' || thinking(),
    statusText,
    turnDot: () => (getGameStatus(game()).status === 'ongoing' ? game().turn : null),
    presence,
    submitMove,
  }

  return {
    driver,
    thinking,
    human: () => opts.human(),
    level: () => opts.level(),
    undo,
    restart,
    canUndo: () => past().length > 0 && thinking() === false,
  }
}
