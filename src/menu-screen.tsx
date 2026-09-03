import { createSignal, For, Show, untrack } from 'solid-js'

import type { AiLevel } from './ai'
import { aiLevelName } from './ai'
import type { Color } from './engine'
import { locale, setLocale, t } from './i18n'

export interface ComputerChoice {
  color: Color
  level: AiLevel
}

export interface MenuScreenProps {
  initialRoom: string
  onLocal: () => void
  onCreate: () => void
  onJoin: (code: string) => void
  onComputer: (choice: ComputerChoice) => void
}

let LEVELS: AiLevel[] = ['easy', 'medium', 'hard']

export function MenuScreen(props: MenuScreenProps) {
  let [showOnline, setShowOnline] = createSignal(false)
  let [showComputer, setShowComputer] = createSignal(false)
  // One-time snapshot: the input keeps its own text from here on, and the
  // menu remounts on every visit, so no subscription is wanted (untrack).
  let [roomInput, setRoomInput] = createSignal(untrack(() => props.initialRoom))
  let [color, setColor] = createSignal<Color>('white')
  let [level, setLevel] = createSignal<AiLevel>('medium')

  function joinRoom() {
    let code = roomInput().trim().toUpperCase()
    if (code === '') return
    props.onJoin(code)
  }

  function startComputer() {
    props.onComputer({ color: color(), level: level() })
  }

  return (
    <div class='menu'>
      <h1 class='menu-title'>{t('appTitle')}</h1>
      <div class='menu-row' role='group' aria-label={t('languageLabel')}>
        <button
          type='button'
          class={locale() === 'en' ? 'btn' : 'btn btn-secondary'}
          onClick={() => setLocale('en')}
          aria-pressed={locale() === 'en' ? 'true' : 'false'}
        >
          English
        </button>
        <button
          type='button'
          class={locale() === 'ru' ? 'btn' : 'btn btn-secondary'}
          onClick={() => setLocale('ru')}
          aria-pressed={locale() === 'ru' ? 'true' : 'false'}
        >
          Русский
        </button>
      </div>
      <div class='menu-row'>
        <button type='button' class='btn' onClick={() => props.onLocal()}>
          {t('twoPlayers')}
        </button>
        <button
          type='button'
          class='btn btn-secondary'
          onClick={() => setShowComputer((v) => !v)}
        >
          {t('vsComputer')}
        </button>
        <button
          type='button'
          class='btn btn-secondary'
          onClick={() => setShowOnline((v) => !v)}
        >
          {t('playOnline')}
        </button>
      </div>
      <Show when={showComputer()}>
        <div class='menu-row'>
          <button
            type='button'
            class={color() === 'white' ? 'btn' : 'btn btn-secondary'}
            onClick={() => setColor('white')}
            aria-pressed={color() === 'white' ? 'true' : 'false'}
          >
            {t('colorWhite')}
          </button>
          <button
            type='button'
            class={color() === 'black' ? 'btn' : 'btn btn-secondary'}
            onClick={() => setColor('black')}
            aria-pressed={color() === 'black' ? 'true' : 'false'}
          >
            {t('colorBlack')}
          </button>
        </div>
        <div class='menu-row' role='group' aria-label={t('difficulty')}>
          <For each={LEVELS}>
            {(lv) => (
              <button
                type='button'
                class={level() === lv ? 'btn' : 'btn btn-secondary'}
                onClick={() => setLevel(lv)}
                aria-pressed={level() === lv ? 'true' : 'false'}
              >
                {aiLevelName(lv)}
              </button>
            )}
          </For>
        </div>
        <div class='menu-row'>
          <button type='button' class='btn' onClick={startComputer}>
            {t('startGame')}
          </button>
        </div>
      </Show>
      <Show when={showOnline()}>
        <div class='menu-row'>
          <button type='button' class='btn btn-secondary' onClick={() => props.onCreate()}>
            {t('createRoom')}
          </button>
        </div>
        <div class='menu-row'>
          <input
            class='room-input'
            value={roomInput()}
            onInput={(e) => setRoomInput(e.currentTarget.value)}
            placeholder={t('roomCodePlaceholder')}
            aria-label={t('roomCodeLabel')}
            maxlength={8}
          />
          <button type='button' class='btn' onClick={joinRoom}>
            {t('join')}
          </button>
        </div>
      </Show>
    </div>
  )
}
