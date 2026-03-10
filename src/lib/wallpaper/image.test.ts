import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getExportFileName, getExportMimeType, resolveTargetSize } from './image'

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

  it('creates stable export names and mime types', () => {
    expect(getExportFileName('jpeg', { width: 1170, height: 2532 })).toBe('wallpaper-1170x2532.jpg')
    expect(getExportFileName('png', { width: 1290, height: 2796 })).toBe('wallpaper-1290x2796.png')
    expect(getExportMimeType('jpeg')).toBe('image/jpeg')
    expect(getExportMimeType('png')).toBe('image/png')
  })
})
