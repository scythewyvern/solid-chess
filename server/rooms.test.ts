import { describe, expect, test } from 'bun:test'

import type { Move } from '../src/engine'
import { leaveRoom, reduceRooms } from './rooms'
import type { RoomBook, Seat } from './rooms'
import type { RoomMsg, StateMsg } from '../src/net-protocol'

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

function findMsg(replies: Array<{ msg: { type: string } }>, type: string) {
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
    let states = out.replies.map((r) => r.msg).filter((m) => m.type === 'state') as Array<StateMsg>
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
    expect(findMsg(early.replies, 'error')).toEqual({ type: 'error', message: 'Not your turn' })
    let white: Seat = { room: code, color: 'white', token: 'a' }
    let foreign = reduceRooms(book, 'a', white, { type: 'move', move: mv('e7', 'e5') })
    expect(findMsg(foreign.replies, 'error')).toEqual({ type: 'error', message: 'Illegal move' })
    let malformed = reduceRooms(book, 'a', white, { type: 'move', move: { from: 'e2', to: 'e4' } })
    expect(findMsg(malformed.replies, 'error')).toEqual({ type: 'error', message: 'Illegal move' })
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
    reduceRooms(book, 'a', white, { type: 'move', move: mv('e2', 'e4') })
    let first = reduceRooms(book, 'a', white, { type: 'rematch' })
    let firstState = findMsg(first.replies, 'state') as StateMsg
    expect(firstState.rematch).toEqual({ white: true, black: false })
    let second = reduceRooms(book, 'b', black, { type: 'rematch' })
    expect(second.sender).toEqual({ room: code, color: 'white', token: 'b' })
    let rooms = second.replies.map((r) => r.msg).filter((m) => m.type === 'room') as Array<RoomMsg>
    expect(rooms.find((m) => m.color === 'white')).toBeDefined()
    let fresh = findMsg(second.replies, 'state') as StateMsg
    expect(fresh.game.board[6][4]).toEqual({ type: 'pawn', color: 'white' })
    expect(fresh.game.turn).toBe('white')
    expect(fresh.result).toBeNull()
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

  test('garbage messages get an unknown-message error', () => {
    let book = freshBook()
    let out = reduceRooms(book, null, { type: 'dance' })
    expect(findMsg(out.replies, 'error')).toEqual({ type: 'error', message: 'Unknown message' })
    let out2 = reduceRooms(book, null, null)
    expect(findMsg(out2.replies, 'error')).toEqual({ type: 'error', message: 'Unknown message' })
  })
})
