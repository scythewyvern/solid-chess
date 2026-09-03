import type { ParentProps } from 'solid-js'

// Document shell for the generated entries (picked up automatically as
// `src/Document.tsx`). Mirrors the plugin's built-in shell, plus a
// translation opt-out: machine translation rewrites the DOM behind the
// renderer's back and crashes the board on the next update.
export default function Document(props: ParentProps) {
  return (
    <html lang='en' translate='no'>
      <head>
        <meta charset='utf-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
        <meta name='google' content='notranslate' />
        <meta name='ya:notranslate' content='notranslate' />
      </head>
      <body>{props.children}</body>
    </html>
  )
}
