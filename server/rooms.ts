import { applyMove, getPiece, initialGameState, opposite } from '../src/engine'
import type { Color, GameState, Move } from '../src/engine'
import { makeRoomCode, normalizeRoomCode } from '../src/net-protocol'
import type { ResignResult, ServerMsg } from '../src/net-protocol'

// Pure room state machine: no sockets, no timers, no I/O. The transport
// layer (ws-server) maps tokens to sockets and only delivers replies.
// Fully unit-testable without opening a single connection.
export interface Seat {
  room: string
  color: Color
  token: string
}

export interface RoomData {
  game: GameState
  seats: Record<Color, string | null>
  rematch: Record<Color, boolean>
  result: ResignResult | null
}

export type RoomBook = Map<string, RoomData>

export type ReplyTarget = { kind: 'sender' } | { kind: 'token'; token: string }

export interface Reply {
  target: ReplyTarget
  msg: ServerMsg
}

export interface ReduceOutput {
  sender: Seat | null
  replies: Reply[]
}

function errorReply(message: string): Reply[] {
  return [{ target: { kind: 'sender' }, msg: { type: 'error', message } }]
}

function seatReplies(room: RoomData, makeMsg: (color: Color) => ServerMsg): Reply[] {
  let out: Reply[] = []
  let colors: Array<Color> = ['white', 'black']
  for (let color of colors) {
    let token = room.seats[color]
    if (token !== null) {
      out.push({ target: { kind: 'token', token }, msg: makeMsg(color) })
    }
  }
  return out
}

function stateReplies(room: RoomData): Reply[] {
  return seatReplies(room, (color) => ({
    type: 'state',
    game: room.game,
    result: room.result,
    rematch: { white: room.rematch.white, black: room.rematch.black },
    you: color,
  }))
}

function presenceReplies(room: RoomData): Reply[] {
  let both = room.seats.white !== null && room.seats.black !== null
  return seatReplies(room, () => ({ type: 'presence', opponent: both }))
}

function roomReplies(code: string, room: RoomData): Reply[] {
  return seatReplies(room, (color) => ({ type: 'room', room: code, color }))
}

function isSquareLike(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  let o = v as { row?: unknown; col?: unknown }
  if (typeof o.row !== 'number' || typeof o.col !== 'number') return false
  if (Number.isInteger(o.row) === false || Number.isInteger(o.col) === false) return false
  if (o.row < 0 || o.row > 7 || o.col < 0 || o.col > 7) return false
  return true
}

function isMoveShape(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  let o = v as { from?: unknown; to?: unknown; promotion?: unknown }
  if (isSquareLike(o.from) === false) return false
  if (isSquareLike(o.to) === false) return false
  if (o.promotion !== undefined) {
    if (
      o.promotion !== 'queen' &&
      o.promotion !== 'rook' &&
      o.promotion !== 'bishop' &&
      o.promotion !== 'knight'
    ) {
      return false
    }
  }
  return true
}

function seated(room: RoomData, sender: Seat): boolean {
  return room.seats[sender.color] === sender.token
}

function handleCreate(book: RoomBook, token: string, sender: Seat | null): ReduceOutput {
  let left = leaveRoom(book, sender)
  let code = makeRoomCode()
  while (book.has(code)) {
    code = makeRoomCode()
  }
  let room: RoomData = {
    game: initialGameState(),
    seats: { white: token, black: null },
    rematch: { white: false, black: false },
    result: null,
  }
  book.set(code, room)
  let seat: Seat = { room: code, color: 'white', token }
  return {
    sender: seat,
    replies: [
      ...left.replies,
      { target: { kind: 'sender' }, msg: { type: 'room', room: code, color: 'white' } },
      ...stateReplies(room),
      ...presenceReplies(room),
    ],
  }
}

function handleJoin(
  book: RoomBook,
  token: string,
  sender: Seat | null,
  rawRoom: unknown
): ReduceOutput {
  let code = normalizeRoomCode(rawRoom)
  if (code === null) return { sender, replies: errorReply('Room not found') }
  let room = book.get(code)
  if (room === undefined) return { sender, replies: errorReply('Room not found') }
  if (sender !== null && sender.room === code && seated(room, sender)) {
    return {
      sender,
      replies: [
        { target: { kind: 'sender' }, msg: { type: 'room', room: code, color: sender.color } },
        ...stateReplies(room),
        ...presenceReplies(room),
      ],
    }
  }
  let left = leaveRoom(book, sender)
  let color: Color | null = null
  if (room.seats.white === null) {
    color = 'white'
  } else if (room.seats.black === null) {
    color = 'black'
  } else {
    return { sender, replies: errorReply('Room is full') }
  }
  room.seats[color] = token
  let seat: Seat = { room: code, color, token }
  return {
    sender: seat,
    replies: [
      ...left.replies,
      { target: { kind: 'sender' }, msg: { type: 'room', room: code, color } },
      ...stateReplies(room),
      ...presenceReplies(room),
    ],
  }
}

function handleMove(book: RoomBook, sender: Seat | null, rawMove: unknown): ReduceOutput {
  if (sender === null) return { sender, replies: errorReply('You are not in a room') }
  let room = book.get(sender.room)
  if (room === undefined) return { sender, replies: errorReply('Room not found') }
  if (seated(room, sender) === false)
    return { sender, replies: errorReply('You are not in a room') }
  if (room.result !== null) return { sender, replies: errorReply('Game is over') }
  if (room.game.turn !== sender.color) return { sender, replies: errorReply('Not your turn') }
  if (isMoveShape(rawMove) === false) return { sender, replies: errorReply('Illegal move') }
  let move = rawMove as Move
  let piece = getPiece(room.game, move.from)
  if (piece === null || piece.color !== sender.color) {
    return { sender, replies: errorReply('Illegal move') }
  }
  try {
    room.game = applyMove(room.game, move)
  } catch {
    return { sender, replies: errorReply('Illegal move') }
  }
  return { sender, replies: stateReplies(room) }
}

function handleResign(book: RoomBook, sender: Seat | null): ReduceOutput {
  if (sender === null) return { sender, replies: errorReply('You are not in a room') }
  let room = book.get(sender.room)
  if (room === undefined) return { sender, replies: errorReply('Room not found') }
  if (seated(room, sender) === false)
    return { sender, replies: errorReply('You are not in a room') }
  room.result = { winner: opposite(sender.color), reason: 'resign' }
  return { sender, replies: stateReplies(room) }
}

function handleRematch(book: RoomBook, sender: Seat | null): ReduceOutput {
  if (sender === null) return { sender, replies: errorReply('You are not in a room') }
  let room = book.get(sender.room)
  if (room === undefined) return { sender, replies: errorReply('Room not found') }
  if (seated(room, sender) === false)
    return { sender, replies: errorReply('You are not in a room') }
  room.rematch[sender.color] = true
  if (room.rematch.white && room.rematch.black) {
    let whiteToken = room.seats.white
    let blackToken = room.seats.black
    room.seats.white = blackToken
    room.seats.black = whiteToken
    room.game = initialGameState()
    room.result = null
    room.rematch = { white: false, black: false }
    let nextSender: Seat | null = null
    if (whiteToken === sender.token) {
      nextSender = { room: sender.room, color: 'black', token: sender.token }
    } else if (blackToken === sender.token) {
      nextSender = { room: sender.room, color: 'white', token: sender.token }
    }
    return {
      sender: nextSender ?? sender,
      replies: [
        ...roomReplies(sender.room, room),
        ...stateReplies(room),
        ...presenceReplies(room),
      ],
    }
  }
  return { sender, replies: stateReplies(room) }
}

export function leaveRoom(book: RoomBook, sender: Seat | null): ReduceOutput {
  if (sender === null) return { sender: null, replies: [] }
  let room = book.get(sender.room)
  if (room === undefined) return { sender: null, replies: [] }
  if (room.seats[sender.color] === sender.token) {
    room.seats[sender.color] = null
    room.rematch[sender.color] = false
  }
  return { sender: null, replies: presenceReplies(room) }
}

export function reduceRooms(
  book: RoomBook,
  token: string,
  sender: Seat | null,
  raw: unknown
): ReduceOutput {
  if (typeof raw !== 'object' || raw === null) {
    return { sender, replies: errorReply('Unknown message') }
  }
  let t = (raw as { type?: unknown }).type
  if (t === 'create') return handleCreate(book, token, sender)
  if (t === 'join') return handleJoin(book, token, sender, (raw as { room?: unknown }).room)
  if (t === 'move') return handleMove(book, sender, (raw as { move?: unknown }).move)
  if (t === 'resign') return handleResign(book, sender)
  if (t === 'rematch') return handleRematch(book, sender)
  return { sender, replies: errorReply('Unknown message') }
}
