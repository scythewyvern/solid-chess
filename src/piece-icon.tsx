import type { IconName } from './icon/icons'
import spriteHref from './icon/sprite.svg'

// Source SVGs are 45x45 with no viewBox, and the generated sprite symbols
// keep it that way — without a viewBox the glyph never scales to its box.
// This wrapper supplies the viewBox so pieces fill their square.
export function PieceIcon(props: { name: IconName }) {
  return (
    <svg viewBox='0 0 45 45' width='100%' height='100%' aria-hidden='true'>
      <use href={`${spriteHref}#${props.name}`} />
    </svg>
  )
}
