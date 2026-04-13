import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  readImageSize,
  resolveTargetSize,
  decodeSourceImage,
  renderWallpaper,
  downloadResult,
} = vi.hoisted(() => ({
  readImageSize: vi.fn(),
  resolveTargetSize: vi.fn(),
  decodeSourceImage: vi.fn(),
  renderWallpaper: vi.fn(),
  downloadResult: vi.fn(),
}))

vi.mock('$lib/wallpaper/image', async () => {
  const actual = await vi.importActual<typeof import('$lib/wallpaper/image')>('$lib/wallpaper/image')

  return {
    ...actual,
    readImageSize,
    resolveTargetSize,
    decodeSourceImage,
    renderWallpaper,
  }
})

vi.mock('$lib/wallpaper/download', () => ({
  downloadResult,
}))

import App from './App.svelte'

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readImageSize.mockResolvedValue({ width: 1170, height: 2532 })
    resolveTargetSize.mockResolvedValue({ width: 1170, height: 2532 })
    decodeSourceImage.mockResolvedValue({
      image: document.createElement('img'),
      width: 3000,
      height: 2000,
      release: vi.fn(),
    })
    renderWallpaper.mockResolvedValue({
      blob: new Blob(['result'], { type: 'image/jpeg' }),
      previewUrl: 'blob:result',
      width: 1170,
      height: 2532,
      mimeType: 'image/jpeg',
      fileName: 'wallpaper-1170x2532.jpg',
    })
  })

  it('auto-fills manual resolution inputs from the screenshot', async () => {
    render(App)

    const screenshotInput = screen.getByLabelText('해상도 확인용 스크린샷')
    await fireEvent.change(screenshotInput, {
      target: {
        files: [new File(['screen'], 'screen.png', { type: 'image/png' })],
      },
    })

    await waitFor(() => {
      expect(screen.getByLabelText('가로 해상도')).toHaveValue(1170)
      expect(screen.getByLabelText('세로 해상도')).toHaveValue(2532)
    })
  })

  it('updates auto-filled manual resolution when the screenshot is replaced', async () => {
    readImageSize
      .mockResolvedValueOnce({ width: 1170, height: 2532 })
      .mockResolvedValueOnce({ width: 1290, height: 2796 })

    render(App)

    const screenshotInput = screen.getByLabelText('해상도 확인용 스크린샷')
    await fireEvent.change(screenshotInput, {
      target: {
        files: [new File(['screen-1'], 'screen-1.png', { type: 'image/png' })],
      },
    })

    await waitFor(() => {
      expect(screen.getByLabelText('가로 해상도')).toHaveValue(1170)
      expect(screen.getByLabelText('세로 해상도')).toHaveValue(2532)
    })

    await fireEvent.change(screenshotInput, {
      target: {
        files: [new File(['screen-2'], 'screen-2.png', { type: 'image/png' })],
      },
    })

    await waitFor(() => {
      expect(screen.getByLabelText('가로 해상도')).toHaveValue(1290)
      expect(screen.getByLabelText('세로 해상도')).toHaveValue(2796)
    })
  })

  it('replaces manually edited resolution when a new screenshot is selected', async () => {
    readImageSize.mockResolvedValueOnce({ width: 1290, height: 2796 })
    render(App)

    await fireEvent.input(screen.getByLabelText('가로 해상도'), { target: { value: '1170' } })
    await fireEvent.input(screen.getByLabelText('세로 해상도'), { target: { value: '2532' } })

    await fireEvent.change(screen.getByLabelText('해상도 확인용 스크린샷'), {
      target: {
        files: [new File(['screen'], 'screen.png', { type: 'image/png' })],
      },
    })

    await waitFor(() => {
      expect(screen.getByLabelText('가로 해상도')).toHaveValue(1290)
      expect(screen.getByLabelText('세로 해상도')).toHaveValue(2796)
    })
  })

  it('allows generation with manual resolution only', async () => {
    render(App)

    await fireEvent.change(screen.getByLabelText('원본 사진'), {
      target: {
        files: [new File(['source'], 'source.jpg', { type: 'image/jpeg' })],
      },
    })
    await fireEvent.input(screen.getByLabelText('가로 해상도'), { target: { value: '1290' } })
    await fireEvent.input(screen.getByLabelText('세로 해상도'), { target: { value: '2796' } })

    expect(screen.getByRole('button', { name: '생성' })).toBeEnabled()
  })

  it('keeps generation disabled when manual resolution is partially cleared', async () => {
    render(App)

    await fireEvent.change(screen.getByLabelText('원본 사진'), {
      target: {
        files: [new File(['source'], 'source.jpg', { type: 'image/jpeg' })],
      },
    })
    await fireEvent.change(screen.getByLabelText('해상도 확인용 스크린샷'), {
      target: {
        files: [new File(['screen'], 'screen.png', { type: 'image/png' })],
      },
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '생성' })).toBeEnabled()
    })

    await fireEvent.input(screen.getByLabelText('가로 해상도'), { target: { value: '' } })

    expect(screen.getByRole('button', { name: '생성' })).toBeDisabled()
  })

  it('keeps download disabled until a result exists and enables it after rendering', async () => {
    render(App)

    const downloadButton = screen.getByRole('button', { name: '다운로드' })
    expect(downloadButton).toBeDisabled()

    await fireEvent.change(screen.getByLabelText('원본 사진'), {
      target: {
        files: [new File(['source'], 'source.jpg', { type: 'image/jpeg' })],
      },
    })
    await fireEvent.input(screen.getByLabelText('가로 해상도'), { target: { value: '1170' } })
    await fireEvent.input(screen.getByLabelText('세로 해상도'), { target: { value: '2532' } })
    await fireEvent.click(screen.getByRole('button', { name: '생성' }))

    await waitFor(() => {
      expect(downloadButton).toBeEnabled()
    })
  })

  it('shows a failure message when rendering fails', async () => {
    renderWallpaper.mockRejectedValueOnce(new Error('결과 이미지를 저장하지 못했습니다. 다시 시도하세요.'))
    render(App)

    await fireEvent.change(screen.getByLabelText('원본 사진'), {
      target: {
        files: [new File(['source'], 'source.jpg', { type: 'image/jpeg' })],
      },
    })
    await fireEvent.input(screen.getByLabelText('가로 해상도'), { target: { value: '1170' } })
    await fireEvent.input(screen.getByLabelText('세로 해상도'), { target: { value: '2532' } })
    await fireEvent.click(screen.getByRole('button', { name: '생성' }))

    await waitFor(() => {
      expect(screen.getByText('결과 이미지를 저장하지 못했습니다. 다시 시도하세요.')).toBeInTheDocument()
    })
  })

  it('links to the author profile and GitHub repo from the footer', () => {
    render(App)

    expect(screen.getByRole('link', { name: 'moseoridev' })).toHaveAttribute(
      'href',
      'https://github.com/moseoridev',
    )
    expect(
      screen.getByRole('link', { name: 'github.com/moseoridev/iphoneWallpaperMaker' }),
    ).toHaveAttribute('href', 'https://github.com/moseoridev/iphoneWallpaperMaker')
  })
})
