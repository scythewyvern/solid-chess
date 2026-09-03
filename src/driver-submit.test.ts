import { describe, expect, test } from 'bun:test'

import { createRoot } from 'solid-js'

import { parseSquare } from './engine'
import { useComputerGame } from './use-computer-game'
import { useLocalGame } from './use-local-game'

describe('local driver submitMove', () => {
  test('duplicate and illegal submits are ignored, never throw', () => {
    let local = useLocalGame()
    expect(() => {
      local.driver.submitMove(parseSquare('e2'), parseSquare('e4'))
      // Emulated second tap for the same move: e2 is empty now.
      local.driver.submitMove(parseSquare('e2'), parseSquare('e4'))
      // Outright illegal move.
      local.driver.submitMove(parseSquare('e2'), parseSquare('e5'))
    }).not.toThrow()
    expect(local.driver.history().length).toBe(1)
    expect(local.driver.game().turn).toBe('black')
  })
})

describe('computer driver submitMove', () => {
  test('illegal human submit is ignored, never throws', () => {
    let ctx = createRoot((dispose) => ({
      dispose,
      game: useComputerGame({ human: () => 'white', level: () => 'easy' }),
    }))
    try {
      expect(() => {
        // A pawn cannot jump e2 -> e5: stale input must not crash the board.
        ctx.game.driver.submitMove(parseSquare('e2'), parseSquare('e5'))
      }).not.toThrow()
      expect(ctx.game.driver.history().length).toBe(0)
      expect(ctx.game.driver.game().turn).toBe('white')
    } finally {
      ctx.dispose()
    }
  })
})
