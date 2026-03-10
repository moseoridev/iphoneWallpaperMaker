import type { TargetSize } from './types'

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
