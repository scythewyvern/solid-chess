import { describe, expect, test } from 'bun:test'

import type { Move } from '../src/engine'
import type { RoomMsg, ServerMsg, StateMsg } from '../src/net-protocol'
import { leaveRoom, reduceRooms } from './rooms'
import type { Reply, RoomBook, Seat } from './rooms'

function freshBook(): RoomBook {
  return new Map()
}

function sq(name: string) {
  let file = name.charCodeAt(0) - 97
  let rank = Number(name.charAt(1))
  return { row: 8 - rank, col: file }
}

function mv(from: string, to: string, promotion?: Move['promotion']): Move {
  let move: Move = { from: sq(from), to: sq(to) }
  if (promotion !== undefined) move.promotion = promotion
  return move
}

function createRoom(book: RoomBook, token: string) {
  return reduceRooms(book, token, null, { type: 'create' })
}

function findMsg(replies: Reply[], type: string): ServerMsg | undefined {
  return replies.map((r) => r.msg).find((m) => m.type === type)
}

describe('rooms reducer', () => {
  test('create opens a room and seats the creator as white', () => {
    let book = freshBook()
    let out = createRoom(book, 'a')
    expect(out.sender).toEqual({ room: (out.sender as Seat).room, color: 'white', token: 'a' })
    let room = findMsg(out.replies, 'room') as RoomMsg
    expect(room.color).toBe('white')
    expect(typeof room.room).toBe('string')
    expect(book.has(room.room)).toBe(true)
  })

  test('join fills black, third join is rejected', () => {
    let book = freshBook()
    let created = createRoom(book, 'a')
    let code = (findMsg(created.replies, 'room') as RoomMsg).room
    let joined = reduceRooms(book, 'b', null, { type: 'join', room: code })
    expect(joined.sender).toEqual({ room: code, color: 'black', token: 'b' })
    let full = reduceRooms(book, 'c', null, { type: 'join', room: code })
    expect(full.sender).toBeNull()
    expect(findMsg(full.replies, 'error')).toEqual({ type: 'error', message: 'Room is full' })
  })

  test('joining an unknown room errors', () => {
    let book = freshBook()
    let out = reduceRooms(book, 'a', null, { type: 'join', room: 'ZZZZZ' })
    expect(findMsg(out.replies, 'error')).toEqual({ type: 'error', message: 'Room not found' })
  })

  test('legal move broadcasts to both seats', () => {
    let book = freshBook()
    let created = createRoom(book, 'a')
    let code = (findMsg(created.replies, 'room') as RoomMsg).room
    reduceRooms(book, 'b', null, { type: 'join', room: code })
    let whiteSeat: Seat = { room: code, color: 'white', token: 'a' }
    let out = reduceRooms(book, 'a', whiteSeat, { type: 'move', move: mv('e2', 'e4') })
    let states = out.replies
      .map((r) => r.msg)
      .filter((m) => m.type === 'state') as Array<StateMsg>
    expect(states).toHaveLength(2)
    let yours = states.map((s) => s.you).sort()
    expect(yours).toEqual(['black', 'white'])
    for (let s of states) {
      expect(s.game.board[4][4]).toEqual({ type: 'pawn', color: 'white' })
      expect(s.game.turn).toBe('black')
      expect(s.result).toBeNull()
    }
  })

  test('moving out of turn and foreign pieces are rejected', () => {
    let book = freshBook()
    let created = createRoom(book, 'a')
    let code = (findMsg(created.replies, 'room') as RoomMsg).room
    reduceRooms(book, 'b', null, { type: 'join', room: code })
    let black: Seat = { room: code, color: 'black', token: 'b' }
    let early = reduceRooms(book, 'b', black, { type: 'move', move: mv('e7', 'e5') })
    expect(findMsg(early.replies, 'error')).toEqual({
      type: 'error',
      message: 'Not your turn',
    })
    let white: Seat = { room: code, color: 'white', token: 'a' }
    let foreign = reduceRooms(book, 'a', white, { type: 'move', move: mv('e7', 'e5') })
    expect(findMsg(foreign.replies, 'error')).toEqual({
      type: 'error',
      message: 'Illegal move',
    })
    let malformed = reduceRooms(book, 'a', white, {
      type: 'move',
      move: { from: 'e2', to: 'e4' },
    })
    expect(findMsg(malformed.replies, 'error')).toEqual({
      type: 'error',
      message: 'Illegal move',
    })
  })

  test('resign ends the game and blocks further moves', () => {
    let book = freshBook()
    let created = createRoom(book, 'a')
    let code = (findMsg(created.replies, 'room') as RoomMsg).room
    reduceRooms(book, 'b', null, { type: 'join', room: code })
    let white: Seat = { room: code, color: 'white', token: 'a' }
    let resigned = reduceRooms(book, 'a', white, { type: 'resign' })
    let state = findMsg(resigned.replies, 'state') as StateMsg
    expect(state.result).toEqual({ winner: 'black', reason: 'resign' })
    let after = reduceRooms(book, 'a', white, { type: 'move', move: mv('e2', 'e4') })
    expect(findMsg(after.replies, 'error')).toEqual({ type: 'error', message: 'Game is over' })
  })

  test('double rematch resets the board and swaps colors', () => {
    let book = freshBook()
    let created = createRoom(book, 'a')
    let code = (findMsg(created.replies, 'room') as RoomMsg).room
    reduceRooms(book, 'b', null, { type: 'join', room: code })
    let white: Seat = { room: code, color: 'white', token: 'a' }
    let black: Seat = { room: code, color: 'black', token: 'b' }
    reduceRooms(book, 'a', white, { type: 'resign' })
    let first = reduceRooms(book, 'a', white, { type: 'rematch' })
    let firstState = findMsg(first.replies, 'state') as StateMsg
    expect(firstState.rematch).toEqual({ white: true, black: false })
    let second = reduceRooms(book, 'b', black, { type: 'rematch' })
    expect(second.sender).toEqual({ room: code, color: 'white', token: 'b' })
    let rooms = second.replies
      .map((r) => r.msg)
      .filter((m) => m.type === 'room') as Array<RoomMsg>
    expect(rooms.find((m) => m.color === 'white')).toBeDefined()
    let fresh = findMsg(second.replies, 'state') as StateMsg
    expect(fresh.game.board[6][4]).toEqual({ type: 'pawn', color: 'white' })
    expect(fresh.game.turn).toBe('white')
    expect(fresh.result).toBeNull()
    expect(fresh.rematch).toEqual({ white: false, black: false })
  })

  test('rematch mid-game is rejected', () => {
    let book = freshBook()
    let created = createRoom(book, 'a')
    let code = (findMsg(created.replies, 'room') as RoomMsg).room
    reduceRooms(book, 'b', null, { type: 'join', room: code })
    let white: Seat = { room: code, color: 'white', token: 'a' }
    reduceRooms(book, 'a', white, { type: 'move', move: mv('e2', 'e4') })
    let out = reduceRooms(book, 'a', white, { type: 'rematch' })
    expect(findMsg(out.replies, 'error')).toEqual({
      type: 'error',
      message: 'Game is not over',
    })
  })

  test('re-create leaves the old room and notifies the opponent', () => {
    let book = freshBook()
    let created = createRoom(book, 'a')
    let code = (findMsg(created.replies, 'room') as RoomMsg).room
    reduceRooms(book, 'b', null, { type: 'join', room: code })
    let white: Seat = { room: code, color: 'white', token: 'a' }
    let again = reduceRooms(book, 'a', white, { type: 'create' })
    expect(again.sender).toEqual({
      room: (again.sender as Seat).room,
      color: 'white',
      token: 'a',
    })
    expect((again.sender as Seat).room).not.toBe(code)
    let presence = findMsg(again.replies, 'presence')
    expect(presence).toEqual({ type: 'presence', opponent: false })
  })

  test('join is idempotent for the same seat', () => {
    let book = freshBook()
    let created = createRoom(book, 'a')
    let code = (findMsg(created.replies, 'room') as RoomMsg).room
    let white: Seat = { room: code, color: 'white', token: 'a' }
    let again = reduceRooms(book, 'a', white, { type: 'join', room: code })
    expect(again.sender).toEqual(white)
    expect(findMsg(again.replies, 'room')).toEqual({
      type: 'room',
      room: code,
      color: 'white',
    })
  })

  test('malformed room codes are rejected before lookup', () => {
    let book = freshBook()
    for (let bad of ['!!!', 'AB', 'ABCDEFGHI', 42, null]) {
      let out = reduceRooms(book, 'a', null, { type: 'join', room: bad })
      expect(findMsg(out.replies, 'error')).toEqual({
        type: 'error',
        message: 'Room not found',
      })
    }
  })

  test('move without a seat, with a stale seat or a foreign token fails', () => {
    let book = freshBook()
    let created = createRoom(book, 'a')
    let code = (findMsg(created.replies, 'room') as RoomMsg).room
    let noseat = reduceRooms(book, 'x', null, { type: 'move', move: mv('e2', 'e4') })
    expect(findMsg(noseat.replies, 'error')).toEqual({
      type: 'error',
      message: 'You are not in a room',
    })
    let stale: Seat = { room: 'ZZZZZ', color: 'white', token: 'x' }
    let missing = reduceRooms(book, 'x', stale, { type: 'move', move: mv('e2', 'e4') })
    expect(findMsg(missing.replies, 'error')).toEqual({
      type: 'error',
      message: 'Room not found',
    })
    let foreign: Seat = { room: code, color: 'white', token: 'intruder' }
    let hijack = reduceRooms(book, 'intruder', foreign, {
      type: 'move',
      move: mv('e2', 'e4'),
    })
    expect(findMsg(hijack.replies, 'error')).toEqual({
      type: 'error',
      message: 'You are not in a room',
    })
  })

  test('illegal move shapes are rejected', () => {
    let book = freshBook()
    let created = createRoom(book, 'a')
    let code = (findMsg(created.replies, 'room') as RoomMsg).room
    reduceRooms(book, 'b', null, { type: 'join', room: code })
    let white: Seat = { room: code, color: 'white', token: 'a' }
    let badShapes: unknown[] = [
      { from: { row: 6, col: 4 }, to: { row: 4, col: 4 }, promotion: 'dragon' },
      { from: { row: 6.5, col: 4 }, to: { row: 4, col: 4 } },
      { from: { row: 6, col: 4 }, to: { row: -1, col: 4 } },
      { from: { row: 6, col: 4 } },
      null,
    ]
    for (let shape of badShapes) {
      let out = reduceRooms(book, 'a', white, { type: 'move', move: shape })
      expect(findMsg(out.replies, 'error')).toEqual({
        type: 'error',
        message: 'Illegal move',
      })
    }
  })

  test('engine-illegal move with a valid shape is rejected', () => {
    let book = freshBook()
    let created = createRoom(book, 'a')
    let code = (findMsg(created.replies, 'room') as RoomMsg).room
    reduceRooms(book, 'b', null, { type: 'join', room: code })
    let white: Seat = { room: code, color: 'white', token: 'a' }
    let out = reduceRooms(book, 'a', white, { type: 'move', move: mv('b1', 'b3') })
    expect(findMsg(out.replies, 'error')).toEqual({
      type: 'error',
      message: 'Illegal move',
    })
  })

  test('resign and rematch without a room fail', () => {
    let book = freshBook()
    let r1 = reduceRooms(book, 'x', null, { type: 'resign' })
    expect(findMsg(r1.replies, 'error')).toEqual({
      type: 'error',
      message: 'You are not in a room',
    })
    let r2 = reduceRooms(book, 'x', null, { type: 'rematch' })
    expect(findMsg(r2.replies, 'error')).toEqual({
      type: 'error',
      message: 'You are not in a room',
    })
    let created = createRoom(book, 'a')
    let code = (findMsg(created.replies, 'room') as RoomMsg).room
    let foreign: Seat = { room: code, color: 'white', token: 'intruder' }
    let r3 = reduceRooms(book, 'intruder', foreign, { type: 'resign' })
    expect(findMsg(r3.replies, 'error')).toEqual({
      type: 'error',
      message: 'You are not in a room',
    })
  })

  test('second resign overwrites the result', () => {
    let book = freshBook()
    let created = createRoom(book, 'a')
    let code = (findMsg(created.replies, 'room') as RoomMsg).room
    reduceRooms(book, 'b', null, { type: 'join', room: code })
    let white: Seat = { room: code, color: 'white', token: 'a' }
    let black: Seat = { room: code, color: 'black', token: 'b' }
    reduceRooms(book, 'a', white, { type: 'resign' })
    let second = reduceRooms(book, 'b', black, { type: 'resign' })
    let state = findMsg(second.replies, 'state') as StateMsg
    expect(state.result).toEqual({ winner: 'white', reason: 'resign' })
  })

  test('a lone vote does not survive a newcomer', () => {
    let book = freshBook()
    let created = createRoom(book, 'a')
    let code = (findMsg(created.replies, 'room') as RoomMsg).room
    reduceRooms(book, 'b', null, { type: 'join', room: code })
    let white: Seat = { room: code, color: 'white', token: 'a' }
    let black: Seat = { room: code, color: 'black', token: 'b' }
    reduceRooms(book, 'a', white, { type: 'resign' })
    reduceRooms(book, 'a', white, { type: 'rematch' })
    leaveRoom(book, black)
    reduceRooms(book, 'c', null, { type: 'join', room: code })
    let fresh = reduceRooms(book, 'c', null, { type: 'rematch', room: code } as never)
    expect(findMsg(fresh.replies, 'error')).toEqual({
      type: 'error',
      message: 'You are not in a room',
    })
    let newcomer: Seat = { room: code, color: 'black', token: 'c' }
    let vote = reduceRooms(book, 'c', newcomer, { type: 'rematch' })
    let state = findMsg(vote.replies, 'state') as StateMsg
    // White's stale vote was cleared on leave; only black's fresh vote stands,
    // so the finished game is still waiting for white — no reset happened.
    expect(state.rematch).toEqual({ white: false, black: true })
    expect(state.game.turn).toBe('white')
    expect(state.result).not.toBeNull()
  })

  test('leave frees the seat for a newcomer', () => {
    let book = freshBook()
    let created = createRoom(book, 'a')
    let code = (findMsg(created.replies, 'room') as RoomMsg).room
    reduceRooms(book, 'b', null, { type: 'join', room: code })
    let white: Seat = { room: code, color: 'white', token: 'a' }
    let left = leaveRoom(book, white)
    expect(left.sender).toBeNull()
    let presence = findMsg(left.replies, 'presence')
    expect(presence).toEqual({ type: 'presence', opponent: false })
    let joined = reduceRooms(book, 'c', null, { type: 'join', room: code })
    expect(joined.sender).toEqual({ room: code, color: 'white', token: 'c' })
  })

  test('last leave deletes the room from the book', () => {
    let book = freshBook()
    let created = createRoom(book, 'a')
    let code = (findMsg(created.replies, 'room') as RoomMsg).room
    let white: Seat = { room: code, color: 'white', token: 'a' }
    let left = leaveRoom(book, white)
    expect(left.replies).toEqual([])
    expect(book.has(code)).toBe(false)
    let gone = reduceRooms(book, 'b', null, { type: 'join', room: code })
    expect(findMsg(gone.replies, 'error')).toEqual({
      type: 'error',
      message: 'Room not found',
    })
  })

  test('ping is a no-op heartbeat at the reducer level', () => {
    let book = freshBook()
    let out = reduceRooms(book, 'x', null, { type: 'ping', nonce: 1 })
    expect(out.sender).toBeNull()
    expect(out.replies).toEqual([])
  })

  test('garbage messages get an unknown-message error', () => {
    let book = freshBook()
    let out = reduceRooms(book, 'x', null, { type: 'dance' })
    expect(findMsg(out.replies, 'error')).toEqual({
      type: 'error',
      message: 'Unknown message',
    })
    let out2 = reduceRooms(book, 'x', null, null)
    expect(findMsg(out2.replies, 'error')).toEqual({
      type: 'error',
      message: 'Unknown message',
    })
  })
})
