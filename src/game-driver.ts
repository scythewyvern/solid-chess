import type { Accessor } from 'solid-js'

import type { Color, GameState, Move, PieceType, Square } from './engine'

// The single seam between game state and the board UI. Both the local driver
// (useLocalGame) and the online driver (useOnlineGame) speak this interface,
// so GameView never knows where its position comes from.
export interface GameDriver {
  game: Accessor<GameState>
  history: Accessor<Move[]>
  orientation: Accessor<Color>
  canControl: (color: Color) => boolean
  inputLocked: () => boolean
  statusText: () => string
  turnDot: Accessor<Color | null>
  presence: Accessor<string | null>
  submitMove: (from: Square, to: Square, promotion?: PieceType) => void
}
