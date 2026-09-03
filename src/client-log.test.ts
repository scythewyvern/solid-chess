import { describe, expect, test } from 'bun:test'

import {
  buildClientErrorPayload,
  initClientErrorReporting,
  reportClientError,
} from './client-log'

describe('client-log', () => {
  test('builds payloads from Errors, strings and unknown values', () => {
    let fromError = buildClientErrorPayload(new Error('boom'), 'error-boundary')
    expect(fromError.message).toBe('boom')
    expect(fromError.context).toBe('error-boundary')
    expect(typeof fromError.stack).toBe('string')

    let fromString = buildClientErrorPayload('plain failure')
    expect(fromString.message).toBe('plain failure')
    expect(fromString.stack).toBeUndefined()

    let fromEmpty = buildClientErrorPayload('')
    expect(fromEmpty.message).toBe('Unknown error')
  })

  test('reporting is a safe no-op without a window (SSR / tests)', () => {
    expect(() => initClientErrorReporting()).not.toThrow()
    expect(() => initClientErrorReporting()).not.toThrow()
    expect(() => reportClientError(new Error('boom'), 'ctx')).not.toThrow()
  })
})
