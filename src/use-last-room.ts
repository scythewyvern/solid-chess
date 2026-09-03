import { createSignal } from 'solid-js'
import type { Accessor } from 'solid-js'

let ROOM_KEY = 'chess:last-room'

export interface LastRoom {
  value: Accessor<string>
  set: (code: string) => void
  save: (code: string) => void
}

export function useLastRoom(): LastRoom {
  function load(): string {
    try {
      return localStorage.getItem(ROOM_KEY) ?? ''
    } catch {
      return ''
    }
  }

  let [value, setValue] = createSignal(load())

  function set(code: string) {
    setValue(code)
  }

  function save(code: string) {
    if (code === '') return
    try {
      localStorage.setItem(ROOM_KEY, code)
    } catch {
      // private mode or SSR — the room simply won't be remembered
    }
  }

  return { value, set, save }
}
