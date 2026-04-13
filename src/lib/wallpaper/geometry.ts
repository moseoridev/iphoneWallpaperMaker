import type { TargetSize } from './types'

export const MAX_TARGET_DIMENSION = 6000
export const MAX_TARGET_PIXELS = 24_000_000

export interface DrawRect extends TargetSize {
  x: number
  y: number
}

function normalizeDimension(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    return null
  }

  return value > 0 ? value : null
}

export function hasPartialManualTarget(
  width: number | null | undefined,
  height: number | null | undefined,
) {
  return width !== undefined || height !== undefined
}

export function parseManualTargetSize(
  width: number | null | undefined,
  height: number | null | undefined,
) {
  const parsedWidth = normalizeDimension(width)
  const parsedHeight = normalizeDimension(height)

  if (width === undefined && height === undefined) {
    return null
  }

  if (!parsedWidth || !parsedHeight) {
    return null
  }

  return { width: parsedWidth, height: parsedHeight }
}

export function getTargetSizeError(target: TargetSize) {
  if (target.width > MAX_TARGET_DIMENSION || target.height > MAX_TARGET_DIMENSION) {
    return `목표 해상도는 한 변 ${MAX_TARGET_DIMENSION}px 이하로 입력하세요.`
  }

  if (target.width * target.height > MAX_TARGET_PIXELS) {
    return '목표 해상도는 24MP 이하로 입력하세요.'
  }

  return ''
}

export function assertSupportedTargetSize(target: TargetSize) {
  const errorMessage = getTargetSizeError(target)

  if (errorMessage) {
    throw new Error(errorMessage)
  }
}

export function getContainRect(source: TargetSize, target: TargetSize): DrawRect {
  const scale = Math.min(target.width / source.width, target.height / source.height)
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))

  return {
    width,
    height,
    x: Math.round((target.width - width) / 2),
    y: Math.round((target.height - height) / 2),
  }
}

export function getCoverRect(source: TargetSize, target: TargetSize): DrawRect {
  const scale = Math.max(target.width / source.width, target.height / source.height)
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))

  return {
    width,
    height,
    x: Math.round((target.width - width) / 2),
    y: Math.round((target.height - height) / 2),
  }
}
