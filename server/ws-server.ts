import { fileURLToPath } from 'node:url'

import type { ServerWebSocket } from 'bun'

import type { ServerMsg } from '../src/net-protocol'
import { MAX_CLIENT_ERROR_BYTES, parseClientErrorReport } from './client-errors'
import { logError, logInfo, logWarn } from './logger'
import { leaveRoom, reduceRooms } from './rooms'
import type { Reply, RoomBook, Seat } from './rooms'

type Ws = ServerWebSocket<{ token: string; seat: Seat | null }>

let processHandlersInstalled = false

function installProcessErrorHandlers(): void {
  if (processHandlersInstalled) return
  processHandlersInstalled = true
  process.on('uncaughtException', (err) => {
    logError('uncaughtException', { message: String(err) })
  })
  process.on('unhandledRejection', (reason) => {
    logError('unhandledRejection', { message: String(reason) })
  })
}

async function handleClientErrorReport(req: Request): Promise<Response> {
  let declared = req.headers.get('content-length')
  if (declared !== null && Number(declared) > MAX_CLIENT_ERROR_BYTES) {
    return new Response('Payload too large', { status: 413 })
  }
  let text: string
  try {
    text = await req.text()
  } catch {
    return new Response('Bad request', { status: 400 })
  }
  if (text.length > MAX_CLIENT_ERROR_BYTES) {
    return new Response('Payload too large', { status: 413 })
  }
  let raw: unknown
  try {
    raw = JSON.parse(text) as unknown
  } catch {
    return new Response('Bad request', { status: 400 })
  }
  let report = parseClientErrorReport(raw)
  if (report === null) {
    return new Response('Bad request', { status: 400 })
  }
  logError('client-error', {
    message: report.message.slice(0, 500),
    context: report.context ?? null,
    url: report.url ?? null,
    userAgent: report.userAgent ?? null,
  })
  if (report.stack !== undefined) {
    logError('client-error-stack', { message: report.stack.slice(0, 2000) })
  }
  return new Response(null, { status: 204 })
}

// dist/client is resolved from this file, not from CWD, so the server works
// from any working directory (repo root locally, /app in Docker).
let clientDir = fileURLToPath(new URL('../dist/client/', import.meta.url))

// Thin transport: upgrades sockets, routes JSON to the pure rooms reducer
// and delivers its replies. All game rules live in rooms.ts.
export function startServer(port: number): { stop: () => void; port: number } {
  installProcessErrorHandlers()
  let book: RoomBook = new Map()
  let sockets = new Map<string, Ws>()
  let nextToken = 1

  function deliver(to: Ws, msg: ServerMsg): void {
    try {
      to.send(JSON.stringify(msg))
    } catch {
      // socket went away mid-broadcast
    }
  }

  function dispatch(sender: Ws, replies: Array<Reply>): void {
    for (let reply of replies) {
      if (reply.target.kind === 'sender') {
        deliver(sender, reply.msg)
        continue
      }
      let sock = sockets.get(reply.target.token)
      if (sock !== undefined) {
        deliver(sock, reply.msg)
      }
    }
  }

  // Heartbeats bypass the game reducer: a pong must come back even
  // mid-game or with no seat, otherwise latency readings stall.
  function handleHeartbeat(ws: Ws, data: unknown): boolean | null {
    if (typeof data !== 'object' || data === null) return null
    let t = (data as { type?: unknown }).type
    if (t !== 'ping') return null
    let nonce = (data as { nonce?: unknown }).nonce
    if (typeof nonce !== 'number') {
      deliver(ws, { type: 'error', message: 'Ping needs a numeric nonce' })
      return true
    }
    deliver(ws, { type: 'pong', nonce })
    return true
  }

  function handleMessage(ws: Ws, message: string | Buffer): void {
    let text: string
    if (typeof message === 'string') {
      text = message
    } else {
      try {
        text = new TextDecoder().decode(message as Uint8Array)
      } catch {
        logWarn('ws-bad-frame', { token: ws.data.token })
        deliver(ws, { type: 'error', message: 'Invalid message format' })
        return
      }
    }
    let data: unknown
    try {
      data = JSON.parse(text) as unknown
    } catch {
      logWarn('ws-bad-json', { token: ws.data.token })
      deliver(ws, { type: 'error', message: 'Invalid message format' })
      return
    }
    let heartbeat = handleHeartbeat(ws, data)
    if (heartbeat === true) return
    try {
      let out = reduceRooms(book, ws.data.token, ws.data.seat, data)
      ws.data.seat = out.sender
      dispatch(ws, out.replies)
    } catch (err) {
      logError('ws-handler-crash', { token: ws.data.token, message: String(err) })
      deliver(ws, { type: 'error', message: 'Internal error' })
    }
  }

  function handleClose(ws: Ws): void {
    let out = leaveRoom(book, ws.data.seat)
    ws.data.seat = out.sender
    dispatch(ws, out.replies)
    sockets.delete(ws.data.token)
  }

  let server = Bun.serve({
    port: port,
    hostname: '0.0.0.0',
    routes: {
      '/health': new Response('OK'),
      '/assets/*': { dir: clientDir + 'assets' },
      '/favicon.svg': new Response(Bun.file(clientDir + 'favicon.svg')),
    },
    fetch: async (req, server) => {
      let url = new URL(req.url)
      if (url.pathname === '/api/client-errors') {
        if (req.method !== 'POST') {
          return new Response('Method not allowed', { status: 405 })
        }
        return handleClientErrorReport(req)
      }
      if (url.pathname === '/ws') {
        let token = 't' + String(nextToken)
        nextToken = nextToken + 1
        let ok = server.upgrade(req, { data: { token: token, seat: null } })
        if (ok) {
          return undefined
        }
        logError('ws-upgrade-failed')
        return new Response('Upgrade failed', { status: 500 })
      }
      // Single-page app: navigation serves index.html, unknown asset paths 404.
      if (
        req.method === 'GET' &&
        (url.pathname === '/' || url.pathname.includes('.') === false)
      ) {
        let index = Bun.file(clientDir + 'index.html')
        if (await index.exists()) {
          return new Response(index)
        }
      }
      return new Response('Not found', { status: 404 })
    },
    websocket: {
      // Chess thinks longer than 10s: disable the idle kill and ping so both
      // Bun and any proxy in front (e.g. Railway) see a live connection.
      idleTimeout: 0,
      sendPings: true,
      open(ws: Ws) {
        sockets.set(ws.data.token, ws)
        logInfo('ws-open', { token: ws.data.token })
      },
      message(ws: Ws, message: string | Buffer) {
        handleMessage(ws, message)
      },
      close(ws: Ws) {
        logInfo('ws-close', { token: ws.data.token })
        handleClose(ws)
      },
    },
  })
  let boundPort = server.port ?? port
  logInfo('server-ready', { port: boundPort })
  return { stop: () => server.stop(), port: boundPort }
}

if (import.meta.main) {
  // Railway injects PORT; WS_PORT stays for local runs.
  let port = Number(process.env.PORT ?? process.env.WS_PORT ?? 3001)
  startServer(port)
}
