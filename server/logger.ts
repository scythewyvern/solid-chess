export type LogLevel = 'info' | 'warn' | 'error'

export interface LogFields {
  [key: string]: string | number | boolean | null | undefined
}

function writeLine(level: LogLevel, msg: string, fields?: LogFields): void {
  let line: string
  try {
    line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields })
  } catch {
    line = JSON.stringify({ ts: new Date().toISOString(), level, msg })
  }
  if (level === 'error') {
    console.error(line)
    return
  }
  if (level === 'warn') {
    console.warn(line)
    return
  }
  console.log(line)
}

export function logInfo(msg: string, fields?: LogFields): void {
  writeLine('info', msg, fields)
}

export function logWarn(msg: string, fields?: LogFields): void {
  writeLine('warn', msg, fields)
}

export function logError(msg: string, fields?: LogFields): void {
  writeLine('error', msg, fields)
}
