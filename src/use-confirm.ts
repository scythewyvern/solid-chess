import { createSignal, onCleanup } from 'solid-js'
import type { Accessor } from 'solid-js'

export interface Confirm {
  armed: Accessor<boolean>
  trigger: () => boolean
  cancel: () => void
}

// Two-click confirmation: the first click arms for `ms`, the second confirms.
// trigger returns true exactly on the confirming click.
export function useConfirm(ms = 3000): Confirm {
  let [armed, setArmed] = createSignal(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  onCleanup(() => {
    if (timer !== null) clearTimeout(timer)
  })

  function cancel() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    setArmed(false)
  }

  function trigger(): boolean {
    if (armed()) {
      cancel()
      return true
    }
    setArmed(true)
    timer = setTimeout(cancel, ms)
    return false
  }

  return { armed, trigger, cancel }
}
