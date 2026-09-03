import { describe, expect, test } from 'bun:test'

import { initialGameState, parseSquare } from './engine'
import type { Board, CastlingRights, Color, GameState, Move, PieceType } from './engine'
import { engineStatusText, moveLabel, squareAriaLabel } from './labels'
import { normalizeRoomCode } from './net-protocol'
import { pingLevel } from './use-online-game'

describe('pingLevel', () => {
  test('null stays null, boundaries split good/ok/bad', () => {
    expect(pingLevel(null)).toBeNull()
    expect(pingLevel(0)).toBe('good')
    expect(pingLevel(119)).toBe('good')
    expect(pingLevel(120)).toBe('ok')
    expect(pingLevel(299)).toBe('ok')
    expect(pingLevel(300)).toBe('bad')
    expect(pingLevel(2000)).toBe('bad')
  })
})

describe('labels', () => {
  test('moveLabel formats quiet moves and promotions', () => {
    expect(moveLabel({ from: parseSquare('e2'), to: parseSquare('e4') })).toBe('e2 → e4')
    let promo: Move = { from: parseSquare('e7'), to: parseSquare('e8'), promotion: 'queen' }
    expect(moveLabel(promo)).toBe('e7 → e8=queen')
  })

  test('squareAriaLabel covers empty, piece and target squares', () => {
    expect(squareAriaLabel(parseSquare('e4'), null, false)).toBe('e4')
    expect(squareAriaLabel(parseSquare('e4'), null, true)).toBe('Move to e4')
    expect(squareAriaLabel(parseSquare('e1'), { type: 'king', color: 'white' }, false)).toBe(
      'White king, e1'
    )
    expect(squareAriaLabel(parseSquare('d8'), { type: 'queen', color: 'black' }, true)).toBe(
      'Black queen, d8'
    )
  })

  test('engineStatusText names every terminal state', () => {
    expect(engineStatusText(initialGameState())).toBe('White to move')
    expect(engineStatusText(checkPosition())).toBe('White to move — check!')
    expect(engineStatusText(foolsMate())).toBe('Checkmate! Black wins')
    expect(engineStatusText(stalematePosition())).toBe('Stalemate — draw')
    expect(engineStatusText({ ...initialGameState(), halfmove: 100 })).toBe(
      'Draw — fifty-move rule'
    )
    expect(engineStatusText(bareKings())).toBe('Draw — insufficient material')
  })
})

describe('normalizeRoomCode', () => {
  test('trims and uppercases, rejects malformed codes', () => {
    expect(normalizeRoomCode(' abcde ')).toBe('ABCDE')
    expect(normalizeRoomCode('ab23')).toBe('AB23')
    expect(normalizeRoomCode('ab01')).toBeNull()
    expect(normalizeRoomCode('!!!')).toBeNull()
    expect(normalizeRoomCode('AB')).toBeNull()
    expect(normalizeRoomCode('ABCDEFGHI')).toBeNull()
    expect(normalizeRoomCode('abc l')).toBeNull()
    expect(normalizeRoomCode(42)).toBeNull()
    expect(normalizeRoomCode(null)).toBeNull()
  })
})

function noRights(): CastlingRights {
  return {
    whiteKingside: false,
    whiteQueenside: false,
    blackKingside: false,
    blackQueenside: false,
  }
}

function place(list: Array<[string, PieceType, Color]>): Board {
  let board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null)) as Board
  for (let [name, type, color] of list) {
    let s = parseSquare(name)
    board[s.row][s.col] = { type, color }
  }
  return board
}

function bareKings(): GameState {
  return {
    board: place([
      ['e1', 'king', 'white'],
      ['e8', 'king', 'black'],
    ]),
    turn: 'white',
    castling: noRights(),
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
  }
}

function checkPosition(): GameState {
  return {
    board: place([
      ['e1', 'king', 'white'],
      ['d2', 'queen', 'black'],
      ['e8', 'king', 'black'],
    ]),
    turn: 'white',
    castling: noRights(),
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
  }
}

function stalematePosition(): GameState {
  return {
    board: place([
      ['a8', 'king', 'black'],
      ['a6', 'king', 'white'],
      ['c7', 'queen', 'white'],
    ]),
    turn: 'black',
    castling: noRights(),
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
  }
}

function foolsMate(): GameState {
  return {
    board: place([
      ['e1', 'king', 'white'],
      ['d1', 'queen', 'white'],
      ['a1', 'rook', 'white'],
      ['h1', 'rook', 'white'],
      ['c1', 'bishop', 'white'],
      ['f1', 'bishop', 'white'],
      ['b1', 'knight', 'white'],
      ['g1', 'knight', 'white'],
      ['a2', 'pawn', 'white'],
      ['b2', 'pawn', 'white'],
      ['c2', 'pawn', 'white'],
      ['d2', 'pawn', 'white'],
      ['e2', 'pawn', 'white'],
      ['f3', 'pawn', 'white'],
      ['g4', 'pawn', 'white'],
      ['h2', 'pawn', 'white'],
      ['e8', 'king', 'black'],
      ['h4', 'queen', 'black'],
      ['a8', 'rook', 'black'],
      ['h8', 'rook', 'black'],
      ['c8', 'bishop', 'black'],
      ['f8', 'bishop', 'black'],
      ['b8', 'knight', 'black'],
      ['g8', 'knight', 'black'],
      ['a7', 'pawn', 'black'],
      ['b7', 'pawn', 'black'],
      ['c7', 'pawn', 'black'],
      ['d7', 'pawn', 'black'],
      ['e5', 'pawn', 'black'],
      ['f7', 'pawn', 'black'],
      ['g7', 'pawn', 'black'],
      ['h7', 'pawn', 'black'],
    ]),
    turn: 'white',
    castling: noRights(),
    enPassant: null,
    halfmove: 1,
    fullmove: 3,
  }
}
