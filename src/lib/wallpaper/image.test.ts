import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getAverageColor,
  getExportFileName,
  getExportMimeType,
  getLetterboxAxis,
  resolveTargetSize,
} from './image'

let mockWidth = 0
let mockHeight = 0
const originalImage = globalThis.Image

class MockImage {
  decoding = 'async'
  naturalWidth = 0
  naturalHeight = 0
  onload: null | (() => void) = null
  onerror: null | (() => void) = null

  set src(_value: string) {
    queueMicrotask(() => {
      this.naturalWidth = mockWidth
      this.naturalHeight = mockHeight
      this.onload?.()
    })
  }
}

describe('image helpers', () => {
  beforeEach(() => {
    mockWidth = 1290
    mockHeight = 2796
    vi.stubGlobal('Image', MockImage as unknown as typeof Image)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    globalThis.Image = originalImage
  })

  it('prefers manual target size over screenshot size', async () => {
    const manualSize = { width: 1170, height: 2532 }
    const screenshot = new File(['fake'], 'screen.png', { type: 'image/png' })

    await expect(resolveTargetSize(manualSize, screenshot)).resolves.toEqual(manualSize)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('reads target size from the screenshot when manual input is absent', async () => {
    const screenshot = new File(['fake'], 'screen.png', { type: 'image/png' })

    await expect(resolveTargetSize(null, screenshot)).resolves.toEqual({ width: 1290, height: 2796 })
  })

  it('rejects oversized target sizes before rendering', async () => {
    await expect(resolveTargetSize({ width: 6001, height: 1000 })).rejects.toThrow(
      '목표 해상도는 한 변 6000px 이하로 입력하세요.',
    )
  })

  it('creates stable export names and mime types', () => {
    expect(getExportFileName('jpeg', { width: 1170, height: 2532 })).toBe('wallpaper-1170x2532.jpg')
    expect(getExportFileName('png', { width: 1290, height: 2796 })).toBe('wallpaper-1290x2796.png')
    expect(getExportMimeType('jpeg')).toBe('image/jpeg')
    expect(getExportMimeType('png')).toBe('image/png')
  })

  it('detects which axis receives the letterbox fill', () => {
    expect(
      getLetterboxAxis(
        { x: 0, y: 327, width: 1170, height: 1878 },
        { width: 1170, height: 2532 },
      ),
    ).toBe('vertical')
    expect(
      getLetterboxAxis(
        { x: 180, y: 0, width: 810, height: 2532 },
        { width: 1170, height: 2532 },
      ),
    ).toBe('horizontal')
    expect(
      getLetterboxAxis(
        { x: 0, y: 0, width: 1170, height: 2532 },
        { width: 1170, height: 2532 },
      ),
    ).toBe('none')
  })

  it('averages visible pixels into a representative edge color', () => {
    const pixels = new Uint8ClampedArray([
      20,
      30,
      40,
      255,
      220,
      210,
      200,
      255,
      120,
      120,
      120,
      0,
    ])

    expect(getAverageColor(pixels)).toEqual({ r: 120, g: 120, b: 120 })
  })
})
