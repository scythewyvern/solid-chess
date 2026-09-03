import { createSignal, For, Show, untrack } from 'solid-js'

import type { AiLevel } from './ai'
import type { Color } from './engine'

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
      <h1 class='menu-title'>Chess</h1>
      <div class='menu-row'>
        <button type='button' class='btn' onClick={() => props.onLocal()}>
          Two players
        </button>
        <button
          type='button'
          class='btn btn-secondary'
          onClick={() => setShowComputer((v) => !v)}
        >
          Vs computer
        </button>
        <button
          type='button'
          class='btn btn-secondary'
          onClick={() => setShowOnline((v) => !v)}
        >
          Play online
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
            White
          </button>
          <button
            type='button'
            class={color() === 'black' ? 'btn' : 'btn btn-secondary'}
            onClick={() => setColor('black')}
            aria-pressed={color() === 'black' ? 'true' : 'false'}
          >
            Black
          </button>
        </div>
        <div class='menu-row' role='group' aria-label='Difficulty'>
          <For each={LEVELS}>
            {(lv) => (
              <button
                type='button'
                class={level() === lv ? 'btn' : 'btn btn-secondary'}
                onClick={() => setLevel(lv)}
                aria-pressed={level() === lv ? 'true' : 'false'}
              >
                {lv === 'easy' ? 'Easy' : lv === 'medium' ? 'Medium' : 'Hard'}
              </button>
            )}
          </For>
        </div>
        <div class='menu-row'>
          <button type='button' class='btn' onClick={startComputer}>
            Start game
          </button>
        </div>
      </Show>
      <Show when={showOnline()}>
        <div class='menu-row'>
          <button type='button' class='btn btn-secondary' onClick={() => props.onCreate()}>
            Create room
          </button>
        </div>
        <div class='menu-row'>
          <input
            class='room-input'
            value={roomInput()}
            onInput={(e) => setRoomInput(e.currentTarget.value)}
            placeholder='CODE'
            aria-label='Room code'
            maxlength={8}
          />
          <button type='button' class='btn' onClick={joinRoom}>
            Join
          </button>
        </div>
      </Show>
    </div>
  )
}
