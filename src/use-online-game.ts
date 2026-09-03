import { createSignal, onCleanup } from 'solid-js'
import type { Accessor } from 'solid-js'

import { detectMove, getGameStatus, initialGameState } from './engine'
import type { Color, GameState, Move, PieceType, Square } from './engine'
import type { GameDriver } from './game-driver'
import { engineStatusText } from './labels'
import type { ClientMsg, ResignResult, ServerMsg } from './net-protocol'

export interface OnlineGame {
  driver: GameDriver
  color: Accessor<Color | null>
  connected: Accessor<boolean>
  opponent: Accessor<boolean>
  result: Accessor<ResignResult | null>
  rematch: Accessor<Record<Color, boolean>>
  room: Accessor<string>
  error: Accessor<string | null>
  resign: () => void
  voteRematch: () => void
  disconnect: () => void
}

export function useOnlineGame(url: string, opts: { create: boolean; room?: string }): OnlineGame {
  let [game, setGame] = createSignal<GameState>(initialGameState())
  let [color, setColor] = createSignal<Color | null>(null)
  let [connected, setConnected] = createSignal(false)
  let [opponent, setOpponent] = createSignal(false)
  let [result, setResult] = createSignal<ResignResult | null>(null)
  let [rematch, setRematch] = createSignal<Record<Color, boolean>>({ white: false, black: false })
  let [room, setRoom] = createSignal('')
  let [error, setError] = createSignal<string | null>(null)
  let [history, setHistory] = createSignal<Move[]>([])

  let prevGame: GameState = initialGameState()
  let startBoardJson = JSON.stringify(initialGameState().board)

  let ws = new WebSocket(url)

  function send(msg: ClientMsg): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }

  ws.onopen = () => {
    setConnected(true)
    if (opts.create) {
      send({ type: 'create' })
    } else {
      send({ type: 'join', room: opts.room ?? '' })
    }
  }
  ws.onclose = () => setConnected(false)
  ws.onerror = () => setConnected(false)
  ws.onmessage = (event: MessageEvent) => {
    if (typeof event.data !== 'string') return
    let raw: unknown = JSON.parse(event.data)
    let msg = raw as ServerMsg
    if (msg.type === 'room') {
      setRoom(msg.room)
      setColor(msg.color)
    } else if (msg.type === 'state') {
      let next = msg.game
      let moved = detectMove(prevGame, next)
      if (moved !== null) {
        setHistory((h) => [...h, moved])
      } else if (history().length > 0 && JSON.stringify(next.board) === startBoardJson) {
        setHistory([])
      }
      prevGame = next
      setGame(next)
      setResult(msg.result)
      setRematch(msg.rematch)
      setColor(msg.you)
    } else if (msg.type === 'presence') {
      setOpponent(msg.opponent)
    } else if (msg.type === 'error') {
      setError(msg.message)
    }
  }

  onCleanup(() => {
    try {
      ws.close()
    } catch {
      // socket already closed
    }
  })

  function sendMove(from: Square, to: Square, promotion?: PieceType): void {
    if (connected() === false) return
    send({ type: 'move', move: { from, to, promotion } })
  }

  function resign(): void {
    send({ type: 'resign' })
  }

  function voteRematch(): void {
    send({ type: 'rematch' })
  }

  function disconnect(): void {
    try {
      ws.close()
    } catch {
      // socket already closed
    }
  }

  function statusText(): string {
    let res = result()
    if (res !== null) {
      if (res.winner === color()) return 'Opponent resigned. You win!'
      return 'You resigned. Opponent wins.'
    }
    return engineStatusText(game())
  }

  function turnDot(): Color | null {
    if (result() !== null) return null
    let g = game()
    return getGameStatus(g).status === 'ongoing' ? g.turn : null
  }

  function presence(): string | null {
    if (connected() === false) return 'Connecting…'
    let c = color()
    let you = c === null ? 'Connected' : `You play ${c === 'white' ? 'White' : 'Black'}`
    return opponent() ? you : `${you} · Waiting for opponent…`
  }

  let driver: GameDriver = {
    game,
    history,
    orientation: () => color() ?? 'white',
    canControl: (c) => connected() && result() === null && color() === c,
    inputLocked: () => getGameStatus(game()).status !== 'ongoing' || result() !== null,
    statusText,
    turnDot,
    presence,
    submitMove: sendMove,
  }

  return {
    driver,
    color,
    connected,
    opponent,
    result,
    rematch,
    room,
    error,
    resign,
    voteRematch,
    disconnect,
  }
}
