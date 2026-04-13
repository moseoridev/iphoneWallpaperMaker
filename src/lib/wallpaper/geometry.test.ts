import { describe, expect, it } from 'vitest'

import { getContainRect, getCoverRect, getTargetSizeError, parseManualTargetSize } from './geometry'

describe('geometry helpers', () => {
  it('calculates a centered contain rect for portrait output', () => {
    expect(getContainRect({ width: 4000, height: 3000 }, { width: 1170, height: 2532 })).toEqual({
      width: 1170,
      height: 878,
      x: 0,
      y: 827,
    })
  })

  it('calculates a centered cover rect for portrait output', () => {
    expect(getCoverRect({ width: 4000, height: 3000 }, { width: 1170, height: 2532 })).toEqual({
      width: 3376,
      height: 2532,
      x: -1103,
      y: 0,
    })
  })

  it('accepts only positive integer manual sizes', () => {
    expect(parseManualTargetSize(1290, 2796)).toEqual({ width: 1290, height: 2796 })
    expect(parseManualTargetSize(undefined, undefined)).toBeNull()
    expect(parseManualTargetSize(1290, undefined)).toBeNull()
    expect(parseManualTargetSize(-1, 2796)).toBeNull()
    expect(parseManualTargetSize(1170.5, 2532)).toBeNull()
  })

  it('rejects target sizes that are too large for browser canvas output', () => {
    expect(getTargetSizeError({ width: 6000, height: 4000 })).toBe('')
    expect(getTargetSizeError({ width: 6001, height: 1000 })).toBe(
      '목표 해상도는 한 변 6000px 이하로 입력하세요.',
    )
    expect(getTargetSizeError({ width: 5000, height: 5000 })).toBe(
      '목표 해상도는 24MP 이하로 입력하세요.',
    )
  })
})
