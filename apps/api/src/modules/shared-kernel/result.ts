export type ErrorCode = 'not-found' | 'forbidden' | 'validation' | 'conflict' | 'invariant';

export interface AppError {
  code: ErrorCode;
  message: string;
}

export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = (code: ErrorCode, message: string): Result<never, AppError> => ({
  ok: false,
  error: { code, message },
});

/** Unwraps in tests / composition roots where failure is a programming error. */
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}
