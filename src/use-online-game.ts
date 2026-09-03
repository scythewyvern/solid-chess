import { createSignal, onCleanup } from 'solid-js'
import type { Accessor } from 'solid-js'

import { applyMove, detectMove, getGameStatus, initialGameState } from './engine'
import type { Color, GameState, Move, PieceType, Square } from './engine'
import type { GameDriver } from './game-driver'
import { engineStatusText } from './labels'
import type { ClientMsg, ResignResult, ServerMsg } from './net-protocol'

export type PingLevel = 'good' | 'ok' | 'bad'

export function pingLevel(ping: number | null): PingLevel | null {
  if (ping === null) return null
  if (ping < 120) return 'good'
  if (ping < 300) return 'ok'
  return 'bad'
}

export interface OnlineGame {
  driver: GameDriver
  color: Accessor<Color | null>
  connected: Accessor<boolean>
  opponent: Accessor<boolean>
  result: Accessor<ResignResult | null>
  rematch: Accessor<Record<Color, boolean>>
  room: Accessor<string>
  error: Accessor<string | null>
  ping: Accessor<number | null>
  resign: () => void
  voteRematch: () => void
  disconnect: () => void
}

export interface OnlineOpts {
  create: () => boolean
  room: () => string
}

export function useOnlineGame(url: string, opts: OnlineOpts): OnlineGame {
  let [game, setGame] = createSignal<GameState>(initialGameState())
  let [color, setColor] = createSignal<Color | null>(null)
  let [connected, setConnected] = createSignal(false)
  let [opponent, setOpponent] = createSignal(false)
  let [result, setResult] = createSignal<ResignResult | null>(null)
  let [rematch, setRematch] = createSignal<Record<Color, boolean>>({
    white: false,
    black: false,
  })
  let [room, setRoom] = createSignal('')
  let [error, setError] = createSignal<string | null>(null)
  let [history, setHistory] = createSignal<Move[]>([])
  let [ping, setPing] = createSignal<number | null>(null)

  let prevGame: GameState = initialGameState()
  let lastServer: GameState = initialGameState()
  let pending: Move | null = null
  let startBoardJson = JSON.stringify(initialGameState().board)
  let pingNonce = 0
  let pingSentAt = 0
  let pingTimer: ReturnType<typeof setInterval> | null = null

  let ws = new WebSocket(url)

  function send(msg: ClientMsg): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }

  function sendPing(): void {
    if (ws.readyState !== WebSocket.OPEN) return
    pingNonce = pingNonce + 1
    pingSentAt = Date.now()
    send({ type: 'ping', nonce: pingNonce })
  }

  function startPingLoop(): void {
    sendPing()
    if (pingTimer !== null) return
    pingTimer = setInterval(sendPing, 5000)
  }

  function stopPingLoop(): void {
    if (pingTimer !== null) {
      clearInterval(pingTimer)
      pingTimer = null
    }
  }

  // Authoritative snapshot wins: an optimistic board that matches the
  // server produces no duplicate history entry via detectMove.
  function confirmState(next: GameState): void {
    let moved = detectMove(prevGame, next)
    if (moved !== null) {
      setHistory((h) => [...h, moved])
    } else if (history().length > 0 && JSON.stringify(next.board) === startBoardJson) {
      setHistory([])
    }
    pending = null
    lastServer = next
    prevGame = next
    setGame(next)
    setError(null)
  }

  function revertPending(message: string): void {
    if (pending !== null) {
      pending = null
      prevGame = lastServer
      setGame(lastServer)
      setHistory((h) => h.slice(0, -1))
    }
    setError(message)
  }

  function handleServerMsg(msg: ServerMsg): void {
    if (msg.type === 'room') {
      setRoom(msg.room)
      setColor(msg.color)
    } else if (msg.type === 'state') {
      confirmState(msg.game)
      setResult(msg.result)
      setRematch(msg.rematch)
      setColor(msg.you)
    } else if (msg.type === 'presence') {
      setOpponent(msg.opponent)
    } else if (msg.type === 'error') {
      revertPending(msg.message)
    } else if (msg.type === 'pong') {
      if (msg.nonce !== pingNonce) return
      setPing(Date.now() - pingSentAt)
    }
  }

  ws.onopen = () => {
    setConnected(true)
    startPingLoop()
    if (opts.create()) {
      send({ type: 'create' })
    } else {
      send({ type: 'join', room: opts.room() })
    }
  }
  ws.onclose = () => setConnected(false)
  ws.onerror = () => setConnected(false)
  ws.onmessage = (event: MessageEvent) => {
    if (typeof event.data !== 'string') return
    let msg: ServerMsg
    try {
      msg = JSON.parse(event.data) as ServerMsg
    } catch {
      return
    }
    handleServerMsg(msg)
  }

  onCleanup(() => {
    stopPingLoop()
    try {
      ws.close()
    } catch {
      // socket already closed
    }
  })

  function sendMove(from: Square, to: Square, promotion?: PieceType): void {
    if (connected() === false) return
    let move: Move = { from, to, promotion }
    try {
      let applied = applyMove(game(), move)
      prevGame = applied
      setGame(applied)
      setHistory((h) => [...h, move])
      pending = move
    } catch {
      // Illegal locally: never send, the server would reject it too.
      pending = null
      return
    }
    send({ type: 'move', move })
  }

  function resign(): void {
    send({ type: 'resign' })
  }

  function voteRematch(): void {
    send({ type: 'rematch' })
  }

  function disconnect(): void {
    stopPingLoop()
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
    ping,
    resign,
    voteRematch,
    disconnect,
  }
}
