import { afterAll, beforeAll, test, expect } from 'bun:test'

import {
  getGameStatus,
  initialGameState,
  parseSquare,
  type GameState,
  type Move,
} from '../src/engine'
import type { ServerMsg } from '../src/net-protocol'
import { startServer } from './ws-server'

let srv: { stop: () => void; port: number } | null = null
let port = 0
let allSockets: Array<WebSocket> = []
let inboxes = new Map<WebSocket, Array<ServerMsg>>()

interface Waiter {
  predicate: ((msg: ServerMsg) => boolean) | null
  resolve: (msg: ServerMsg) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

let waiters = new Map<WebSocket, Array<Waiter>>()

function drain(ws: WebSocket): void {
  let q = inboxes.get(ws)
  let list = waiters.get(ws)
  if (q === undefined || list === undefined || list.length === 0) {
    return
  }
  let i = 0
  while (i < list.length) {
    let w = list[i]
    if (w === undefined) {
      i = i + 1
      continue
    }
    let found = -1
    if (w.predicate === null) {
      if (q.length > 0) {
        found = 0
      }
    } else {
      let pred = w.predicate
      let k = 0
      while (k < q.length) {
        let m = q[k]
        if (m !== undefined && pred(m)) {
          found = k
          break
        }
        k = k + 1
      }
    }
    if (found !== -1) {
      let m = q.splice(found, 1)[0]
      list.splice(i, 1)
      clearTimeout(w.timer)
      if (m !== undefined) {
        w.resolve(m)
        continue
      }
      w.reject(new Error('empty message'))
      continue
    }
    i = i + 1
  }
}

function nextMsg(
  ws: WebSocket,
  predicate?: (msg: ServerMsg) => boolean,
  timeout = 5000
): Promise<ServerMsg> {
  let q = inboxes.get(ws)
  if (q === undefined) {
    q = []
    inboxes.set(ws, q)
  }
  if (predicate !== undefined) {
    let idx = -1
    let k = 0
    while (k < q.length) {
      let m = q[k]
      if (m !== undefined && predicate(m)) {
        idx = k
        break
      }
      k = k + 1
    }
    if (idx !== -1) {
      let m = q.splice(idx, 1)[0]
      if (m !== undefined) {
        return Promise.resolve(m)
      }
    }
  } else {
    if (q.length > 0) {
      let m = q.shift()
      if (m !== undefined) {
        return Promise.resolve(m)
      }
    }
  }
  return new Promise<ServerMsg>((resolve, reject) => {
    let list = waiters.get(ws)
    if (list === undefined) {
      list = []
      waiters.set(ws, list)
    }
    let timer = setTimeout(() => {
      let l = waiters.get(ws)
      if (l !== undefined) {
        let idx = l.findIndex((w) => w.resolve === resolve)
        if (idx !== -1) {
          l.splice(idx, 1)
        }
      }
      reject(new Error('timeout waiting for message'))
    }, timeout)
    list.push({ predicate: predicate ?? null, resolve: resolve, reject: reject, timer: timer })
  })
}

function connectClient(): Promise<WebSocket> {
  return new Promise<WebSocket>((resolve, reject) => {
    let ws = new WebSocket('ws://127.0.0.1:' + String(port) + '/ws')
    inboxes.set(ws, [])
    waiters.set(ws, [])
    ws.addEventListener('message', (ev) => {
      let raw: string = typeof ev.data === 'string' ? ev.data : String(ev.data)
      try {
        let parsed = JSON.parse(raw) as ServerMsg
        let q = inboxes.get(ws)
        if (q === undefined) {
          q = []
          inboxes.set(ws, q)
        }
        q.push(parsed)
        drain(ws)
      } catch {}
    })
    let timer = setTimeout(() => {
      reject(new Error('connect timeout'))
    }, 5000)
    ws.addEventListener(
      'open',
      () => {
        clearTimeout(timer)
        allSockets.push(ws)
        resolve(ws)
      },
      { once: true }
    )
    ws.addEventListener(
      'error',
      () => {
        clearTimeout(timer)
        reject(new Error('connect error'))
      },
      { once: true }
    )
  })
}

function send(ws: WebSocket, msg: unknown): void {
  ws.send(JSON.stringify(msg))
}

function uci(from: string, to: string): Move {
  return { from: parseSquare(from), to: parseSquare(to) }
}

function isRoom(m: ServerMsg): boolean {
  return m.type === 'room'
}

function isState(m: ServerMsg): boolean {
  return m.type === 'state'
}

function isPresence(m: ServerMsg): boolean {
  return m.type === 'presence'
}

function isError(m: ServerMsg): boolean {
  return m.type === 'error'
}

function isPong(m: ServerMsg): boolean {
  return m.type === 'pong'
}

async function createRoom(): Promise<{ white: WebSocket; room: string }> {
  let white = await connectClient()
  send(white, { type: 'create' })
  let roomMsg = await nextMsg(white, isRoom)
  if (roomMsg.type !== 'room') {
    throw new Error('expected room')
  }
  let room = roomMsg.room
  expect(roomMsg.color).toBe('white')
  expect(typeof room).toBe('string')
  let stateMsg = await nextMsg(white, isState)
  expect(stateMsg.type).toBe('state')
  let presenceMsg = await nextMsg(white, isPresence)
  if (presenceMsg.type !== 'presence') {
    throw new Error('expected presence')
  }
  expect(presenceMsg.opponent).toBe(false)
  return { white: white, room: room }
}

async function joinRoom(white: WebSocket, room: string): Promise<WebSocket> {
  let black = await connectClient()
  send(black, { type: 'join', room: room })
  let roomMsg = await nextMsg(black, isRoom)
  if (roomMsg.type !== 'room') {
    throw new Error('expected room')
  }
  expect(roomMsg.color).toBe('black')
  expect(roomMsg.room).toBe(room)
  let blackState = await nextMsg(black, isState)
  expect(blackState.type).toBe('state')
  let blackPresence = await nextMsg(black, isPresence)
  if (blackPresence.type !== 'presence') {
    throw new Error('expected presence')
  }
  expect(blackPresence.opponent).toBe(true)
  let whiteState = await nextMsg(white, isState)
  expect(whiteState.type).toBe('state')
  let whitePresence = await nextMsg(white, isPresence)
  if (whitePresence.type !== 'presence') {
    throw new Error('expected presence')
  }
  expect(whitePresence.opponent).toBe(true)
  return black
}

beforeAll(() => {
  srv = startServer(0)
  port = srv.port
})

afterAll(() => {
  for (let ws of allSockets) {
    try {
      ws.close()
    } catch {}
  }
  inboxes.clear()
  waiters.clear()
  if (srv !== null) {
    srv.stop()
  }
})

test('create assigns white and room code', async () => {
  let { white, room } = await createRoom()
  expect(room.length).toBeGreaterThan(0)
  expect(white.readyState).toBe(WebSocket.OPEN)
})

test('join assigns black and both see presence', async () => {
  let { white, room } = await createRoom()
  let black = await joinRoom(white, room)
  expect(black.readyState).toBe(WebSocket.OPEN)
})

test('white e2e4 reaches black client', async () => {
  let { white, room } = await createRoom()
  let black = await joinRoom(white, room)
  send(white, { type: 'move', move: uci('e2', 'e4') })
  let wState = await nextMsg(white, isState)
  let bState = await nextMsg(black, isState)
  if (wState.type !== 'state' || bState.type !== 'state') {
    throw new Error('expected state')
  }
  expect(bState.game.turn).toBe('black')
  expect(wState.game.turn).toBe('black')
  let pawn = bState.game.board[4][4]
  expect(pawn).not.toBeNull()
  if (pawn !== null && pawn !== undefined) {
    expect(pawn.type).toBe('pawn')
    expect(pawn.color).toBe('white')
  }
  expect(bState.game.board[6][4]).toBeNull()
})

test('illegal move and wrong color move produce errors', async () => {
  let { white, room } = await createRoom()
  let black = await joinRoom(white, room)
  send(white, { type: 'move', move: uci('e2', 'e5') })
  let err1 = await nextMsg(white, isError)
  expect(err1.type).toBe('error')
  send(black, { type: 'move', move: uci('e2', 'e4') })
  let err2 = await nextMsg(black, isError)
  expect(err2.type).toBe('error')
})

test('scholars mate ends with checkmate', async () => {
  let { white, room } = await createRoom()
  let black = await joinRoom(white, room)
  let moves: Array<{ ws: WebSocket; from: string; to: string }> = [
    { ws: white, from: 'e2', to: 'e4' },
    { ws: black, from: 'e7', to: 'e5' },
    { ws: white, from: 'f1', to: 'c4' },
    { ws: black, from: 'b8', to: 'c6' },
    { ws: white, from: 'd1', to: 'h5' },
    { ws: black, from: 'g8', to: 'f6' },
    { ws: white, from: 'h5', to: 'f7' },
  ]
  let lastGame: GameState | null = null
  for (let mv of moves) {
    send(mv.ws, { type: 'move', move: uci(mv.from, mv.to) })
    let wState = await nextMsg(white, isState)
    let bState = await nextMsg(black, isState)
    if (wState.type !== 'state' || bState.type !== 'state') {
      throw new Error('expected state')
    }
    lastGame = bState.game
  }
  if (lastGame === null) {
    throw new Error('no game')
  }
  let status = getGameStatus(lastGame)
  expect(status.status).toBe('checkmate')
  expect(status.winner).toBe('white')
})

test('resign sets result winner', async () => {
  let { white, room } = await createRoom()
  let black = await joinRoom(white, room)
  send(white, { type: 'resign' })
  let wState = await nextMsg(white, isState)
  let bState = await nextMsg(black, isState)
  if (wState.type !== 'state' || bState.type !== 'state') {
    throw new Error('expected state')
  }
  expect(wState.result).not.toBeNull()
  expect(bState.result).not.toBeNull()
  if (wState.result !== null && bState.result !== null) {
    expect(wState.result.winner).toBe('black')
    expect(bState.result.winner).toBe('black')
    expect(wState.result.reason).toBe('resign')
  }
})

test('rematch votes reset board and swap colors', async () => {
  let { white, room } = await createRoom()
  let black = await joinRoom(white, room)
  send(black, { type: 'resign' })
  await nextMsg(white, isState)
  await nextMsg(black, isState)
  send(white, { type: 'rematch' })
  let wVote = await nextMsg(white, isState)
  let bVote = await nextMsg(black, isState)
  if (wVote.type !== 'state' || bVote.type !== 'state') {
    throw new Error('expected state')
  }
  send(black, { type: 'rematch' })
  let wRoom = await nextMsg(white, isRoom)
  let bRoom = await nextMsg(black, isRoom)
  if (wRoom.type !== 'room' || bRoom.type !== 'room') {
    throw new Error('expected room')
  }
  expect(wRoom.color).toBe('black')
  expect(bRoom.color).toBe('white')
  expect(wRoom.room).toBe(room)
  let wState = await nextMsg(white, isState)
  let bState = await nextMsg(black, isState)
  if (wState.type !== 'state' || bState.type !== 'state') {
    throw new Error('expected state')
  }
  expect(wState.result).toBeNull()
  expect(bState.result).toBeNull()
  expect(wState.game.turn).toBe('white')
  expect(JSON.stringify(bState.game.board)).toBe(JSON.stringify(initialGameState().board))
  let wPresence = await nextMsg(white, isPresence)
  let bPresence = await nextMsg(black, isPresence)
  if (wPresence.type !== 'presence' || bPresence.type !== 'presence') {
    throw new Error('expected presence')
  }
  expect(wPresence.opponent).toBe(true)
  expect(bPresence.opponent).toBe(true)
})

test('ping echoes a pong with the same nonce', async () => {
  let { white } = await createRoom()
  send(white, { type: 'ping', nonce: 41 })
  let pong = await nextMsg(white, isPong)
  if (pong.type !== 'pong') {
    throw new Error('expected pong')
  }
  expect(pong.nonce).toBe(41)
})

test('ping without a nonce gets an error, not silence', async () => {
  let { white } = await createRoom()
  send(white, { type: 'ping' })
  let err = await nextMsg(white, isError)
  expect(err).toEqual({ type: 'error', message: 'Ping needs a numeric nonce' })
})

test('bad JSON gets an invalid-format error', async () => {
  let white = await connectClient()
  white.send('not json{{{')
  let err = await nextMsg(white, isError)
  expect(err).toEqual({ type: 'error', message: 'Invalid message format' })
})
