import type { Result } from 'neverthrow'

export type SerializedResult<T, E> =
  | { success: true; data: T }
  | { success: false; error: E }

export function serializeResult<T, E>(result: Result<T, E>): SerializedResult<T, E> {
  if (result.isOk()) {
    return { success: true, data: result.value }
  }
  return { success: false, error: result.error }
}
