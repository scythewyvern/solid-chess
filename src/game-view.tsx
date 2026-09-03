import { createDragContext } from '@solid-primitives/drag-drop'
import { createMemo, For, Show } from 'solid-js'
import type { JSX } from '@solidjs/web'

import type { PieceType } from './engine'
import { squareName } from './engine'
import type { GameDriver } from './game-driver'
import type { IconName } from './icon/icons'
import { PieceIcon } from './piece-icon'
import { SquareCell } from './square-cell'
import { useFlyAnimation } from './use-fly-animation'
import { useGameMeta } from './use-game-meta'
import { useMoveInput } from './use-move-input'
import { PIECE_NAMES } from './labels'

export interface GameViewProps {
  driver: GameDriver
  footer: JSX.Element
}

let PROMO_CHOICES: PieceType[] = ['queen', 'rook', 'bishop', 'knight']

// Board screen composed from a driver (local or online) and small hooks.
// No game rules here — only wiring between state, input and layout.
export function GameView(props: GameViewProps) {
  let driver = props.driver
  let meta = useGameMeta(driver.game, driver.history)
  let fly = useFlyAnimation(driver.game, driver.history, driver.orientation)
  let input = useMoveInput(driver, () => fly.suppressNext())

  let order = createMemo<number[]>(() => {
    return driver.orientation() === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]
  })

  let dnd = createDragContext({
    onDragStart: (item) => input.grabSquare(String(item.id)),
    onDragEnd: (item, over) => {
      if (over === null) {
        input.cancelDrag()
        return
      }
      input.dropSquares(String(item.id), String(over.id))
    },
    onDragCancel: () => input.cancelDrag(),
  })

  return (
    <div class='layout'>
      <dnd.Provider>
        <div class='board-wrap'>
          <div class='board' role='grid' aria-label='Chess board'>
            <For each={order()}>
              {(row) => (
                <div class='row' role='row'>
                  <For each={order()}>
                    {(col) => (
                      <SquareCell
                        row={row}
                        col={col}
                        game={driver.game}
                        canControl={driver.canControl}
                        inputLocked={driver.inputLocked}
                        gameOngoing={() => meta.status().status === 'ongoing'}
                        promoOpen={() => input.promo() !== null}
                        selected={input.selected}
                        lastMove={meta.lastMove}
                        targets={input.targets}
                        checkSquare={meta.checkSquare}
                        fly={fly.fly}
                        onTap={input.tapSquare}
                        onDropSquares={input.dropSquares}
                        onGrabSquare={input.grabSquare}
                        onDragCancel={input.cancelDrag}
                      />
                    )}
                  </For>
                </div>
              )}
            </For>
            <Show when={fly.fly() !== null}>
              <div class='fly-layer' aria-hidden='true' onAnimationEnd={fly.clear}>
                <For each={fly.fly() ?? []}>
                  {(f) => (
                    <div
                      class='fly-piece'
                      style={`--fr:${fly.display(f.from.row)};--fc:${fly.display(f.from.col)};--dx:${fly.display(f.to.col) - fly.display(f.from.col)};--dy:${fly.display(f.to.row) - fly.display(f.from.row)}`}
                    >
                      <span class='piece'>
                        <PieceIcon name={`${f.color}-${f.type}` as IconName} />
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
          <Show when={input.promo()}>
            {(pending) => (
              <div class='promo-overlay' role='dialog' aria-label='Choose a promotion piece'>
                <div class='promo-box'>
                  <div class='promo-title'>Promotion on {squareName(pending().to)} — choose a piece</div>
                  <div class='promo-choices'>
                    <For each={PROMO_CHOICES}>
                      {(type) => (
                        <button
                          type='button'
                          class='promo-choice'
                          onClick={() => input.choosePromotion(type)}
                          aria-label={PIECE_NAMES[type]}
                        >
                          <span class='piece'>
                            <PieceIcon
                              name={`${driver.game().turn}-${type}` as IconName}
                            />
                          </span>
                          <span>{PIECE_NAMES[type]}</span>
                        </button>
                      )}
                    </For>
                  </div>
                  <button
                    type='button'
                    class='btn btn-secondary'
                    onClick={() => input.cancelPromo()}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Show>
        </div>
      </dnd.Provider>
      <aside class='panel'>
        <div class='status' aria-live='polite'>
          {(() => {
            let dot = driver.turnDot()
            if (dot === null) return null
            return <span class={`turn-dot ${dot}`} aria-hidden='true' />
          })()}
          <span>{driver.statusText()}</span>
        </div>
        <Show when={driver.presence() !== null}>
          <div class='presence'>{driver.presence()}</div>
        </Show>
        <div class='material' aria-label='Material'>
          <div class='material-title'>
            <span>Material</span>
            <span class='material-meta'>
              <span class='scores'>
                {meta.score().white}–{meta.score().black}
              </span>
              <Show when={meta.score().diff !== 0}>
                <span class='diff'>
                  {meta.score().diff > 0
                    ? `+${meta.score().diff} White`
                    : `${meta.score().diff} Black`}
                </span>
              </Show>
              <Show when={meta.score().diff === 0}>
                <span class='diff even'>Even</span>
              </Show>
            </span>
          </div>
          <div class='material-row'>
            <span class='m-side'>White captured</span>
            <span class='m-pieces'>
              <For each={meta.takenByWhite()}>
                {(t) => (
                  <span class='mini'>
                    <PieceIcon name={`black-${t}` as IconName} />
                  </span>
                )}
              </For>
              <Show when={meta.takenByWhite().length === 0}>
                <span class='m-none'>—</span>
              </Show>
            </span>
          </div>
          <div class='material-row'>
            <span class='m-side'>Black captured</span>
            <span class='m-pieces'>
              <For each={meta.takenByBlack()}>
                {(t) => (
                  <span class='mini'>
                    <PieceIcon name={`white-${t}` as IconName} />
                  </span>
                )}
              </For>
              <Show when={meta.takenByBlack().length === 0}>
                <span class='m-none'>—</span>
              </Show>
            </span>
          </div>
        </div>
        <div class='controls'>{props.footer}</div>
        <div class='hint'>Drag pieces with mouse, touch, or keyboard (Space + arrows).</div>
        <Show when={driver.history().length > 0}>
          <div class='history-wrap'>
            <div class='section-label'>Moves</div>
            <ol class='history-table'>
              <For each={meta.movePairs()}>
                {(row) => (
                  <li>
                    <span class='move-no'>{row.n}.</span>
                    <span>{row.white}</span>
                    <span>{row.black}</span>
                  </li>
                )}
              </For>
            </ol>
          </div>
        </Show>
      </aside>
    </div>
  )
}
