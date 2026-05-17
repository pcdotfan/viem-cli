export class ViemCliError extends Error {
  readonly exitCode: number
  readonly code: string
  readonly cause?: unknown

  constructor(opts: {
    message: string
    code?: string
    exitCode?: number
    cause?: unknown
  }) {
    super(opts.message)
    this.name = 'ViemCliError'
    this.code = opts.code ?? 'cli_error'
    this.exitCode = opts.exitCode ?? 1
    this.cause = opts.cause
  }
}

export const errBadInput = (message: string, cause?: unknown) =>
  new ViemCliError({ message, code: 'bad_input', exitCode: 2, cause })

export const errMissingEnv = (envVar: string, hint?: string) =>
  new ViemCliError({
    message: `Missing required env var ${envVar}${hint ? `. ${hint}` : ''}`,
    code: 'missing_env',
    exitCode: 2
  })

export const errUserAborted = () =>
  new ViemCliError({
    message: 'Aborted by user.',
    code: 'user_aborted',
    exitCode: 130
  })

export function describeError(err: unknown): string {
  if (err instanceof ViemCliError) return err.message
  if (err && typeof err === 'object') {
    const anyErr = err as Record<string, unknown>
    if (typeof anyErr.shortMessage === 'string') return anyErr.shortMessage
    if (typeof anyErr.message === 'string') return anyErr.message
  }
  return String(err)
}
