import { IconName } from './icons'
import spriteHref from './sprite.svg'

export function Icon(props: { name: IconName; size?: number }) {
  return (
    <svg width={props.size ?? 24} height={props.size ?? 24}>
      <use href={`${spriteHref}#${props.name}`} />
    </svg>
  )
}
