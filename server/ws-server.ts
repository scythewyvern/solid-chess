import type { ServerWebSocket } from 'bun'

import { leaveRoom, reduceRooms } from './rooms'
import type { Reply, RoomBook, Seat } from './rooms'
import type { ServerMsg } from '../src/net-protocol'

type Ws = ServerWebSocket<{ token: string; seat: Seat | null }>

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
    fetch(req, server) {
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
      return new Response('Not found', { status: 404 })
    },
    websocket: {
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
  return { stop: () => server.stop(), port: server.port }
}

if (import.meta.main) {
  let port = Number(process.env.WS_PORT ?? 3001)
  let srv = startServer(port)
  console.log('WS server ready on ' + String(srv.port))
}
