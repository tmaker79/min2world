// 저장 계층에서 공통으로 쓰는 결과 타입과 값 판별자.
// saveGame.ts와 saveMigrations.ts가 함께 참조한다.

export type StorageErrorCode =
  | 'notFound'
  | 'invalidData'
  | 'unsupportedVersion'
  | 'storageUnavailable'

export type StorageResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: StorageErrorCode; message: string }

export function success<T>(value: T): StorageResult<T> {
  return { ok: true, value }
}

export function failure(code: StorageErrorCode, message: string): StorageResult<never> {
  return { ok: false, code, message }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isNonEmptyString(value: unknown, maximum = Infinity): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maximum
}

export function isIntegerInRange(value: unknown, minimum: number, maximum = Infinity): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
}

export function hasUniqueValues(values: string[]): boolean {
  return new Set(values).size === values.length
}
