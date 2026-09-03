export const CLIENT_ERROR_ENDPOINT = '/api/client-errors'

const MAX_REPORTS_PER_WINDOW = 5
const THROTTLE_WINDOW_MS = 30_000

let installed = false
let sentAt: Array<number> = []

export interface ClientErrorPayload {
  message: string
  stack?: string
  context?: string
  url?: string
  userAgent?: string
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message === '' ? err.name : err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err) ?? 'Unknown error'
  } catch {
    return 'Unknown error'
  }
}

function stackOf(err: unknown): string | undefined {
  if (err instanceof Error && typeof err.stack === 'string' && err.stack !== '') {
    return err.stack.slice(0, 8000)
  }
  return undefined
}

function currentUrl(): string | undefined {
  if (typeof location === 'undefined') return undefined
  try {
    return String(location.href).slice(0, 1000)
  } catch {
    return undefined
  }
}

function currentUa(): string | undefined {
  if (typeof navigator === 'undefined') return undefined
  try {
    let ua = navigator.userAgent
    return typeof ua === 'string' ? ua.slice(0, 500) : undefined
  } catch {
    return undefined
  }
}

// Pure payload builder: no network, safe to unit-test.
export function buildClientErrorPayload(err: unknown, context?: string): ClientErrorPayload {
  let payload: ClientErrorPayload = { message: messageOf(err).slice(0, 2000) }
  if (payload.message.trim() === '') payload.message = 'Unknown error'
  let stack = stackOf(err)
  if (stack !== undefined) payload.stack = stack
  if (typeof context === 'string' && context.trim() !== '') {
    payload.context = context.slice(0, 1000)
  }
  let url = currentUrl()
  if (url !== undefined) payload.url = url
  let ua = currentUa()
  if (ua !== undefined) payload.userAgent = ua
  return payload
}

function throttled(): boolean {
  let now = Date.now()
  sentAt = sentAt.filter((t) => now - t < THROTTLE_WINDOW_MS)
  if (sentAt.length >= MAX_REPORTS_PER_WINDOW) return true
  sentAt.push(now)
  return false
}

function postPayload(payload: ClientErrorPayload): void {
  if (typeof fetch === 'undefined') return
  try {
    let body = JSON.stringify(payload)
    void fetch(CLIENT_ERROR_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // reporting must never break the app
  }
}

// Fire-and-forget: never throws, never awaits, throttled client-side.
export function reportClientError(err: unknown, context?: string): void {
  try {
    if (typeof window === 'undefined') return
    if (throttled()) return
    postPayload(buildClientErrorPayload(err, context))
  } catch {
    // reporting must never break the app
  }
}

function onWindowError(event: ErrorEvent): void {
  let err: unknown = event.error ?? event.message
  reportClientError(err, 'window.onerror')
}

function onUnhandledRejection(event: PromiseRejectionEvent): void {
  reportClientError(event.reason, 'unhandledrejection')
}

// Idempotent and SSR-safe: no-op during prerender where window is absent.
export function initClientErrorReporting(): void {
  if (installed) return
  installed = true
  if (typeof window === 'undefined') return
  window.addEventListener('error', onWindowError)
  window.addEventListener('unhandledrejection', onUnhandledRejection)
}
