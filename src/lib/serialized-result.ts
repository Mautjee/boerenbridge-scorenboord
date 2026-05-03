import { ok, err, type Result } from 'neverthrow'
import type { AppError } from './errors'

/**
 * Serializable result type for crossing the server/client boundary.
 * Cannot use neverthrow Result directly because it's a class instance.
 */
export type SerializedResult<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E }

export function toSerialized<T, E>(result: Result<T, E>): SerializedResult<T, E> {
  if (result.isOk()) return { success: true, data: result.value }
  return { success: false, error: result.error }
}

export function fromSerialized<T, E>(serialized: SerializedResult<T, E>): Result<T, E> {
  if (serialized.success) return ok(serialized.data)
  return err(serialized.error)
}
