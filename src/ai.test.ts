import { describe, expect, test } from 'bun:test'

import { chooseMove } from './ai'
import type { AiLevel } from './ai'
import { allLegalMoves, applyMove, initialGameState, parseSquare } from './engine'
import type { Board, CastlingRights, Color, GameState, PieceType } from './engine'

function noRights(): CastlingRights {
  return {
    whiteKingside: false,
    whiteQueenside: false,
    blackKingside: false,
    blackQueenside: false,
  }
}

function place(list: Array<[string, PieceType, Color]>, turn: Color): GameState {
  let board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null)) as Board
  for (let [name, type, color] of list) {
    let s = parseSquare(name)
    board[s.row][s.col] = { type, color }
  }
  return { board, turn, castling: noRights(), enPassant: null, halfmove: 0, fullmove: 1 }
}

// White to move: Qg6 protected by Kh6, black Kg8. Qg7 is mate in 1.
function mateInOne(): GameState {
  return place(
    [
      ['g8', 'king', 'black'],
      ['g6', 'queen', 'white'],
      ['h6', 'king', 'white'],
    ],
    'white'
  )
}

describe('chooseMove', () => {
  for (let level of ['easy', 'medium', 'hard'] as AiLevel[]) {
    test(`${level} finds mate in 1`, () => {
      let choice = chooseMove(mateInOne(), level)
      expect(choice.move).not.toBeNull()
      let after = applyMove(mateInOne(), choice.move!)
      expect(after.board[1][6]).toEqual({ type: 'queen', color: 'white' })
    })
  }

  test('medium and hard agree on the mate score sign', () => {
    let medium = chooseMove(mateInOne(), 'medium')
    let hard = chooseMove(mateInOne(), 'hard')
    expect(medium.score).toBeGreaterThan(90000)
    expect(hard.score).toBeGreaterThan(90000)
  })

  test('returns null with a drawn score on stalemate', () => {
    let stalemate = place(
      [
        ['a8', 'king', 'black'],
        ['a6', 'king', 'white'],
        ['c7', 'queen', 'white'],
      ],
      'black'
    )
    let choice = chooseMove(stalemate, 'hard')
    expect(choice.move).toBeNull()
    expect(choice.score).toBe(0)
  })

  test('opening move is legal and fast on every level', () => {
    for (let level of ['easy', 'medium', 'hard'] as AiLevel[]) {
      let start = performance.now()
      let choice = chooseMove(initialGameState(), level)
      let elapsed = performance.now() - start
      expect(choice.move).not.toBeNull()
      let legal = allLegalMoves(initialGameState(), 'white').some(
        (m) =>
          m.from.row === choice.move!.from.row &&
          m.from.col === choice.move!.from.col &&
          m.to.row === choice.move!.to.row &&
          m.to.col === choice.move!.to.col
      )
      expect(legal).toBe(true)
      expect(elapsed).toBeLessThan(5000)
    }
  })
})
