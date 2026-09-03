import { createDragContext } from '@solid-primitives/drag-drop'
import { createMemo, For, Show } from 'solid-js'
import type { ParentProps } from 'solid-js'

import type { PieceType } from './engine'
import { squareName } from './engine'
import type { GameDriver } from './game-driver'
import { t } from './i18n'
import type { IconName } from './icon/icons'
import { pieceName } from './labels'
import { PieceIcon } from './piece-icon'
import { SquareCell } from './square-cell'
import { useFlyAnimation } from './use-fly-animation'
import { useGameMeta } from './use-game-meta'
import { useMoveInput } from './use-move-input'

export interface GameViewProps extends ParentProps {
  driver: GameDriver
  footer: ParentProps['children']
}

let PROMO_CHOICES: PieceType[] = ['queen', 'rook', 'bishop', 'knight']

// Board screen composed from a driver (local or online) and small hooks.
// No game rules here — only wiring between state, input and layout.
export function GameView(props: GameViewProps) {
  let meta = useGameMeta(
    () => props.driver.game(),
    () => props.driver.history()
  )
  let fly = useFlyAnimation(
    () => props.driver.game(),
    () => props.driver.history(),
    () => props.driver.orientation()
  )
  let input = useMoveInput(
    () => props.driver,
    () => fly.suppressNext()
  )

  let order = createMemo<number[]>(() => {
    return props.driver.orientation() === 'white'
      ? [0, 1, 2, 3, 4, 5, 6, 7]
      : [7, 6, 5, 4, 3, 2, 1, 0]
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
          <div class='board' role='grid' aria-label={t('boardLabel')}>
            <For each={order()}>
              {(row) => (
                <div class='row' role='row'>
                  <For each={order()}>
                    {(col) => (
                      <SquareCell
                        row={row}
                        col={col}
                        game={() => props.driver.game()}
                        canControl={(color) => props.driver.canControl(color)}
                        inputLocked={() => props.driver.inputLocked()}
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
                  {(f) => {
                    let vars = {
                      '--fr': fly.display(f.from.row),
                      '--fc': fly.display(f.from.col),
                      '--dx': fly.display(f.to.col) - fly.display(f.from.col),
                      '--dy': fly.display(f.to.row) - fly.display(f.from.row),
                    }
                    return (
                      <div class='fly-piece' style={vars}>
                        <span class='piece'>
                          <PieceIcon name={`${f.color}-${f.type}` as IconName} />
                        </span>
                      </div>
                    )
                  }}
                </For>
              </div>
            </Show>
          </div>
          <Show when={input.promo()}>
            {(pending) => (
              <div class='promo-overlay' role='dialog' aria-label={t('promoTitle')}>
                <div class='promo-box'>
                  <div class='promo-title'>
                    {t('promoChoose', { sq: squareName(pending().to) })}
                  </div>
                  <div class='promo-choices'>
                    <For each={PROMO_CHOICES}>
                      {(type) => (
                        <button
                          type='button'
                          class='promo-choice'
                          onClick={() => input.choosePromotion(type)}
                          aria-label={pieceName(type)}
                        >
                          <span class='piece'>
                            <PieceIcon
                              name={`${props.driver.game().turn}-${type}` as IconName}
                            />
                          </span>
                          <span>{pieceName(type)}</span>
                        </button>
                      )}
                    </For>
                  </div>
                  <button
                    type='button'
                    class='btn btn-secondary'
                    onClick={() => input.cancelPromo()}
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            )}
          </Show>
        </div>
      </dnd.Provider>
      <aside class='panel'>
        <div class='status' aria-live='polite'>
          <Show when={props.driver.turnDot()} keyed={false}>
            {(dot) => {
              // Read inside JSX: <Show> invokes function children untracked,
              // so a body-level read would snapshot (and go stale) here.
              let getColor = () => dot() ?? 'white'
              return <span class={['turn-dot', getColor()]} aria-hidden='true' />
            }}
          </Show>
          <span>{props.driver.statusText()}</span>
        </div>
        <Show when={props.driver.presence() !== null}>
          <div class='presence'>{props.driver.presence()}</div>
        </Show>
        <div class='material' aria-label={t('material')}>
          <div class='material-title'>
            <span>{t('material')}</span>
            <span class='material-meta'>
              <span class='scores'>
                {meta.score().white}–{meta.score().black}
              </span>
              <Show when={meta.score().diff !== 0}>
                <span class='diff'>
                  {meta.score().diff > 0
                    ? t('whiteLead', { n: meta.score().diff })
                    : t('blackLead', { n: meta.score().diff })}
                </span>
              </Show>
              <Show when={meta.score().diff === 0}>
                <span class='diff even'>{t('even')}</span>
              </Show>
            </span>
          </div>
          <div class='material-row'>
            <span class='m-side'>{t('whiteCaptured')}</span>
            <span class='m-pieces'>
              <For each={meta.takenByWhite()}>
                {(p) => (
                  <span class='mini'>
                    <PieceIcon name={`black-${p}` as IconName} />
                  </span>
                )}
              </For>
              <Show when={meta.takenByWhite().length === 0}>
                <span class='m-none'>—</span>
              </Show>
            </span>
          </div>
          <div class='material-row'>
            <span class='m-side'>{t('blackCaptured')}</span>
            <span class='m-pieces'>
              <For each={meta.takenByBlack()}>
                {(p) => (
                  <span class='mini'>
                    <PieceIcon name={`white-${p}` as IconName} />
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
        <div class='hint'>{t('dragHint')}</div>
        <Show when={props.driver.history().length > 0}>
          <div class='history-wrap'>
            <div class='section-label'>{t('moves')}</div>
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
