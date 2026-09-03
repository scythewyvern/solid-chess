export const MAX_CLIENT_ERROR_BYTES = 8192
const MAX_MESSAGE_LEN = 2000
const MAX_STACK_LEN = 8000
const MAX_CONTEXT_LEN = 1000
const MAX_URL_LEN = 1000
const MAX_UA_LEN = 500

export interface ClientErrorReport {
  message: string
  stack?: string
  context?: string
  url?: string
  userAgent?: string
}

function asText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  let trimmed = value.trim().slice(0, max)
  return trimmed === '' ? undefined : trimmed
}

function requiredMessage(value: unknown): string | null {
  let text = asText(value, MAX_MESSAGE_LEN)
  return text === undefined ? null : text
}

// Pure validator: no sockets, no I/O, safe to unit-test.
// Unknown fields are dropped so a hostile client cannot smuggle junk
// into Railway logs beyond the capped strings below.
export function parseClientErrorReport(raw: unknown): ClientErrorReport | null {
  if (typeof raw !== 'object' || raw === null) return null
  let o = raw as Record<string, unknown>
  let message = requiredMessage(o.message)
  if (message === null) return null
  let report: ClientErrorReport = { message }
  let stack = asText(o.stack, MAX_STACK_LEN)
  if (stack !== undefined) report.stack = stack
  let context = asText(o.context, MAX_CONTEXT_LEN)
  if (context !== undefined) report.context = context
  let url = asText(o.url, MAX_URL_LEN)
  if (url !== undefined) report.url = url
  let userAgent = asText(o.userAgent, MAX_UA_LEN)
  if (userAgent !== undefined) report.userAgent = userAgent
  return report
}
