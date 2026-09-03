import { createSignal, Show } from 'solid-js'

export interface MenuScreenProps {
  initialRoom: string
  onLocal: () => void
  onCreate: () => void
  onJoin: (code: string) => void
}

export function MenuScreen(props: MenuScreenProps) {
  let [showOnline, setShowOnline] = createSignal(false)
  let [roomInput, setRoomInput] = createSignal(props.initialRoom)

  function joinRoom() {
    let code = roomInput().trim().toUpperCase()
    if (code === '') return
    props.onJoin(code)
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
          onClick={() => setShowOnline((v) => !v)}
        >
          Play online
        </button>
      </div>
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
