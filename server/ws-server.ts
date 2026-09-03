import { fileURLToPath } from 'node:url'

import type { ServerWebSocket } from 'bun'

import type { ServerMsg } from '../src/net-protocol'
import { leaveRoom, reduceRooms } from './rooms'
import type { Reply, RoomBook, Seat } from './rooms'

type Ws = ServerWebSocket<{ token: string; seat: Seat | null }>

// dist/client is resolved from this file, not from CWD, so the server works
// from any working directory (repo root locally, /app in Docker).
let clientDir = fileURLToPath(new URL('../dist/client/', import.meta.url))

// Thin transport: upgrades sockets, routes JSON to the pure rooms reducer
// and delivers its replies. All game rules live in rooms.ts.
export function startServer(port: number): { stop: () => void; port: number } {
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
  function handleHeartbeat(ws: Ws, data: unknown): boolean {
    if (typeof data !== 'object' || data === null) return false
    let t = (data as { type?: unknown }).type
    if (t !== 'ping') return false
    let nonce = (data as { nonce?: unknown }).nonce
    if (typeof nonce !== 'number') return false
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
        deliver(ws, { type: 'error', message: 'Invalid message format' })
        return
      }
    }
    let data: unknown
    try {
      data = JSON.parse(text) as unknown
    } catch {
      deliver(ws, { type: 'error', message: 'Invalid message format' })
      return
    }
    if (handleHeartbeat(ws, data)) return
    let out = reduceRooms(book, ws.data.token, ws.data.seat, data)
    ws.data.seat = out.sender
    dispatch(ws, out.replies)
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
      if (url.pathname === '/ws') {
        let token = 't' + String(nextToken)
        nextToken = nextToken + 1
        let ok = server.upgrade(req, { data: { token: token, seat: null } })
        if (ok) {
          return undefined
        }
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
      },
      message(ws: Ws, message: string | Buffer) {
        handleMessage(ws, message)
      },
      close(ws: Ws) {
        handleClose(ws)
      },
    },
  })
  let boundPort = server.port ?? port
  return { stop: () => server.stop(), port: boundPort }
}

if (import.meta.main) {
  // Railway injects PORT; WS_PORT stays for local runs.
  let port = Number(process.env.PORT ?? process.env.WS_PORT ?? 3001)
  let srv = startServer(port)
  console.log('WS server ready on ' + String(srv.port))
}
