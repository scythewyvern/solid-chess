import { describe, expect, test } from 'bun:test'

import {
  allLegalMoves,
  applyMove,
  boardsEqual,
  capturedPieces,
  detectMove,
  getGameStatus,
  getPiece,
  initialGameState,
  inBounds,
  isInCheck,
  isLegalMove,
  isSquareAttacked,
  legalMoves,
  materialScore,
  opposite,
  parseSquare,
  squareName,
  type Board,
  type CastlingRights,
  type Color,
  type GameState,
  type Move,
  type PieceType,
  type Square,
} from './engine'

// ---------------------------------------------------------------------------
// helpers (test-only, plain data — no engine internals)
// ---------------------------------------------------------------------------

let emptyBoard = (): Board =>
  Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null))

let noRights = (): CastlingRights => ({
  whiteKingside: false,
  whiteQueenside: false,
  blackKingside: false,
  blackQueenside: false,
})

let fullRights = (): CastlingRights => ({
  whiteKingside: true,
  whiteQueenside: true,
  blackKingside: true,
  blackQueenside: true,
})

function custom(params: {
  board?: Board
  turn?: Color
  castling?: CastlingRights
  enPassant?: Square | null
  halfmove?: number
  fullmove?: number
}): GameState {
  return {
    board: params.board ?? emptyBoard(),
    turn: params.turn ?? 'white',
    castling: params.castling ?? noRights(),
    enPassant: params.enPassant ?? null,
    halfmove: params.halfmove ?? 0,
    fullmove: params.fullmove ?? 1,
  }
}

let sq = (name: string): Square => parseSquare(name)

function withPieces(list: Array<[string, PieceType, Color]>): Board {
  let board = emptyBoard()
  for (let [name, type, color] of list) {
    let s = parseSquare(name)
    board[s.row][s.col] = { type, color }
  }
  return board
}

function moveNames(moves: Move[]): string[] {
  return moves
    .map((m) => squareName(m.from) + squareName(m.to) + (m.promotion ? `=${m.promotion}` : ''))
    .sort()
}

function mv(from: string, to: string, promotion?: PieceType): Move {
  let move: Move = { from: sq(from), to: sq(to) }
  if (promotion) move.promotion = promotion
  return move
}

function at(board: Board, name: string) {
  let s = parseSquare(name)
  return board[s.row][s.col]
}

// ---------------------------------------------------------------------------
// coordinates & tiny helpers
// ---------------------------------------------------------------------------

describe('coordinates', () => {
  test('squareName maps row 0 to rank 8', () => {
    expect(squareName({ row: 0, col: 0 })).toBe('a8')
    expect(squareName({ row: 7, col: 7 })).toBe('h1')
    expect(squareName({ row: 4, col: 4 })).toBe('e4')
    expect(squareName({ row: 6, col: 4 })).toBe('e2')
    expect(squareName({ row: 1, col: 4 })).toBe('e7')
  })

  test('parseSquare is the inverse of squareName for all 64 squares', () => {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        expect(parseSquare(squareName({ row, col }))).toEqual({ row, col })
      }
    }
  })

  test('parseSquare rejects garbage', () => {
    expect(() => parseSquare('i9')).toThrow()
    expect(() => parseSquare('')).toThrow()
    expect(() => parseSquare('e')).toThrow()
  })

  test('inBounds', () => {
    expect(inBounds(0, 0)).toBe(true)
    expect(inBounds(7, 7)).toBe(true)
    expect(inBounds(-1, 0)).toBe(false)
    expect(inBounds(8, 3)).toBe(false)
    expect(inBounds(0, 8)).toBe(false)
  })

  test('opposite', () => {
    expect(opposite('white')).toBe('black')
    expect(opposite('black')).toBe('white')
  })
})

// ---------------------------------------------------------------------------
// initial position
// ---------------------------------------------------------------------------

describe('initial position', () => {
  test('meta: white to move, full rights, clocks at zero', () => {
    let state = initialGameState()
    expect(state.turn).toBe('white')
    expect(state.castling).toEqual({
      whiteKingside: true,
      whiteQueenside: true,
      blackKingside: true,
      blackQueenside: true,
    })
    expect(state.enPassant).toBeNull()
    expect(state.halfmove).toBe(0)
    expect(state.fullmove).toBe(1)
  })

  test('back ranks are rook-knight-bishop-queen-king', () => {
    let state = initialGameState()
    expect(at(state.board, 'a8')).toEqual({ type: 'rook', color: 'black' })
    expect(at(state.board, 'b8')).toEqual({ type: 'knight', color: 'black' })
    expect(at(state.board, 'c8')).toEqual({ type: 'bishop', color: 'black' })
    expect(at(state.board, 'd8')).toEqual({ type: 'queen', color: 'black' })
    expect(at(state.board, 'e8')).toEqual({ type: 'king', color: 'black' })
    expect(at(state.board, 'a1')).toEqual({ type: 'rook', color: 'white' })
    expect(at(state.board, 'd1')).toEqual({ type: 'queen', color: 'white' })
    expect(at(state.board, 'e1')).toEqual({ type: 'king', color: 'white' })
    expect(at(state.board, 'h1')).toEqual({ type: 'rook', color: 'white' })
  })

  test('pawns on rank 2 and 7, middle empty', () => {
    let state = initialGameState()
    expect(at(state.board, 'e2')).toEqual({ type: 'pawn', color: 'white' })
    expect(at(state.board, 'e7')).toEqual({ type: 'pawn', color: 'black' })
    expect(at(state.board, 'e4')).toBeNull()
    expect(at(state.board, 'e5')).toBeNull()
  })

  test('getPiece reads a square', () => {
    let state = initialGameState()
    expect(getPiece(state, sq('e1'))).toEqual({ type: 'king', color: 'white' })
    expect(getPiece(state, sq('e4'))).toBeNull()
  })

  test('white has exactly 20 legal moves at start', () => {
    expect(allLegalMoves(initialGameState(), 'white')).toHaveLength(20)
  })

  test('black has exactly 20 legal moves at start', () => {
    let state = { ...initialGameState(), turn: 'black' as Color }
    expect(allLegalMoves(state, 'black')).toHaveLength(20)
  })
})

// ---------------------------------------------------------------------------
// pawns
// ---------------------------------------------------------------------------

describe('pawn moves', () => {
  test('white pawn pushes one or two from start', () => {
    expect(moveNames(legalMoves(initialGameState(), sq('e2')))).toEqual(['e2e3', 'e2e4'])
  })

  test('black pawn pushes one or two from start', () => {
    let state = { ...initialGameState(), turn: 'black' as Color }
    expect(moveNames(legalMoves(state, sq('e7')))).toEqual(['e7e5', 'e7e6'])
  })

  test('blocked pawn cannot move', () => {
    let state = custom({
      board: withPieces([
        ['e2', 'pawn', 'white'],
        ['e3', 'pawn', 'white'],
      ]),
    })
    expect(legalMoves(state, sq('e2'))).toEqual([])
  })

  test('pawn cannot move forward into an enemy piece', () => {
    let state = custom({
      board: withPieces([
        ['e2', 'pawn', 'white'],
        ['e3', 'pawn', 'black'],
      ]),
    })
    expect(legalMoves(state, sq('e2'))).toEqual([])
  })

  test('pawn captures diagonally but not straight', () => {
    let state = custom({
      board: withPieces([
        ['e4', 'pawn', 'white'],
        ['d5', 'pawn', 'black'],
      ]),
    })
    expect(moveNames(legalMoves(state, sq('e4')))).toEqual(['e4d5', 'e4e5'])
  })

  test('pawn facing a pawn head-on has no moves', () => {
    let state = custom({
      board: withPieces([
        ['e4', 'pawn', 'white'],
        ['e5', 'pawn', 'black'],
      ]),
    })
    expect(legalMoves(state, sq('e4'))).toEqual([])
  })

  test('no double push once off the start rank', () => {
    let state = custom({ board: withPieces([['e4', 'pawn', 'white']]) })
    expect(moveNames(legalMoves(state, sq('e4')))).toEqual(['e4e5'])
  })

  test('quiet promotion offers all four pieces', () => {
    let state = custom({ board: withPieces([['e7', 'pawn', 'white']]) })
    expect(moveNames(legalMoves(state, sq('e7')))).toEqual([
      'e7e8=bishop',
      'e7e8=knight',
      'e7e8=queen',
      'e7e8=rook',
    ])
  })

  test('capture promotion adds four more moves', () => {
    let state = custom({
      board: withPieces([
        ['e7', 'pawn', 'white'],
        ['d8', 'rook', 'black'],
      ]),
    })
    expect(moveNames(legalMoves(state, sq('e7')))).toEqual([
      'e7d8=bishop',
      'e7d8=knight',
      'e7d8=queen',
      'e7d8=rook',
      'e7e8=bishop',
      'e7e8=knight',
      'e7e8=queen',
      'e7e8=rook',
    ])
  })
})

// ---------------------------------------------------------------------------
// knights & sliding pieces
// ---------------------------------------------------------------------------

describe('knights and sliders', () => {
  test('b1 knight jumps over own pawns to a3 and c3', () => {
    expect(moveNames(legalMoves(initialGameState(), sq('b1')))).toEqual(['b1a3', 'b1c3'])
  })

  test('cornered knight has two moves', () => {
    let state = custom({ board: withPieces([['a1', 'knight', 'white']]) })
    expect(moveNames(legalMoves(state, sq('a1')))).toEqual(['a1b3', 'a1c2'])
  })

  test('knight cannot capture its own piece', () => {
    let state = custom({
      board: withPieces([
        ['c3', 'knight', 'white'],
        ['e4', 'pawn', 'white'],
      ]),
    })
    let names = moveNames(legalMoves(state, sq('c3')))
    expect(names).not.toContain('c3e4')
    expect(names).toHaveLength(7)
  })

  test('blocked bishop and rook have no moves at start', () => {
    let state = initialGameState()
    expect(legalMoves(state, sq('c1'))).toEqual([])
    expect(legalMoves(state, sq('a1'))).toEqual([])
  })

  test('bishop opens up after 1.e4', () => {
    let afterE4 = applyMove(initialGameState(), mv('e2', 'e4'))
    let state: GameState = { ...afterE4, turn: 'white' }
    expect(moveNames(legalMoves(state, sq('f1')))).toEqual([
      'f1a6',
      'f1b5',
      'f1c4',
      'f1d3',
      'f1e2',
    ])
  })

  test('rook climbs the opened a-file after a2-a4', () => {
    let state = applyMove(initialGameState(), mv('a2', 'a4'))
    let blackReply = applyMove(state, mv('a7', 'a5'))
    expect(moveNames(legalMoves(blackReply, sq('a1')))).toEqual(['a1a2', 'a1a3'])
  })
})

// ---------------------------------------------------------------------------
// king & castling
// ---------------------------------------------------------------------------

describe('king and castling', () => {
  test('king is locked in at start', () => {
    expect(legalMoves(initialGameState(), sq('e1'))).toEqual([])
  })

  test('open back rank: king walks and castles both sides', () => {
    let state = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['a1', 'rook', 'white'],
        ['h1', 'rook', 'white'],
      ]),
      castling: fullRights(),
    })
    expect(moveNames(legalMoves(state, sq('e1')))).toEqual([
      'e1c1',
      'e1d1',
      'e1d2',
      'e1e2',
      'e1f1',
      'e1f2',
      'e1g1',
    ])
  })

  test('no rights, no castling', () => {
    let state = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['a1', 'rook', 'white'],
        ['h1', 'rook', 'white'],
      ]),
    })
    let names = moveNames(legalMoves(state, sq('e1')))
    expect(names).not.toContain('e1g1')
    expect(names).not.toContain('e1c1')
    expect(names).toHaveLength(5)
  })

  test('own knight on g1 blocks only kingside castling', () => {
    let state = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['a1', 'rook', 'white'],
        ['h1', 'rook', 'white'],
        ['g1', 'knight', 'white'],
      ]),
      castling: fullRights(),
    })
    let names = moveNames(legalMoves(state, sq('e1')))
    expect(names).not.toContain('e1g1')
    expect(names).toContain('e1c1')
  })

  test('enemy bishop eyeing f1 kills kingside castling only', () => {
    let state = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['a1', 'rook', 'white'],
        ['h1', 'rook', 'white'],
        ['c4', 'bishop', 'black'],
      ]),
      castling: fullRights(),
    })
    let names = moveNames(legalMoves(state, sq('e1')))
    expect(names).not.toContain('e1g1')
    expect(names).toContain('e1c1')
  })

  test('king in check cannot castle', () => {
    let state = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['a1', 'rook', 'white'],
        ['h1', 'rook', 'white'],
        ['e8', 'rook', 'black'],
      ]),
      castling: fullRights(),
    })
    expect(isInCheck(state, 'white')).toBe(true)
    let names = moveNames(legalMoves(state, sq('e1')))
    expect(names).not.toContain('e1g1')
    expect(names).not.toContain('e1c1')
  })

  test('kingside castle moves king and rook', () => {
    let state = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['a1', 'rook', 'white'],
        ['h1', 'rook', 'white'],
      ]),
      castling: fullRights(),
    })
    let next = applyMove(state, mv('e1', 'g1'))
    expect(at(next.board, 'g1')).toEqual({ type: 'king', color: 'white' })
    expect(at(next.board, 'f1')).toEqual({ type: 'rook', color: 'white' })
    expect(at(next.board, 'e1')).toBeNull()
    expect(at(next.board, 'h1')).toBeNull()
    expect(next.castling.whiteKingside).toBe(false)
    expect(next.castling.whiteQueenside).toBe(false)
    expect(next.castling.blackKingside).toBe(true)
    expect(next.turn).toBe('black')
  })

  test('queenside castle lands rook on d1', () => {
    let state = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['a1', 'rook', 'white'],
        ['h1', 'rook', 'white'],
      ]),
      castling: fullRights(),
    })
    let next = applyMove(state, mv('e1', 'c1'))
    expect(at(next.board, 'c1')).toEqual({ type: 'king', color: 'white' })
    expect(at(next.board, 'd1')).toEqual({ type: 'rook', color: 'white' })
    expect(at(next.board, 'a1')).toBeNull()
  })

  test('king cannot step onto an attacked square', () => {
    let state = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['e8', 'rook', 'black'],
      ]),
    })
    expect(moveNames(legalMoves(state, sq('e1')))).toEqual(['e1d1', 'e1d2', 'e1f1', 'e1f2'])
  })

  test('king move drops both castling rights', () => {
    let state = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['a1', 'rook', 'white'],
        ['h1', 'rook', 'white'],
      ]),
      castling: fullRights(),
    })
    let next = applyMove(state, mv('e1', 'f1'))
    expect(next.castling.whiteKingside).toBe(false)
    expect(next.castling.whiteQueenside).toBe(false)
  })

  test('rook move drops only its own side right', () => {
    let state = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['a1', 'rook', 'white'],
        ['h1', 'rook', 'white'],
      ]),
      castling: fullRights(),
    })
    let next = applyMove(state, mv('h1', 'h2'))
    expect(next.castling.whiteKingside).toBe(false)
    expect(next.castling.whiteQueenside).toBe(true)
  })

  test('capturing a corner rook drops the right', () => {
    let state = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['a1', 'rook', 'white'],
        ['h1', 'rook', 'white'],
        ['b2', 'bishop', 'black'],
        ['e8', 'king', 'black'],
      ]),
      turn: 'black',
      castling: fullRights(),
    })
    let next = applyMove(state, mv('b2', 'a1'))
    expect(next.castling.whiteQueenside).toBe(false)
    expect(next.castling.whiteKingside).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// pins, checks, validation
// ---------------------------------------------------------------------------

describe('pins and checks', () => {
  test('pinned rook slides along the pin only', () => {
    let state = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['e2', 'rook', 'white'],
        ['e8', 'rook', 'black'],
      ]),
    })
    expect(moveNames(legalMoves(state, sq('e2')))).toEqual([
      'e2e3',
      'e2e4',
      'e2e5',
      'e2e6',
      'e2e7',
      'e2e8',
    ])
  })

  test('leaving the pin is illegal', () => {
    let state = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['e2', 'rook', 'white'],
        ['e8', 'rook', 'black'],
      ]),
    })
    expect(() => applyMove(state, mv('e2', 'd2'))).toThrow()
    expect(isLegalMove(state, mv('e2', 'd2'))).toBe(false)
    expect(isLegalMove(state, mv('e2', 'e8'))).toBe(true)
  })

  test('isInCheck sees an open file, blocked file is safe', () => {
    let open = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['e8', 'rook', 'black'],
      ]),
    })
    expect(isInCheck(open, 'white')).toBe(true)
    let blocked = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['e2', 'pawn', 'white'],
        ['e8', 'rook', 'black'],
      ]),
    })
    expect(isInCheck(blocked, 'white')).toBe(false)
  })

  test('knight check is detected', () => {
    let state = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['d3', 'knight', 'black'],
      ]),
    })
    expect(isInCheck(state, 'white')).toBe(true)
  })

  test('no king on board means no check (unit-test positions)', () => {
    let state = custom({ board: withPieces([['e4', 'pawn', 'white']]) })
    expect(isInCheck(state, 'white')).toBe(false)
  })

  test('moving while in check without answering is illegal', () => {
    let state = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['a2', 'pawn', 'white'],
        ['e8', 'rook', 'black'],
      ]),
    })
    expect(() => applyMove(state, mv('a2', 'a3'))).toThrow()
  })

  test('moving from empty or foreign piece is illegal', () => {
    let state = initialGameState()
    expect(() => applyMove(state, mv('e4', 'e5'))).toThrow()
    expect(() => applyMove(state, mv('e7', 'e5'))).toThrow()
    expect(isLegalMove(state, mv('e2', 'e5'))).toBe(false)
    expect(isLegalMove(state, mv('e2', 'e4'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// en passant
// ---------------------------------------------------------------------------

describe('en passant', () => {
  test('white captures en passant', () => {
    let state = custom({
      board: withPieces([
        ['e5', 'pawn', 'white'],
        ['d5', 'pawn', 'black'],
      ]),
      enPassant: sq('d6'),
    })
    expect(moveNames(legalMoves(state, sq('e5')))).toEqual(['e5d6', 'e5e6'])
  })

  test('en passant removes the jumped pawn', () => {
    let state = custom({
      board: withPieces([
        ['e5', 'pawn', 'white'],
        ['d5', 'pawn', 'black'],
      ]),
      enPassant: sq('d6'),
    })
    let next = applyMove(state, mv('e5', 'd6'))
    expect(at(next.board, 'd6')).toEqual({ type: 'pawn', color: 'white' })
    expect(at(next.board, 'd5')).toBeNull()
    expect(at(next.board, 'e5')).toBeNull()
    expect(next.enPassant).toBeNull()
    expect(next.turn).toBe('black')
  })

  test('without the ep square there is no ep capture', () => {
    let state = custom({
      board: withPieces([
        ['e5', 'pawn', 'white'],
        ['d5', 'pawn', 'black'],
      ]),
    })
    expect(moveNames(legalMoves(state, sq('e5')))).toEqual(['e5e6'])
  })

  test('black captures en passant', () => {
    let state = custom({
      board: withPieces([
        ['e4', 'pawn', 'black'],
        ['d4', 'pawn', 'white'],
      ]),
      turn: 'black',
      enPassant: sq('d3'),
    })
    expect(moveNames(legalMoves(state, sq('e4')))).toEqual(['e4d3', 'e4e3'])
    let next = applyMove(state, mv('e4', 'd3'))
    expect(at(next.board, 'd3')).toEqual({ type: 'pawn', color: 'black' })
    expect(at(next.board, 'd4')).toBeNull()
  })

  test('double push sets the ep square', () => {
    let next = applyMove(initialGameState(), mv('e2', 'e4'))
    expect(next.enPassant).toEqual(sq('e3'))
  })
})

// ---------------------------------------------------------------------------
// promotion execution
// ---------------------------------------------------------------------------

describe('promotion', () => {
  test('pawn becomes the chosen piece', () => {
    let state = custom({ board: withPieces([['e7', 'pawn', 'white']]) })
    let next = applyMove(state, mv('e7', 'e8', 'queen'))
    expect(at(next.board, 'e8')).toEqual({ type: 'queen', color: 'white' })
    expect(at(next.board, 'e7')).toBeNull()
    expect(next.turn).toBe('black')
    expect(next.halfmove).toBe(0)
  })

  test('capture promotion replaces the victim', () => {
    let state = custom({
      board: withPieces([
        ['e7', 'pawn', 'white'],
        ['d8', 'rook', 'black'],
      ]),
    })
    let next = applyMove(state, mv('e7', 'd8', 'knight'))
    expect(at(next.board, 'd8')).toEqual({ type: 'knight', color: 'white' })
  })

  test('promotion without a choice, or a bogus choice, throws', () => {
    let state = custom({ board: withPieces([['e7', 'pawn', 'white']]) })
    expect(() => applyMove(state, mv('e7', 'e8'))).toThrow()
    let quiet = custom({ board: withPieces([['e4', 'pawn', 'white']]) })
    expect(() => applyMove(quiet, mv('e4', 'e5', 'queen'))).toThrow()
  })
})

// ---------------------------------------------------------------------------
// attack map
// ---------------------------------------------------------------------------

describe('isSquareAttacked', () => {
  test('pawn attacks diagonally forward only', () => {
    let state = custom({ board: withPieces([['e4', 'pawn', 'white']]) })
    expect(isSquareAttacked(state, sq('d5'), 'white')).toBe(true)
    expect(isSquareAttacked(state, sq('f5'), 'white')).toBe(true)
    expect(isSquareAttacked(state, sq('e5'), 'white')).toBe(false)
    expect(isSquareAttacked(state, sq('d4'), 'white')).toBe(false)
  })

  test('black pawns attack down the board', () => {
    let state = custom({ board: withPieces([['e5', 'pawn', 'black']]) })
    expect(isSquareAttacked(state, sq('d4'), 'black')).toBe(true)
    expect(isSquareAttacked(state, sq('f4'), 'black')).toBe(true)
    expect(isSquareAttacked(state, sq('e4'), 'black')).toBe(false)
  })

  test('knight jumps are attacks, nearby squares are not', () => {
    let state = custom({ board: withPieces([['b1', 'knight', 'white']]) })
    expect(isSquareAttacked(state, sq('a3'), 'white')).toBe(true)
    expect(isSquareAttacked(state, sq('c3'), 'white')).toBe(true)
    expect(isSquareAttacked(state, sq('d2'), 'white')).toBe(true)
    expect(isSquareAttacked(state, sq('b2'), 'white')).toBe(false)
  })

  test('sliders defend the first piece but see nothing behind it', () => {
    let state = custom({
      board: withPieces([
        ['c1', 'bishop', 'white'],
        ['b2', 'knight', 'white'],
      ]),
    })
    expect(isSquareAttacked(state, sq('b2'), 'white')).toBe(true)
    expect(isSquareAttacked(state, sq('a3'), 'white')).toBe(false)
  })

  test('rook owns the open file', () => {
    let state = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['e8', 'rook', 'black'],
      ]),
    })
    expect(isSquareAttacked(state, sq('e1'), 'black')).toBe(true)
    expect(isSquareAttacked(state, sq('e4'), 'black')).toBe(true)
  })

  test('king attacks its neighbours', () => {
    let state = custom({ board: withPieces([['e1', 'king', 'white']]) })
    expect(isSquareAttacked(state, sq('d1'), 'white')).toBe(true)
    expect(isSquareAttacked(state, sq('e2'), 'white')).toBe(true)
    expect(isSquareAttacked(state, sq('f2'), 'white')).toBe(true)
    expect(isSquareAttacked(state, sq('e3'), 'white')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// clocks & purity
// ---------------------------------------------------------------------------

describe('clocks and purity', () => {
  test('quiet move ticks halfmove, pawn move resets it', () => {
    let knight = applyMove(initialGameState(), mv('g1', 'f3'))
    expect(knight.halfmove).toBe(1)
    expect(knight.fullmove).toBe(1)
    expect(knight.turn).toBe('black')
    let pawnReply = applyMove(knight, mv('e7', 'e5'))
    expect(pawnReply.halfmove).toBe(0)
    expect(pawnReply.fullmove).toBe(2)
    expect(pawnReply.turn).toBe('white')
  })

  test('capture resets halfmove', () => {
    let state = custom({
      board: withPieces([
        ['e4', 'pawn', 'white'],
        ['d5', 'pawn', 'black'],
      ]),
    })
    expect(applyMove(state, mv('e4', 'd5')).halfmove).toBe(0)
  })

  test('applyMove never mutates its input', () => {
    let state = initialGameState()
    let snapshot = JSON.stringify(state)
    applyMove(state, mv('e2', 'e4'))
    expect(JSON.stringify(state)).toBe(snapshot)
  })
})

// ---------------------------------------------------------------------------
// game status
// ---------------------------------------------------------------------------

describe('game status', () => {
  test("fool's mate is checkmate for black", () => {
    let s1 = applyMove(initialGameState(), mv('f2', 'f3'))
    let s2 = applyMove(s1, mv('e7', 'e5'))
    let s3 = applyMove(s2, mv('g2', 'g4'))
    let s4 = applyMove(s3, mv('d8', 'h4'))
    expect(isInCheck(s4, 'white')).toBe(true)
    expect(allLegalMoves(s4, 'white')).toEqual([])
    expect(getGameStatus(s4)).toEqual({ status: 'checkmate', winner: 'black' })
  })

  test('corner squeeze is stalemate', () => {
    let state = custom({
      board: withPieces([
        ['a8', 'king', 'black'],
        ['a6', 'king', 'white'],
        ['c7', 'queen', 'white'],
      ]),
      turn: 'black',
    })
    expect(isInCheck(state, 'black')).toBe(false)
    expect(allLegalMoves(state, 'black')).toEqual([])
    expect(getGameStatus(state)).toEqual({ status: 'stalemate', winner: null })
  })

  test('open position is ongoing', () => {
    expect(getGameStatus(initialGameState())).toEqual({ status: 'ongoing', winner: null })
  })

  test('hundred halfmoves is a fifty-move draw', () => {
    let state = custom({ board: initialGameState().board, halfmove: 100 })
    expect(getGameStatus(state)).toEqual({ status: 'draw-fifty', winner: null })
  })

  test('bare kings are a material draw', () => {
    let state = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['e8', 'king', 'black'],
      ]),
    })
    expect(getGameStatus(state)).toEqual({ status: 'draw-material', winner: null })
  })

  test('king plus minor against bare king is a material draw', () => {
    let bishop = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['c1', 'bishop', 'white'],
        ['e8', 'king', 'black'],
      ]),
    })
    expect(getGameStatus(bishop)).toEqual({ status: 'draw-material', winner: null })
    let knight = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['b1', 'knight', 'white'],
        ['e8', 'king', 'black'],
      ]),
    })
    expect(getGameStatus(knight)).toEqual({ status: 'draw-material', winner: null })
  })

  test('extra queen means the game goes on', () => {
    let state = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['d1', 'queen', 'white'],
        ['e8', 'king', 'black'],
      ]),
    })
    expect(getGameStatus(state)).toEqual({ status: 'ongoing', winner: null })
  })
})

describe('material', () => {
  test('start is even at 39 points each', () => {
    expect(materialScore(initialGameState().board)).toEqual({ white: 39, black: 39, diff: 0 })
  })

  test('nothing is captured at start', () => {
    expect(capturedPieces(initialGameState().board, 'white')).toEqual([])
    expect(capturedPieces(initialGameState().board, 'black')).toEqual([])
  })

  test('exd5 wins a pawn', () => {
    let s1 = applyMove(initialGameState(), mv('e2', 'e4'))
    let s2 = applyMove(s1, mv('d7', 'd5'))
    let s3 = applyMove(s2, mv('e4', 'd5'))
    expect(materialScore(s3.board)).toEqual({ white: 39, black: 38, diff: 1 })
    expect(capturedPieces(s3.board, 'white')).toEqual(['pawn'])
    expect(capturedPieces(s3.board, 'black')).toEqual([])
  })

  test('strongest captures come first', () => {
    let state = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['e8', 'king', 'black'],
        ['a1', 'rook', 'white'],
      ]),
    })
    // black is missing a queen, two rooks... no: black has only a king,
    // so white captured everything except the king
    expect(capturedPieces(state.board, 'white')).toEqual([
      'queen',
      'rook',
      'rook',
      'bishop',
      'bishop',
      'knight',
      'knight',
      'pawn',
      'pawn',
      'pawn',
      'pawn',
      'pawn',
      'pawn',
      'pawn',
      'pawn',
    ])
    expect(materialScore(state.board)).toEqual({ white: 5, black: 0, diff: 5 })
  })
})

describe('boardsEqual and detectMove', () => {
  test('equal boards match, different ones do not', () => {
    let a = initialGameState()
    let b = applyMove(a, mv('e2', 'e4'))
    expect(boardsEqual(a.board, a.board)).toBe(true)
    expect(boardsEqual(a.board, b.board)).toBe(false)
  })

  test('detects a quiet pawn push', () => {
    let prev = initialGameState()
    let next = applyMove(prev, mv('e2', 'e4'))
    expect(detectMove(prev, next)).toEqual({ from: sq('e2'), to: sq('e4') })
  })

  test('returns null when the turn did not change', () => {
    let prev = initialGameState()
    expect(detectMove(prev, prev)).toBeNull()
  })

  test('detects a capture', () => {
    let s1 = applyMove(initialGameState(), mv('e2', 'e4'))
    let s2 = applyMove(s1, mv('d7', 'd5'))
    let s3 = applyMove(s2, mv('e4', 'd5'))
    expect(detectMove(s2, s3)).toEqual({ from: sq('e4'), to: sq('d5') })
  })

  test('detects castling', () => {
    let prev = custom({
      board: withPieces([
        ['e1', 'king', 'white'],
        ['a1', 'rook', 'white'],
        ['h1', 'rook', 'white'],
      ]),
      castling: fullRights(),
    })
    let next = applyMove(prev, mv('e1', 'g1'))
    expect(detectMove(prev, next)).toEqual({ from: sq('e1'), to: sq('g1') })
  })

  test('detects a promotion with the right piece', () => {
    let prev = custom({ board: withPieces([['e7', 'pawn', 'white']]) })
    let next = applyMove(prev, mv('e7', 'e8', 'queen'))
    expect(detectMove(prev, next)).toEqual({
      from: sq('e7'),
      to: sq('e8'),
      promotion: 'queen',
    })
  })
})
