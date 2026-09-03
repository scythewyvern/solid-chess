import { createEffect, createMemo, createSignal, Show } from 'solid-js'

import { GameView } from './game-view'
import { MenuScreen } from './menu-screen'
import { useConfirm } from './use-confirm'
import { useLastRoom } from './use-last-room'
import { useLocalGame } from './use-local-game'
import { useOnlineGame } from './use-online-game'

import './styles.css'

type Mode =
  | { kind: 'menu' }
  | { kind: 'local' }
  | { kind: 'online'; create: boolean; room: string }

let WS_URL: string = import.meta.env.VITE_WS_URL ?? defaultWsUrl()

// Same-origin /ws by default so a deployed single-service build just works.
// Local dev overrides it via .env.development ( Vite dev server has no /ws ).
// Guarded for SSR prerender where location does not exist.
function defaultWsUrl(): string {
  if (typeof location === 'undefined') return 'ws://localhost:3001/ws'
  let proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/ws`
}

function LocalSession() {
  let local = useLocalGame()

  return (
    <GameView
      driver={local.driver}
      footer={
        <>
          <button type='button' class='btn' onClick={local.restart}>
            New game
          </button>
          <button
            type='button'
            class='btn btn-secondary'
            onClick={local.undo}
            disabled={local.canUndo() === false}
            title={local.canUndo() ? 'Take back the last move' : 'Nothing to undo yet'}
          >
            Undo move
          </button>
        </>
      }
    />
  )
}

function OnlineSession(props: {
  create: boolean
  room: string
  onLeave: () => void
  onRetry: () => void
  onRoomKnown: (code: string) => void
}) {
  let online = useOnlineGame(WS_URL, {
    create: () => props.create,
    room: () => props.room,
  })
  let [copied, setCopied] = createSignal(false)
  let resign = useConfirm(3000)

  createEffect(
    () => online.room(),
    (room) => props.onRoomKnown(room)
  )

  function roomCode(): string {
    return online.room() !== '' ? online.room() : props.room
  }

  function ownVote(): boolean {
    let c = online.color()
    return c !== null && online.rematch()[c]
  }

  function rematchWaiting(): boolean {
    let r = online.rematch()
    return (r.white || r.black) && (r.white === false || r.black === false)
  }

  async function copyRoom(): Promise<void> {
    try {
      await navigator.clipboard.writeText(roomCode())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  function onResignClick(): void {
    if (resign.trigger()) online.resign()
  }

  return (
    <div class='online-wrap'>
      <div class='room-code'>
        <span>Room</span>
        <code>{roomCode() === '' ? '…' : roomCode()}</code>
        <button
          type='button'
          class='btn btn-secondary'
          onClick={copyRoom}
          disabled={roomCode() === ''}
          title={roomCode() === '' ? 'Waiting for the room code' : 'Copy the room code'}
        >
          {copied() ? 'Copied' : 'Copy'}
        </button>
      </div>
      <Show when={online.error() !== null}>
        <div class='error' role='alert'>
          <span>{online.error()}</span>
          <button type='button' class='btn btn-secondary' onClick={() => props.onRetry()}>
            Retry
          </button>
          <button type='button' class='btn btn-secondary' onClick={() => props.onLeave()}>
            Menu
          </button>
        </div>
      </Show>
      <GameView
        driver={online.driver}
        footer={
          <>
            <button
              type='button'
              class='btn btn-danger'
              onClick={onResignClick}
              disabled={online.driver.inputLocked() || online.connected() === false}
              title={resign.armed() ? 'Click again to confirm' : 'Give up this game'}
            >
              {resign.armed() ? 'Confirm resign?' : 'Resign'}
            </button>
            <button
              type='button'
              class='btn btn-secondary'
              onClick={() => online.voteRematch()}
              disabled={ownVote()}
              title={
                ownVote() ? 'Waiting for the opponent' : 'Start a new game with swapped colors'
              }
            >
              {rematchWaiting() ? 'Rematch (1/2)' : 'Rematch'}
            </button>
            <button type='button' class='btn btn-secondary' onClick={() => props.onLeave()}>
              Leave room
            </button>
          </>
        }
      />
    </div>
  )
}

function OnlineDriver(props: {
  create: boolean
  room: string
  onLeave: () => void
  onRoomKnown: (code: string) => void
}) {
  let [live, setLive] = createSignal(true)

  function retry() {
    setLive(false)
    setTimeout(() => setLive(true), 0)
  }

  return (
    <Show when={live()}>
      <OnlineSession
        create={props.create}
        room={props.room}
        onLeave={props.onLeave}
        onRetry={retry}
        onRoomKnown={props.onRoomKnown}
      />
    </Show>
  )
}

export default function App() {
  let [mode, setMode] = createSignal<Mode>({ kind: 'menu' })
  let lastRoom = useLastRoom()

  let onlineOpts = createMemo(() => {
    let m = mode()
    return m.kind === 'online' ? { create: m.create, room: m.room } : null
  })

  function playLocal() {
    setMode({ kind: 'local' })
  }

  function createRoom() {
    setMode({ kind: 'online', create: true, room: '' })
  }

  function joinRoom(code: string) {
    lastRoom.save(code)
    setMode({ kind: 'online', create: false, room: code })
  }

  function toMenu() {
    setMode({ kind: 'menu' })
  }

  return (
    <div class='app'>
      <Show when={mode().kind === 'menu'}>
        <MenuScreen
          initialRoom={lastRoom.value()}
          onLocal={playLocal}
          onCreate={createRoom}
          onJoin={joinRoom}
        />
      </Show>
      <Show when={mode().kind === 'local'}>
        <LocalSession />
      </Show>
      <Show when={onlineOpts()}>
        {(opts) => (
          <OnlineDriver
            create={opts().create}
            room={opts().room}
            onLeave={toMenu}
            onRoomKnown={(code) => lastRoom.save(code)}
          />
        )}
      </Show>
    </div>
  )
}
