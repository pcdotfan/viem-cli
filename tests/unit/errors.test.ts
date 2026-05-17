import { describe, it, expect } from 'vitest'
import { ViemCliError, errBadInput, errMissingEnv, errUserAborted, describeError } from '../../src/lib/errors.js'

describe('errors', () => {
  it('errBadInput uses exit code 2', () => {
    const e = errBadInput('boom')
    expect(e).toBeInstanceOf(ViemCliError)
    expect(e.exitCode).toBe(2)
    expect(e.code).toBe('bad_input')
  })

  it('errMissingEnv embeds env name', () => {
    const e = errMissingEnv('FOO_BAR')
    expect(e.message).toContain('FOO_BAR')
    expect(e.exitCode).toBe(2)
  })

  it('errUserAborted exit code 130', () => {
    expect(errUserAborted().exitCode).toBe(130)
  })

  it('describeError unwraps viem-style shortMessage', () => {
    const fake = { shortMessage: 'short!', message: 'long' }
    expect(describeError(fake)).toBe('short!')
  })

  it('describeError falls back to message', () => {
    expect(describeError({ message: 'm' })).toBe('m')
    expect(describeError(new Error('e'))).toBe('e')
    expect(describeError('s')).toBe('s')
  })
})
