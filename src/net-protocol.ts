import type { Color, GameState, Move } from './engine'

export const WS_DEFAULT_PORT = 3001

// ---------------------------------------------------------------------------
// client -> server
// ---------------------------------------------------------------------------

export interface CreateMsg {
  type: 'create'
}

export interface JoinMsg {
  type: 'join'
  room: string
}

export interface MoveMsg {
  type: 'move'
  move: Move
}

export interface RematchMsg {
  type: 'rematch'
}

export interface ResignMsg {
  type: 'resign'
}

export type ClientMsg = CreateMsg | JoinMsg | MoveMsg | RematchMsg | ResignMsg

// ---------------------------------------------------------------------------
// server -> client
// ---------------------------------------------------------------------------

export interface RoomMsg {
  type: 'room'
  room: string
  color: Color
}

export interface ResignResult {
  winner: Color
  reason: 'resign'
}

export interface StateMsg {
  type: 'state'
  game: GameState
  result: ResignResult | null
  rematch: Record<Color, boolean>
  you: Color
}

export interface PresenceMsg {
  type: 'presence'
  opponent: boolean
}

export interface ErrorMsg {
  type: 'error'
  message: string
}

export type ServerMsg = RoomMsg | StateMsg | PresenceMsg | ErrorMsg

// ---------------------------------------------------------------------------
// room codes
// ---------------------------------------------------------------------------

let ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function makeRoomCode(length = 5): string {
  let code = ''
  while (code.length < length) {
    let i = Math.floor(Math.random() * ROOM_ALPHABET.length)
    code = code + ROOM_ALPHABET.charAt(i)
  }
  return code
}

export function normalizeRoomCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let code = raw.trim().toUpperCase()
  if (/^[A-Z2-9]{4,8}$/.test(code) === false) return null
  return code
}
