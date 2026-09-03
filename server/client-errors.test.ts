import { describe, expect, test } from 'bun:test'

import { parseClientErrorReport } from './client-errors'

describe('parseClientErrorReport', () => {
  test('accepts a full report and drops unknown fields', () => {
    let report = parseClientErrorReport({
      message: 'boom',
      stack: 'Error: boom',
      context: 'window.onerror',
      url: 'https://x/app',
      userAgent: 'UA',
      extra: 'ignored',
    })
    expect(report).toEqual({
      message: 'boom',
      stack: 'Error: boom',
      context: 'window.onerror',
      url: 'https://x/app',
      userAgent: 'UA',
    })
  })

  test('accepts message-only reports', () => {
    expect(parseClientErrorReport({ message: 'boom' })).toEqual({ message: 'boom' })
  })

  test('rejects missing, empty and non-object payloads', () => {
    expect(parseClientErrorReport(null)).toBeNull()
    expect(parseClientErrorReport('boom')).toBeNull()
    expect(parseClientErrorReport({})).toBeNull()
    expect(parseClientErrorReport({ message: '   ' })).toBeNull()
    expect(parseClientErrorReport({ message: 42 })).toBeNull()
  })

  test('trims and caps field lengths', () => {
    let report = parseClientErrorReport({
      message: '  ' + 'm'.repeat(5000) + '  ',
      stack: 's'.repeat(20000),
      context: 'c'.repeat(5000),
    })
    expect(report).not.toBeNull()
    if (report !== null) {
      expect(report.message.length).toBe(2000)
      expect(report.stack?.length).toBe(8000)
      expect(report.context?.length).toBe(1000)
    }
  })
})
