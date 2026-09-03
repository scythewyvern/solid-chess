export type Color = 'white' | 'black'

export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king'

export interface Piece {
  type: PieceType
  color: Color
}

export type Cell = Piece | null

export type Board = Cell[][]

export interface Square {
  row: number
  col: number
}

export interface Move {
  from: Square
  to: Square
  promotion?: PieceType
}

export interface CastlingRights {
  whiteKingside: boolean
  whiteQueenside: boolean
  blackKingside: boolean
  blackQueenside: boolean
}

export interface GameState {
  board: Board
  turn: Color
  castling: CastlingRights
  enPassant: Square | null
  halfmove: number
  fullmove: number
}

export type GameStatus = 'ongoing' | 'checkmate' | 'stalemate' | 'draw-fifty' | 'draw-material'

export interface StatusResult {
  status: GameStatus
  winner: Color | null
}

export function opposite(color: Color): Color {
  if (color === 'white') {
    return 'black'
  }
  return 'white'
}

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8
}

export function squareName(square: Square): string {
  let files = 'abcdefgh'
  return files.charAt(square.col) + String(8 - square.row)
}

export function parseSquare(name: string): Square {
  if (/^[a-h][1-8]$/.test(name) === false) {
    throw new Error('Invalid square name: ' + name)
  }
  let col = name.charCodeAt(0) - 97
  let row = 8 - Number(name.charAt(1))
  return { row: row, col: col }
}

export function initialGameState(): GameState {
  let backRank: PieceType[] = [
    'rook',
    'knight',
    'bishop',
    'queen',
    'king',
    'bishop',
    'knight',
    'rook',
  ]
  let board: Board = []
  let row = 0
  while (row < 8) {
    let newRow: Cell[] = []
    let col = 0
    while (col < 8) {
      let cell: Cell = null
      if (row === 0) {
        let blackBack: PieceType | undefined = backRank[col]
        if (blackBack !== undefined) {
          cell = { type: blackBack, color: 'black' }
        }
      } else if (row === 1) {
        cell = { type: 'pawn', color: 'black' }
      } else if (row === 6) {
        cell = { type: 'pawn', color: 'white' }
      } else if (row === 7) {
        let whiteBack: PieceType | undefined = backRank[col]
        if (whiteBack !== undefined) {
          cell = { type: whiteBack, color: 'white' }
        }
      }
      newRow.push(cell)
      col = col + 1
    }
    board.push(newRow)
    row = row + 1
  }
  return {
    board: board,
    turn: 'white',
    castling: {
      whiteKingside: true,
      whiteQueenside: true,
      blackKingside: true,
      blackQueenside: true,
    },
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
  }
}

export function getPiece(state: GameState, square: Square): Piece | null {
  if (inBounds(square.row, square.col) === false) {
    return null
  }
  let boardRow: Cell[] | undefined = state.board[square.row]
  if (boardRow === undefined) {
    return null
  }
  let cell: Cell | undefined = boardRow[square.col]
  if (cell === undefined) {
    return null
  }
  return cell
}

export function cloneBoard(board: Board): Board {
  let cloned: Board = []
  let row = 0
  while (row < 8) {
    let sourceRow: Cell[] | undefined = board[row]
    let newRow: Cell[] = []
    if (sourceRow === undefined) {
      cloned.push(newRow)
      row = row + 1
      continue
    }
    let col = 0
    while (col < 8) {
      let cell: Cell | undefined = sourceRow[col]
      if (cell === null || cell === undefined) {
        newRow.push(null)
      } else {
        newRow.push({ type: cell.type, color: cell.color })
      }
      col = col + 1
    }
    cloned.push(newRow)
    row = row + 1
  }
  return cloned
}

export function findKing(board: Board, color: Color): Square | null {
  let row = 0
  while (row < 8) {
    let boardRow: Cell[] | undefined = board[row]
    if (boardRow !== undefined) {
      let col = 0
      while (col < 8) {
        let cell: Cell | undefined = boardRow[col]
        if (cell !== null && cell !== undefined) {
          if (cell.type === 'king' && cell.color === color) {
            return { row: row, col: col }
          }
        }
        col = col + 1
      }
    }
    row = row + 1
  }
  return null
}

export function sameSquare(a: Square, b: Square): boolean {
  return a.row === b.row && a.col === b.col
}

function pawnAttacksSquare(board: Board, square: Square, byColor: Color): boolean {
  let pawnRow: number = square.row + 1
  if (byColor === 'black') {
    pawnRow = square.row - 1
  }
  for (let dc of [-1, 1]) {
    if (inBounds(pawnRow, square.col + dc) === false) {
      continue
    }
    let rowCells: Cell[] | undefined = board[pawnRow]
    if (rowCells === undefined) {
      continue
    }
    let attacker: Cell | undefined = rowCells[square.col + dc]
    if (
      attacker !== undefined &&
      attacker !== null &&
      attacker.type === 'pawn' &&
      attacker.color === byColor
    ) {
      return true
    }
  }
  return false
}

function leaperAttacksSquare(
  board: Board,
  square: Square,
  byColor: Color,
  type: 'knight' | 'king',
  offsets: Array<[number, number]>
): boolean {
  for (let off of offsets) {
    let r: number = square.row + off[0]
    let c: number = square.col + off[1]
    if (inBounds(r, c) === false) {
      continue
    }
    let rowCells: Cell[] | undefined = board[r]
    if (rowCells === undefined) {
      continue
    }
    let attacker: Cell | undefined = rowCells[c]
    if (
      attacker !== undefined &&
      attacker !== null &&
      attacker.type === type &&
      attacker.color === byColor
    ) {
      return true
    }
  }
  return false
}

function sliderAttacksSquare(
  board: Board,
  square: Square,
  byColor: Color,
  dirs: Array<[number, number]>,
  types: Array<PieceType>
): boolean {
  for (let dir of dirs) {
    let r: number = square.row + dir[0]
    let c: number = square.col + dir[1]
    while (inBounds(r, c)) {
      let rowCells: Cell[] | undefined = board[r]
      if (rowCells === undefined) {
        break
      }
      let blocker: Cell | undefined = rowCells[c]
      if (blocker === undefined) {
        break
      }
      if (blocker === null) {
        r = r + dir[0]
        c = c + dir[1]
        continue
      }
      if (blocker.color === byColor && types.includes(blocker.type)) {
        return true
      }
      break
    }
  }
  return false
}

export function isSquareAttacked(state: GameState, square: Square, byColor: Color): boolean {
  let board: Board = state.board
  if (pawnAttacksSquare(board, square, byColor)) {
    return true
  }
  let knightOffsets: Array<[number, number]> = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ]
  if (leaperAttacksSquare(board, square, byColor, 'knight', knightOffsets)) {
    return true
  }
  let kingOffsets: Array<[number, number]> = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ]
  if (leaperAttacksSquare(board, square, byColor, 'king', kingOffsets)) {
    return true
  }
  let orthDirs: Array<[number, number]> = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]
  if (sliderAttacksSquare(board, square, byColor, orthDirs, ['rook', 'queen'])) {
    return true
  }
  let diagDirs: Array<[number, number]> = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]
  return sliderAttacksSquare(board, square, byColor, diagDirs, ['bishop', 'queen'])
}

export function knightMoves(state: GameState, square: Square): Move[] {
  let result: Move[] = []
  let homeRow: Cell[] | undefined = state.board[square.row]
  if (homeRow === undefined) {
    return result
  }
  let piece: Cell | undefined = homeRow[square.col]
  if (piece === undefined || piece === null || piece.type !== 'knight') {
    return result
  }
  let offsets: Array<[number, number]> = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ]
  let i: number = 0
  while (i < offsets.length) {
    let off: [number, number] | undefined = offsets[i]
    i = i + 1
    if (off === undefined) {
      continue
    }
    let r: number = square.row + off[0]
    let c: number = square.col + off[1]
    if (inBounds(r, c) === false) {
      continue
    }
    let rowCells: Cell[] | undefined = state.board[r]
    if (rowCells === undefined) {
      continue
    }
    let target: Cell | undefined = rowCells[c]
    if (target === undefined) {
      continue
    }
    if (target !== null && target.color === piece.color) {
      continue
    }
    if (target !== null && target.type === 'king' && target.color !== piece.color) {
      continue
    }
    let from: Square = { row: square.row, col: square.col }
    let to: Square = { row: r, col: c }
    let m: Move = { from: from, to: to }
    result.push(m)
  }
  return result
}

export function bishopMoves(state: GameState, square: Square): Move[] {
  let result: Move[] = []
  let homeRow: Cell[] | undefined = state.board[square.row]
  if (homeRow === undefined) {
    return result
  }
  let piece: Cell | undefined = homeRow[square.col]
  if (piece === undefined || piece === null || piece.type !== 'bishop') {
    return result
  }
  let dirs: Array<[number, number]> = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]
  let i: number = 0
  while (i < dirs.length) {
    let dir: [number, number] | undefined = dirs[i]
    i = i + 1
    if (dir === undefined) {
      continue
    }
    let r: number = square.row + dir[0]
    let c: number = square.col + dir[1]
    while (inBounds(r, c)) {
      let rowCells: Cell[] | undefined = state.board[r]
      if (rowCells === undefined) {
        break
      }
      let target: Cell | undefined = rowCells[c]
      if (target === undefined) {
        break
      }
      if (target === null) {
        let from: Square = { row: square.row, col: square.col }
        let to: Square = { row: r, col: c }
        let m: Move = { from: from, to: to }
        result.push(m)
        r = r + dir[0]
        c = c + dir[1]
        continue
      }
      if (target.color !== piece.color && target.type !== 'king') {
        let from2: Square = { row: square.row, col: square.col }
        let to2: Square = { row: r, col: c }
        let m2: Move = { from: from2, to: to2 }
        result.push(m2)
      }
      break
    }
  }
  return result
}

export function rookMoves(state: GameState, square: Square): Move[] {
  let result: Move[] = []
  let homeRow: Cell[] | undefined = state.board[square.row]
  if (homeRow === undefined) {
    return result
  }
  let piece: Cell | undefined = homeRow[square.col]
  if (piece === undefined || piece === null || piece.type !== 'rook') {
    return result
  }
  let dirs: Array<[number, number]> = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]
  let i: number = 0
  while (i < dirs.length) {
    let dir: [number, number] | undefined = dirs[i]
    i = i + 1
    if (dir === undefined) {
      continue
    }
    let r: number = square.row + dir[0]
    let c: number = square.col + dir[1]
    while (inBounds(r, c)) {
      let rowCells: Cell[] | undefined = state.board[r]
      if (rowCells === undefined) {
        break
      }
      let target: Cell | undefined = rowCells[c]
      if (target === undefined) {
        break
      }
      if (target === null) {
        let from: Square = { row: square.row, col: square.col }
        let to: Square = { row: r, col: c }
        let m: Move = { from: from, to: to }
        result.push(m)
        r = r + dir[0]
        c = c + dir[1]
        continue
      }
      if (target.color !== piece.color && target.type !== 'king') {
        let from2: Square = { row: square.row, col: square.col }
        let to2: Square = { row: r, col: c }
        let m2: Move = { from: from2, to: to2 }
        result.push(m2)
      }
      break
    }
  }
  return result
}

export function queenMoves(state: GameState, square: Square): Move[] {
  let result: Move[] = []
  let homeRow: Cell[] | undefined = state.board[square.row]
  if (homeRow === undefined) {
    return result
  }
  let piece: Cell | undefined = homeRow[square.col]
  if (piece === undefined || piece === null || piece.type !== 'queen') {
    return result
  }
  let dirs: Array<[number, number]> = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]
  let i: number = 0
  while (i < dirs.length) {
    let dir: [number, number] | undefined = dirs[i]
    i = i + 1
    if (dir === undefined) {
      continue
    }
    let r: number = square.row + dir[0]
    let c: number = square.col + dir[1]
    while (inBounds(r, c)) {
      let rowCells: Cell[] | undefined = state.board[r]
      if (rowCells === undefined) {
        break
      }
      let target: Cell | undefined = rowCells[c]
      if (target === undefined) {
        break
      }
      if (target === null) {
        let from: Square = { row: square.row, col: square.col }
        let to: Square = { row: r, col: c }
        let m: Move = { from: from, to: to }
        result.push(m)
        r = r + dir[0]
        c = c + dir[1]
        continue
      }
      if (target.color !== piece.color && target.type !== 'king') {
        let from2: Square = { row: square.row, col: square.col }
        let to2: Square = { row: r, col: c }
        let m2: Move = { from: from2, to: to2 }
        result.push(m2)
      }
      break
    }
  }
  return result
}

export function kingSteps(state: GameState, square: Square): Move[] {
  let result: Move[] = []
  let homeRow: Cell[] | undefined = state.board[square.row]
  if (homeRow === undefined) {
    return result
  }
  let piece: Cell | undefined = homeRow[square.col]
  if (piece === undefined || piece === null || piece.type !== 'king') {
    return result
  }
  let offsets: Array<[number, number]> = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ]
  let i: number = 0
  while (i < offsets.length) {
    let off: [number, number] | undefined = offsets[i]
    i = i + 1
    if (off === undefined) {
      continue
    }
    let r: number = square.row + off[0]
    let c: number = square.col + off[1]
    if (inBounds(r, c) === false) {
      continue
    }
    let rowCells: Cell[] | undefined = state.board[r]
    if (rowCells === undefined) {
      continue
    }
    let target: Cell | undefined = rowCells[c]
    if (target === undefined) {
      continue
    }
    if (target !== null && target.color === piece.color) {
      continue
    }
    if (target !== null && target.type === 'king' && target.color !== piece.color) {
      continue
    }
    let from: Square = { row: square.row, col: square.col }
    let to: Square = { row: r, col: c }
    let m: Move = { from: from, to: to }
    result.push(m)
  }
  return result
}

function pushPawnAdvance(moves: Move[], from: Square, to: Square, lastRow: number): void {
  if (to.row !== lastRow) {
    moves.push({ from: from, to: to })
    return
  }
  let promos: PieceType[] = ['queen', 'rook', 'bishop', 'knight']
  for (let promotion of promos) {
    moves.push({ from: from, to: to, promotion: promotion })
  }
}

function tryPawnEnPassant(
  moves: Move[],
  state: GameState,
  square: Square,
  dest: Square,
  dc: number,
  enemy: Color
): void {
  if (state.enPassant === null || sameSquare(dest, state.enPassant) === false) {
    return
  }
  let capRow = square.row
  let capCol = square.col + dc
  if (inBounds(capRow, capCol) === false) {
    return
  }
  let victim = state.board[capRow][capCol]
  if (victim === null || victim.type !== 'pawn' || victim.color !== enemy) {
    return
  }
  let landing = state.board[dest.row][dest.col]
  if (landing !== null) {
    return
  }
  moves.push({
    from: { row: square.row, col: square.col },
    to: { row: dest.row, col: dest.col },
  })
}

export function pawnMoves(state: GameState, square: Square): Move[] {
  let moves: Move[] = []
  if (inBounds(square.row, square.col) === false) {
    return moves
  }
  let piece = state.board[square.row][square.col]
  if (piece === null) {
    return moves
  }
  if (piece.type !== 'pawn') {
    return moves
  }
  let color = piece.color
  let enemy = opposite(color)
  let dr = -1
  let startRow = 6
  let lastRow = 0
  if (color === 'black') {
    dr = 1
    startRow = 1
    lastRow = 7
  }
  let from: Square = { row: square.row, col: square.col }
  let oneRow = square.row + dr
  if (inBounds(oneRow, square.col)) {
    let ahead = state.board[oneRow][square.col]
    if (ahead === null) {
      pushPawnAdvance(moves, from, { row: oneRow, col: square.col }, lastRow)
      if (square.row === startRow) {
        let twoRow = square.row + dr + dr
        if (inBounds(twoRow, square.col) && state.board[twoRow][square.col] === null) {
          moves.push({ from: from, to: { row: twoRow, col: square.col } })
        }
      }
    }
  }
  let sides: Array<number> = [-1, 1]
  for (let dc of sides) {
    let dest: Square = { row: oneRow, col: square.col + dc }
    if (inBounds(dest.row, dest.col) === false) {
      continue
    }
    let target = state.board[dest.row][dest.col]
    if (target !== null && target.color === enemy && target.type !== 'king') {
      pushPawnAdvance(moves, from, dest, lastRow)
    }
    tryPawnEnPassant(moves, state, square, dest, dc, enemy)
  }
  return moves
}

function castleFlag(rights: CastlingRights, color: Color, kingside: boolean): boolean {
  if (color === 'white') {
    return kingside ? rights.whiteKingside : rights.whiteQueenside
  }
  return kingside ? rights.blackKingside : rights.blackQueenside
}

function castleSideMove(
  state: GameState,
  color: Color,
  enemy: Color,
  kingSquare: Square,
  kingside: boolean
): Move | null {
  if (castleFlag(state.castling, color, kingside) === false) {
    return null
  }
  let homeRow = 7
  if (color === 'black') {
    homeRow = 0
  }
  let rookCol = 7
  if (kingside === false) {
    rookCol = 0
  }
  let rook = state.board[homeRow][rookCol]
  if (rook === null || rook.type !== 'rook' || rook.color !== color) {
    return null
  }
  if (isSquareAttacked(state, kingSquare, enemy)) {
    return null
  }
  let through: Array<number> = [5, 6]
  let targetCol = 6
  if (kingside === false) {
    through = [3, 2]
    targetCol = 2
  }
  for (let col of through) {
    if (state.board[homeRow][col] !== null) {
      return null
    }
    if (isSquareAttacked(state, { row: homeRow, col: col }, enemy)) {
      return null
    }
  }
  return {
    from: { row: kingSquare.row, col: kingSquare.col },
    to: { row: homeRow, col: targetCol },
  }
}

export function castlingMoves(state: GameState, color: Color): Move[] {
  let moves: Move[] = []
  let homeRow = 7
  if (color === 'black') {
    homeRow = 0
  }
  let king = state.board[homeRow][4]
  if (king === null || king.type !== 'king' || king.color !== color) {
    return moves
  }
  let enemy = opposite(color)
  let kingSquare: Square = { row: homeRow, col: 4 }
  let kingside = castleSideMove(state, color, enemy, kingSquare, true)
  if (kingside !== null) {
    moves.push(kingside)
  }
  let queenside = castleSideMove(state, color, enemy, kingSquare, false)
  if (queenside !== null) {
    moves.push(queenside)
  }
  return moves
}

function rookHomeRight(row: number, col: number): keyof CastlingRights | null {
  if (row === 7 && col === 0) {
    return 'whiteQueenside'
  }
  if (row === 7 && col === 7) {
    return 'whiteKingside'
  }
  if (row === 0 && col === 0) {
    return 'blackQueenside'
  }
  if (row === 0 && col === 7) {
    return 'blackKingside'
  }
  return null
}

export function nextCastlingRights(state: GameState, move: Move): CastlingRights {
  let rights: CastlingRights = {
    whiteKingside: state.castling.whiteKingside,
    whiteQueenside: state.castling.whiteQueenside,
    blackKingside: state.castling.blackKingside,
    blackQueenside: state.castling.blackQueenside,
  }
  if (inBounds(move.from.row, move.from.col) === false) {
    return rights
  }
  if (inBounds(move.to.row, move.to.col) === false) {
    return rights
  }
  let mover = state.board[move.from.row][move.from.col]
  let captured = state.board[move.to.row][move.to.col]
  if (mover !== null && mover.type === 'king') {
    if (mover.color === 'white') {
      rights.whiteKingside = false
      rights.whiteQueenside = false
    } else {
      rights.blackKingside = false
      rights.blackQueenside = false
    }
  }
  if (mover !== null && mover.type === 'rook') {
    let fromKey = rookHomeRight(move.from.row, move.from.col)
    if (fromKey !== null) {
      rights[fromKey] = false
    }
  }
  if (captured !== null && captured.type === 'rook') {
    let toKey = rookHomeRight(move.to.row, move.to.col)
    if (toKey !== null) {
      rights[toKey] = false
    }
  }
  return rights
}

export function pseudoLegalMoves(state: GameState, square: Square): Move[] {
  if (inBounds(square.row, square.col) === false) {
    return []
  }
  let piece = state.board[square.row][square.col]
  if (piece === null) {
    return []
  }
  if (piece.type === 'pawn') {
    return pawnMoves(state, square)
  }
  if (piece.type === 'knight') {
    return knightMoves(state, square)
  }
  if (piece.type === 'bishop') {
    return bishopMoves(state, square)
  }
  if (piece.type === 'rook') {
    return rookMoves(state, square)
  }
  if (piece.type === 'queen') {
    return queenMoves(state, square)
  }
  if (piece.type === 'king') {
    let steps = kingSteps(state, square)
    if (piece.color !== state.turn) {
      return steps
    }
    return steps.concat(castlingMoves(state, piece.color))
  }
  return []
}

function makeMove(state: GameState, move: Move): GameState {
  let board = cloneBoard(state.board)
  let source = state.board[move.from.row][move.from.col]
  if (source === null) {
    throw new Error('makeMove: no piece on from square')
  }
  let target = state.board[move.to.row][move.to.col]
  let isEnPassant = false
  if (
    source.type === 'pawn' &&
    state.enPassant !== null &&
    sameSquare(move.to, state.enPassant) &&
    target === null &&
    move.from.col !== move.to.col
  ) {
    isEnPassant = true
  }
  let isCapture = target !== null || isEnPassant
  board[move.from.row][move.from.col] = null
  if (isEnPassant) {
    board[move.from.row][move.to.col] = null
  }
  let placedType = source.type
  if (move.promotion !== undefined) {
    placedType = move.promotion
  }
  board[move.to.row][move.to.col] = { type: placedType, color: source.color }
  if (
    source.type === 'king' &&
    move.from.row === move.to.row &&
    Math.abs(move.to.col - move.from.col) === 2
  ) {
    if (move.to.col === 6) {
      let kingsideRook = board[move.from.row][7]
      board[move.from.row][7] = null
      board[move.from.row][5] = kingsideRook
    }
    if (move.to.col === 2) {
      let queensideRook = board[move.from.row][0]
      board[move.from.row][0] = null
      board[move.from.row][3] = queensideRook
    }
  }
  let castling = nextCastlingRights(state, move)
  let enPassant: Square | null = null
  if (source.type === 'pawn' && Math.abs(move.to.row - move.from.row) === 2) {
    enPassant = { row: (move.from.row + move.to.row) / 2, col: move.from.col }
  }
  let halfmove = 0
  if (source.type !== 'pawn' && isCapture === false) {
    halfmove = state.halfmove + 1
  }
  let fullmove = state.fullmove
  if (state.turn === 'black') {
    fullmove = state.fullmove + 1
  }
  return {
    board: board,
    turn: opposite(state.turn),
    castling: castling,
    enPassant: enPassant,
    halfmove: halfmove,
    fullmove: fullmove,
  }
}

export function isInCheck(state: GameState, color: Color): boolean {
  let king = findKing(state.board, color)
  if (king === null) {
    return false
  }
  return isSquareAttacked(state, king, opposite(color))
}

export function legalMoves(state: GameState, square: Square): Move[] {
  if (inBounds(square.row, square.col) === false) {
    return []
  }
  let piece = state.board[square.row][square.col]
  if (piece === null) {
    return []
  }
  if (piece.color !== state.turn) {
    return []
  }
  let pseudo = pseudoLegalMoves(state, square)
  if (findKing(state.board, state.turn) === null) {
    return pseudo
  }
  let out: Move[] = []
  let idx = 0
  while (idx < pseudo.length) {
    let cand = pseudo[idx]
    if (cand !== undefined && isInCheck(makeMove(state, cand), state.turn) === false) {
      out.push(cand)
    }
    idx = idx + 1
  }
  return out
}

export function allLegalMoves(state: GameState, color: Color = state.turn): Move[] {
  let effective: GameState = state
  if (color !== state.turn) {
    effective = { ...state, turn: color }
  }
  let out: Move[] = []
  let row = 0
  while (row < 8) {
    let col = 0
    while (col < 8) {
      let cell = effective.board[row][col]
      if (cell !== null && cell.color === color) {
        let ms = legalMoves(effective, { row: row, col: col })
        let k = 0
        while (k < ms.length) {
          let m = ms[k]
          if (m !== undefined) {
            out.push(m)
          }
          k = k + 1
        }
      }
      col = col + 1
    }
    row = row + 1
  }
  return out
}

export function applyMove(state: GameState, move: Move): GameState {
  if (
    inBounds(move.from.row, move.from.col) === false ||
    inBounds(move.to.row, move.to.col) === false
  ) {
    throw new Error('applyMove: move out of bounds')
  }
  let piece = state.board[move.from.row][move.from.col]
  if (piece === null) {
    throw new Error('applyMove: no piece on from square')
  }
  if (piece.color !== state.turn) {
    throw new Error('applyMove: piece does not belong to side to move')
  }
  let lastRank = 0
  if (piece.color === 'black') {
    lastRank = 7
  }
  let promotes = piece.type === 'pawn' && move.to.row === lastRank
  if (promotes && move.promotion === undefined) {
    throw new Error('applyMove: promotion piece required')
  }
  if (promotes === false && move.promotion !== undefined) {
    throw new Error('applyMove: unexpected promotion piece')
  }
  let options = legalMoves(state, move.from)
  let found = false
  let i = 0
  while (i < options.length) {
    let cand = options[i]
    if (
      cand !== undefined &&
      cand.from.row === move.from.row &&
      cand.from.col === move.from.col &&
      cand.to.row === move.to.row &&
      cand.to.col === move.to.col &&
      cand.promotion === move.promotion
    ) {
      found = true
    }
    i = i + 1
  }
  if (found === false) {
    throw new Error('applyMove: illegal move')
  }
  return makeMove(state, move)
}

export function isLegalMove(state: GameState, move: Move): boolean {
  try {
    applyMove(state, move)
    return true
  } catch {
    return false
  }
}

export function insufficientMaterial(board: Board): boolean {
  let count = 0
  let lone: PieceType | null = null
  let row = 0
  while (row < 8) {
    let col = 0
    while (col < 8) {
      let cell = board[row][col]
      if (cell !== null && cell.type !== 'king') {
        count = count + 1
        lone = cell.type
      }
      col = col + 1
    }
    row = row + 1
  }
  if (count === 0) {
    return true
  }
  if (count === 1 && (lone === 'bishop' || lone === 'knight')) {
    return true
  }
  return false
}

export function getGameStatus(state: GameState): StatusResult {
  let moves = allLegalMoves(state, state.turn)
  if (moves.length === 0) {
    if (isInCheck(state, state.turn)) {
      return { status: 'checkmate', winner: opposite(state.turn) }
    }
    return { status: 'stalemate', winner: null }
  }
  if (state.halfmove >= 100) {
    return { status: 'draw-fifty', winner: null }
  }
  if (insufficientMaterial(state.board)) {
    return { status: 'draw-material', winner: null }
  }
  return { status: 'ongoing', winner: null }
}

export const PIECE_VALUES: Record<PieceType, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0,
}

export interface MaterialScore {
  white: number
  black: number
  diff: number
}

export function materialScore(board: Board): MaterialScore {
  let white = 0
  let black = 0
  let row = 0
  while (row < 8) {
    let col = 0
    while (col < 8) {
      let cell = board[row][col]
      if (cell !== null) {
        if (cell.color === 'white') {
          white = white + PIECE_VALUES[cell.type]
        } else {
          black = black + PIECE_VALUES[cell.type]
        }
      }
      col = col + 1
    }
    row = row + 1
  }
  return { white: white, black: black, diff: white - black }
}

let START_COUNTS: Record<PieceType, number> = {
  pawn: 8,
  knight: 2,
  bishop: 2,
  rook: 2,
  queen: 1,
  king: 1,
}

let CAPTURE_ORDER: PieceType[] = ['queen', 'rook', 'bishop', 'knight', 'pawn']

// Pieces of the victim color missing from the board, strongest first.
// Promotions can inflate counts, so negative misses are clamped to zero.
export function capturedPieces(board: Board, by: Color): PieceType[] {
  let victim: Color = by === 'white' ? 'black' : 'white'
  let counts: Record<PieceType, number> = {
    pawn: 0,
    knight: 0,
    bishop: 0,
    rook: 0,
    queen: 0,
    king: 0,
  }
  let row = 0
  while (row < 8) {
    let col = 0
    while (col < 8) {
      let cell = board[row][col]
      if (cell !== null && cell.color === victim) {
        counts[cell.type] = counts[cell.type] + 1
      }
      col = col + 1
    }
    row = row + 1
  }
  let out: PieceType[] = []
  for (let type of CAPTURE_ORDER) {
    let missing = START_COUNTS[type] - counts[type]
    let i = 0
    while (i < missing) {
      out.push(type)
      i = i + 1
    }
  }
  return out
}

export function boardsEqual(a: Board, b: Board): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// Find the single legal move that turns prev into next, if any.
// Used to rebuild move history from bare position snapshots (e.g. network
// state). Returns null when the turn did not change or no legal move matches.
export function detectMove(prev: GameState, next: GameState): Move | null {
  if (prev.turn === next.turn) return null
  let candidates = allLegalMoves(prev, prev.turn)
  for (let cand of candidates) {
    let applied: GameState | null = null
    try {
      applied = applyMove(prev, cand)
    } catch {
      continue
    }
    if (boardsEqual(applied.board, next.board)) return cand
  }
  return null
}
